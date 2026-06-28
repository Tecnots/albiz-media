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
  const cutoff = new Date(Date.now() - 86_400_000);
  const { count } = await prisma.story.deleteMany({ where: { expiresAt: { lt: cutoff } } });
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