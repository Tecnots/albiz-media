import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import type { JobPayloads } from "@/lib/job-queue";

/**
 * Mirrors lib/workers/scheduled-publisher.ts (Article scheduled-publish) for
 * Shorts — previously Shorts had no scheduling capability at all; publish
 * was always immediate and manual (audit finding L-8 / M-13).
 */
export async function processScheduledShortPublish(
  payload: JobPayloads["publish-scheduled-short"]
): Promise<void> {
  const { shortId, scheduleJobId } = payload;

  // Atomic idempotency guard, same pattern as the Article worker: only
  // publish if this job is still the active schedule for this short.
  const updated = await prisma.$executeRaw`
    UPDATE "Short"
    SET status = 'published', "publishedAt" = NOW(), "scheduleJobId" = NULL
    WHERE id = ${shortId}
      AND status = 'scheduled'
      AND "scheduleJobId" = ${scheduleJobId}
  `;

  if (updated === 0) {
    console.log(`[SCHEDULED-SHORT-PUBLISH] No-op for short ${shortId} — already handled or superseded`);
    return;
  }

  // logActivity (not ShortActivity) since there is no human actor for an
  // automated scheduled publish — same pattern the Article worker uses.
  await logActivity({
    eventType: "SHORT_PUBLISHED",
    meta: JSON.stringify({ shortId, scheduled: true }),
  }).catch((e) => console.error("[scheduled-short-publisher] activity log failed:", e));

  const short = await prisma.short.findUnique({
    where: { id: shortId },
    select: { userId: true, title: true, user: { select: { email: true, name: true } } },
  });
  if (!short) return;

  const { notifyUploaderOfShortDecision } = await import("@/lib/workflow-notifications");
  await notifyUploaderOfShortDecision({
    shortId,
    actorId: short.userId,
    uploaderId: short.userId,
    uploaderEmail: short.user.email,
    uploaderName: short.user.name,
    shortTitle: short.title,
    decision: "published",
  }).catch((e) => console.error("[scheduled-short-publisher] notification failed:", e));
}

/** Called when a publish-scheduled-short job exhausts all attempts or dies as a zombie. */
export async function revertScheduledShortToApproved(
  payload: JobPayloads["publish-scheduled-short"]
): Promise<void> {
  const { shortId, scheduleJobId } = payload;

  const updated = await prisma.$executeRaw`
    UPDATE "Short"
    SET status = 'approved', "scheduleJobId" = NULL
    WHERE id = ${shortId}
      AND status = 'scheduled'
      AND "scheduleJobId" = ${scheduleJobId}
  `;

  if (updated === 0) return;

  await logActivity({
    eventType: "SHORT_PUBLISH_FAILED",
    meta: JSON.stringify({ shortId }),
  }).catch((e) => console.error("[scheduled-short-publisher] revert activity log failed:", e));

  const short = await prisma.short.findUnique({
    where: { id: shortId },
    select: { userId: true, title: true, user: { select: { email: true, name: true } } },
  });
  if (!short) return;

  const { notifyUploaderOfShortDecision } = await import("@/lib/workflow-notifications");
  await notifyUploaderOfShortDecision({
    shortId,
    actorId: short.userId,
    uploaderId: short.userId,
    uploaderEmail: short.user.email,
    uploaderName: short.user.name,
    shortTitle: short.title,
    decision: "unpublished",
  }).catch((e) => console.error("[scheduled-short-publisher] revert notification failed:", e));
}
