import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { schedulePrePublishReminder } from "@/lib/alert-scheduler";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { postId: postIdStr } = await params;
  const postId = parseInt(postIdStr);
  if (isNaN(postId)) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { publishAt } = body as { publishAt?: string };

  if (!publishAt) {
    return NextResponse.json({ error: "publishAt is required" }, { status: 400 });
  }

  const publishDate = new Date(publishAt);
  if (isNaN(publishDate.getTime()) || publishDate <= new Date()) {
    return NextResponse.json({ error: "publishAt must be a valid future date" }, { status: 400 });
  }

  // Fetch post info for permission check and notification copy.
  // This read happens outside the transaction — the transaction re-verifies status atomically.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { status: true, sectionId: true, userId: true, title: true, scheduleJobId: true },
  });

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Permission: editors must have canPublish on this section
  if (user.role === "EDITOR") {
    if (!post.sectionId) {
      return NextResponse.json({ error: "Article has no section — cannot schedule" }, { status: 400 });
    }
    const assignment = await prisma.editorSectionAssignment.findUnique({
      where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
      select: { canPublish: true },
    });
    if (!assignment?.canPublish) {
      return NextResponse.json({ error: "You do not have publish permission for this section" }, { status: 403 });
    }
  }

  // Pre-generate the job ID so it can be embedded in the job payload before creation.
  // This makes the worker's idempotency guard self-referential without a second update.
  const jobId = randomUUID();
  const prevJobId = post.scheduleJobId;

  // CRITICAL: Single transaction guarantees the job row and the post status transition
  // are committed atomically. The cron worker cannot claim the job until the transaction
  // commits, at which point the post is already in 'scheduled' state — eliminating the
  // window where the worker could process a job against a still-'approved' post.
  try {
    await prisma.$transaction(async (tx) => {
      // Lock the post row for the duration of this transaction. Any concurrent schedule
      // or publish operation on the same post will block until we commit or rollback.
      const locked = await tx.$queryRaw<{ status: string }[]>(
        Prisma.sql`SELECT status FROM "Post" WHERE id = ${postId} FOR UPDATE`
      );

      if (!locked.length) throw new Error("NOT_FOUND");
      if (locked[0].status !== "approved") throw new Error("NOT_APPROVED");

      // Create the job with the pre-generated ID. The payload embeds the job ID so the
      // worker can verify it is still the authoritative job for this post.
      await tx.job.create({
        data: {
          id: jobId,
          type: "publish-scheduled-article",
          payload: { postId, scheduleJobId: jobId } as Prisma.InputJsonValue,
          maxAttempts: 3,
          priority: 10,
          scheduledAt: publishDate,
        },
      });

      // Transition the post inside the same transaction.
      await tx.$executeRaw`
        UPDATE "Post"
        SET status = 'scheduled', "publishAt" = ${publishDate}, "scheduleJobId" = ${jobId}
        WHERE id = ${postId}
      `;
    });
  } catch (err: any) {
    if (err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (err.message === "NOT_APPROVED") {
      return NextResponse.json(
        { error: "Article is no longer eligible for scheduling — status has changed" },
        { status: 409 }
      );
    }
    console.error("[schedule] Transaction failed:", err);
    return NextResponse.json({ error: "Failed to schedule article" }, { status: 500 });
  }

  // Schedule a pre-publish reminder to the author 1 hour before publication.
  // Fire-and-forget — never blocks or throws on the main response path.
  schedulePrePublishReminder(postId, publishDate, post.userId).catch((e) =>
    console.error("[schedule] pre-publish reminder failed:", e)
  );

  // Cancel the previous schedule job only after the transaction succeeds.
  // Fire-and-forget: a stale job that slips through is harmless because the worker's
  // idempotency guard checks scheduleJobId === post.scheduleJobId before publishing.
  if (prevJobId) {
    prisma.job.update({
      where: { id: prevJobId },
      data: { status: "dead", lastError: "Superseded by new schedule" },
    }).catch(() => {});
  }

  await logActivity({
    eventType: "ARTICLE_SCHEDULED",
    userId: user.id,
    meta: JSON.stringify({ postId, publishAt: publishDate.toISOString(), jobId }),
  });

  // Notifications — fire-and-forget, do not block the response
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const timeStr = `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;

  // Previously reused the "ARTICLE_PUBLISHED" type for a scheduling event
  // (audit finding L-7) — now uses its own type. Failures are now logged
  // instead of silently swallowed (audit finding M-11).
  prisma.notification.create({
    data: {
      type: "ARTICLE_SCHEDULED",
      userId: user.id,
      recipientId: post.userId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      postId,
      message: `"${post.title ?? "Your article"}" has been scheduled for publication.`,
    },
  }).catch((e) => console.error("[schedule] in-app notification failed:", e));

  import("@/lib/fcm-send").then(({ sendPushToUser }) =>
    sendPushToUser(post.userId, {
      title: "Article scheduled",
      body: `"${post.title ?? "Your article"}" will be published on ${publishDate.toLocaleDateString()}.`,
      url: "/authors/my-articles",
    }).catch((e) => console.error("[schedule] push notification failed:", e))
  ).catch((e) => console.error("[schedule] push import failed:", e));

  return NextResponse.json({ success: true, jobId, publishAt: publishDate.toISOString() });
}