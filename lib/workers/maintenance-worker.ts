import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Archive ActivityLog rows older than archiveDays into ActivityLogArchive,
// then delete rows older than deleteDays from ActivityLog.
export async function pruneActivityLog(
  archiveDays = 90,
  deleteDays = 180
): Promise<{ archived: number; deleted: number }> {
  const archiveCutoff = new Date(Date.now() - archiveDays * 86_400_000);
  const deleteCutoff  = new Date(Date.now() - deleteDays  * 86_400_000);

  const archived = await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "ActivityLogArchive"
        (id, "eventType", "userId", "userName", handle, avatar, meta, "createdAt", "archivedAt")
      SELECT id, "eventType", "userId", "userName", handle, avatar, meta, "createdAt", NOW()
      FROM "ActivityLog"
      WHERE "createdAt" < ${archiveCutoff}
      ON CONFLICT (id) DO NOTHING
    `
  );

  const deleted = await prisma.$executeRaw(
    Prisma.sql`DELETE FROM "ActivityLog" WHERE "createdAt" < ${deleteCutoff}`
  );

  console.log(`[MAINTENANCE] ActivityLog: archived=${archived} deleted=${deleted}`);
  return { archived, deleted };
}

// Delete expired Story rows (past expiresAt with 1-day grace period).
export async function cleanupExpiredStories(): Promise<number> {
  const now = new Date();
  // Grace period: delete stories expired more than 1 hour ago so ephemeral
  // viewers mid-playback are not disrupted by a precise cutoff.
  const cutoff = new Date(now.getTime() - 60 * 60_000);

  const { count } = await prisma.story.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });

  // Clear hasStory for any user whose last active published story just expired.
  // Uses a single raw UPDATE to avoid N+1 — runs even when count === 0 in case
  // earlier cleanup runs crashed before reaching this step.
  await prisma.$executeRaw`
    UPDATE "User"
    SET "hasStory" = false
    WHERE "hasStory" = true
      AND NOT EXISTS (
        SELECT 1 FROM "Story"
        WHERE "Story"."userId" = "User"."id"
          AND "Story"."status" = 'published'
          AND "Story"."expiresAt" > ${now}
      )
  `;

  console.log(`[MAINTENANCE] Expired stories deleted: ${count}`);
  return count;
}

// Keep only the last N read notifications per recipient, delete the rest.
// Notification has no createdAt — uses auto-increment id as a time proxy.
// Batched to 5000 rows per run to avoid long-running locks on large tables.
// On very large notification tables, run multiple times until it returns 0.
export async function cleanupReadNotifications(keepPerRecipient = 100): Promise<number> {
  const deleted = await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM "Notification"
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY "recipientId" ORDER BY id DESC) AS rn
          FROM "Notification"
          WHERE unread = false
        ) ranked
        WHERE rn > ${keepPerRecipient}
        LIMIT 5000
      )
    `
  );
  console.log(`[MAINTENANCE] Read notifications deleted: ${deleted}`);
  return deleted;
}

// Delete sent/failed EmailLog records older than retentionDays.
// Queued records are never pruned — they represent active pending deliveries.
export async function pruneEmailLogs(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const { count } = await prisma.emailLog.deleteMany({
    where: { status: { in: ["sent", "failed"] }, createdAt: { lt: cutoff } },
  });
  console.log(`[MAINTENANCE] EmailLog records pruned: ${count}`);
  return count;
}

// Remove completed/dead jobs older than retentionDays.
export async function pruneOldJobs(retentionDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const { count } = await prisma.job.deleteMany({
    where: { status: { in: ["completed", "dead"] }, createdAt: { lt: cutoff } },
  });
  console.log(`[MAINTENANCE] Old jobs pruned: ${count}`);
  return count;
}

const ACTIVE_REVIEW_STATUSES = ["submitted", "under_review", "revision_requested", "approved"];

/**
 * Finds articles whose assignedEditorId points at a banned or deleted user.
 * Previously this reconciliation only happened reactively when the author
 * happened to resubmit — an article stuck under_review/approved whose editor
 * was banned in the meantime became invisible to every queue with nothing
 * proactively catching it (audit finding H-6). Reassigns to the least-loaded
 * valid editor for the same section when one exists; otherwise clears the
 * assignment and raises an AdminNotification for manual attention.
 */
export async function reconcileOrphanedEditorAssignments(): Promise<{ reassigned: number; orphaned: number }> {
  const orphans = await prisma.$queryRaw<
    { id: number; title: string | null; userId: number; sectionId: number | null; assignedEditorId: number }[]
  >`
    SELECT p.id, p.title, p."userId", p."sectionId", p."assignedEditorId"
    FROM "Post" p
    INNER JOIN "User" u ON u.id = p."assignedEditorId"
    WHERE p.status = ANY(${ACTIVE_REVIEW_STATUSES})
      AND p."assignedEditorId" IS NOT NULL
      AND u.banned = true
  `;

  let reassigned = 0;
  let orphaned = 0;

  for (const post of orphans) {
    let newEditorId: number | null = null;

    if (post.sectionId) {
      const candidates = await prisma.$queryRaw<{ editorId: number; cnt: bigint }[]>`
        SELECT esa."editorId", COUNT(p.id) AS cnt
        FROM "EditorSectionAssignment" esa
        INNER JOIN "User" u ON u.id = esa."editorId" AND u.banned = false
        LEFT JOIN "Post" p
          ON p."assignedEditorId" = esa."editorId"
          AND p.status = ANY(${ACTIVE_REVIEW_STATUSES})
        WHERE esa."sectionId" = ${post.sectionId} AND esa."editorId" != ${post.assignedEditorId}
        GROUP BY esa."editorId"
        ORDER BY cnt ASC
        LIMIT 1
      `;
      if (candidates.length > 0) newEditorId = candidates[0].editorId;
    }

    if (newEditorId) {
      await prisma.$executeRaw`UPDATE "Post" SET "assignedEditorId" = ${newEditorId} WHERE id = ${post.id}`;
      await prisma.editorActivity.create({
        data: {
          editorId: newEditorId,
          postId: post.id,
          action: `AUTO_REASSIGN|${JSON.stringify({ reason: "previous_editor_banned", fromEditorId: post.assignedEditorId, toEditorId: newEditorId })}`,
        },
      }).catch(() => { });
      const { notifyEditorAssigned } = await import("@/lib/workflow-notifications");
      notifyEditorAssigned({
        postId: post.id,
        editorId: newEditorId,
        authorId: post.userId,
        articleTitle: post.title,
        authorName: null,
      }).catch(() => { });
      reassigned++;
    } else {
      await prisma.$executeRaw`UPDATE "Post" SET "assignedEditorId" = NULL WHERE id = ${post.id}`;
      await prisma.adminNotification.create({
        data: {
          type: "SYSTEM",
          title: "Article orphaned by banned editor",
          message: `"${post.title ?? "Untitled"}" (post #${post.id}) was assigned to a now-banned editor and has no other section-assigned editor to fall back to. It needs manual reassignment.`,
          metadata: { postId: post.id, previousEditorId: post.assignedEditorId } as any,
        },
      }).catch(() => { });
      orphaned++;
    }
  }

  if (orphans.length > 0) {
    console.log(`[MAINTENANCE] Editor reconciliation: reassigned=${reassigned} orphaned=${orphaned}`);
  }
  return { reassigned, orphaned };
}