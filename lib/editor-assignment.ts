import { prisma } from "@/lib/prisma";

/**
 * Resolves and writes the editor assigned to review a submitted article, and
 * fires the assignment notification triplet (in-app/push/email).
 *
 * The whole read-decide-write sequence runs inside a single transaction with
 * a row lock on the Post, so two near-simultaneous submits of the same post
 * (a double-click, or a race between create and an immediate resubmit)
 * cannot each independently pick a different editor and both write
 * "assignedEditorId" — the second one to acquire the lock sees the first
 * one's write and short-circuits. Previously this was an unguarded
 * read-then-write with no lock at all (audit findings H-5 / L-6).
 */
export async function autoAssignEditor(params: {
  postId: number;
  sectionId: number;
  preferredEditorId?: number | null;
  /** Keep the post's current assignedEditorId if it's still a valid, non-banned assignee (resubmit path). */
  keepExisting?: boolean;
  authorId: number;
  articleTitle: string | null;
  authorName: string | null;
}): Promise<number | null> {
  const { postId, sectionId, preferredEditorId, keepExisting, authorId, articleTitle, authorName } = params;

  const assignedEditorId = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ assignedEditorId: number | null }[]>`
      SELECT "assignedEditorId" FROM "Post" WHERE id = ${postId} FOR UPDATE
    `;
    const existingAssignedEditorId = locked[0]?.assignedEditorId ?? null;

    let resolved: number | null = null;

    if (keepExisting && existingAssignedEditorId) {
      const existing = await tx.user.findUnique({
        where: { id: existingAssignedEditorId },
        select: { banned: true },
      });
      if (!existing?.banned) resolved = existingAssignedEditorId;
    }

    if (!resolved && preferredEditorId) {
      const valid = await tx.$queryRaw<{ editorId: number }[]>`
        SELECT esa."editorId" FROM "EditorSectionAssignment" esa
        INNER JOIN "User" u ON u.id = esa."editorId" AND u.banned = false
        WHERE esa."editorId" = ${preferredEditorId} AND esa."sectionId" = ${sectionId}
      `;
      if (valid.length > 0) resolved = preferredEditorId;
    }

    if (!resolved) {
      const editorCounts = await tx.$queryRaw<{ editorId: number; cnt: bigint }[]>`
        SELECT esa."editorId", COUNT(p.id) AS cnt
        FROM "EditorSectionAssignment" esa
        INNER JOIN "User" u ON u.id = esa."editorId" AND u.banned = false
        LEFT JOIN "Post" p
          ON p."assignedEditorId" = esa."editorId"
          AND p.status IN ('submitted','under_review','revision_requested')
        WHERE esa."sectionId" = ${sectionId}
        GROUP BY esa."editorId"
        ORDER BY cnt ASC
        LIMIT 1
      `;
      if (editorCounts.length > 0) resolved = editorCounts[0].editorId;
    }

    if (resolved !== null && resolved !== existingAssignedEditorId) {
      await tx.$executeRaw`UPDATE "Post" SET "assignedEditorId" = ${resolved} WHERE id = ${postId}`;
    }

    return resolved;
  });

  if (assignedEditorId === null) return null;

  // Notifications are best-effort and run outside the transaction — a
  // notification failure must never roll back a real assignment.
  try {
    const editorPrefs = await prisma.editorPreferences.findUnique({
      where: { editorId: assignedEditorId },
      select: { notifyOnSubmit: true },
    });
    if (editorPrefs && !editorPrefs.notifyOnSubmit) return assignedEditorId;

    const now = new Date();
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const timeStr = `${h % 12 || 12}:${m} ${ampm}`;

    await prisma.notification.upsert({
      where: {
        type_userId_recipientId_postId: {
          type: "NEW_POST",
          userId: authorId,
          recipientId: assignedEditorId,
          postId,
        },
      },
      update: { time: timeStr, unread: true },
      create: {
        type: "NEW_POST",
        userId: authorId,
        recipientId: assignedEditorId,
        postId,
        time: timeStr,
        group: "TODAY",
        unread: true,
        message: `New article for review: "${articleTitle ?? "Untitled"}"`,
      },
    }).catch((e) => console.error("[autoAssignEditor] notification upsert failed:", e));

    try {
      const { sendPushToUser } = await import("@/lib/fcm-send");
      await sendPushToUser(assignedEditorId, {
        title: "New article assigned",
        body: `"${articleTitle ?? "Untitled"}" is ready for review`,
        url: "/editor/queue",
      });
    } catch (e) {
      console.error("[autoAssignEditor] push notification failed:", e);
    }

    const editor = await prisma.user.findUnique({ where: { id: assignedEditorId }, select: { email: true, name: true } });
    if (editor?.email) {
      const { sendEditorAssignmentEmail } = await import("@/lib/circle-email-service");
      sendEditorAssignmentEmail({
        recipientEmail: editor.email,
        recipientName: editor.name ?? "Editor",
        articleTitle: articleTitle ?? "Untitled",
        authorName: authorName ?? "Author",
      }).catch((e) => console.error("[autoAssignEditor] assignment email failed:", e));
    }
  } catch (e) {
    console.error("[autoAssignEditor] notification block failed:", e);
  }

  return assignedEditorId;
}
