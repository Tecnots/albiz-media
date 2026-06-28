import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import type { JobPayloads } from "@/lib/job-queue";

export async function processScheduledPublish(
  payload: JobPayloads["publish-scheduled-article"]
): Promise<void> {
  const { postId, scheduleJobId } = payload;

  // Atomic idempotency guard: only publish if this job is still the active schedule.
  // If the article was rescheduled, unscheduled, or already published, the WHERE
  // clause will match 0 rows and we silently abort.
  const updated = await prisma.$executeRaw`
    UPDATE "Post"
    SET status = 'published', "publishAt" = NULL, "scheduleJobId" = NULL
    WHERE id = ${postId}
      AND status = 'scheduled'
      AND "scheduleJobId" = ${scheduleJobId}
  `;

  if (updated === 0) {
    console.log(`[SCHEDULED-PUBLISH] No-op for post ${postId} — already handled or superseded`);
    return;
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      userId: true,
      title: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!post) return;

  const title = post.title ?? "Your article";

  await logActivity({
    eventType: "ARTICLE_PUBLISHED",
    userId: post.userId,
    meta: JSON.stringify({ postId, scheduled: true }),
  });

  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const timeStr = `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;

  await prisma.notification.create({
    data: {
      type: "ARTICLE_PUBLISHED",
      userId: post.userId,
      recipientId: post.userId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      postId,
      message: `"${title}" has been published as scheduled.`,
    },
  }).catch(() => {});

  try {
    const { sendPushToUser } = await import("@/lib/fcm-send");
    await sendPushToUser(post.userId, {
      title: "Article published",
      body: `"${title}" went live as scheduled.`,
      url: `/article/${postId}`,
    });
  } catch { /* non-critical */ }

  if (post.user.email) {
    const { enqueueEmail } = await import("@/lib/job-queue");
    await enqueueEmail({
      to: post.user.email,
      subject: `"${title}" is now live`,
      html: `<p>Hi ${post.user.name ?? "there"},</p><p>Your article <strong>"${title}"</strong> has been published as scheduled.</p>`,
      templateKey: "article-published",
    });
  }
}

// Called when a publish-scheduled-article job exhausts all attempts.
// Atomically reverts the article back to approved so an editor can reschedule.
export async function revertScheduledArticleToApproved(
  payload: JobPayloads["publish-scheduled-article"]
): Promise<void> {
  const { postId, scheduleJobId } = payload;

  const updated = await prisma.$executeRaw`
    UPDATE "Post"
    SET status = 'approved', "publishAt" = NULL, "scheduleJobId" = NULL
    WHERE id = ${postId}
      AND status = 'scheduled'
      AND "scheduleJobId" = ${scheduleJobId}
  `;

  if (updated === 0) return;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, title: true },
  });
  if (!post) return;

  const title = post.title ?? "Your article";

  await logActivity({
    eventType: "ARTICLE_PUBLISH_FAILED",
    userId: post.userId,
    meta: JSON.stringify({ postId }),
  });

  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const timeStr = `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;

  await prisma.notification.create({
    data: {
      type: "ARTICLE_PUBLISHED",
      userId: post.userId,
      recipientId: post.userId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      postId,
      message: `"${title}" could not be published on schedule. It's been moved back to Approved.`,
    },
  }).catch(() => {});

  try {
    const { sendPushToUser } = await import("@/lib/fcm-send");
    await sendPushToUser(post.userId, {
      title: "Publish failed",
      body: `"${title}" could not be published on schedule. Please reschedule.`,
      url: "/authors/my-articles",
    });
  } catch { /* non-critical */ }
}