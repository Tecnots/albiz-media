import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";

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

  // Read post info for permission check and notification copy.
  // The permission check here is optimistic — the atomic UPDATE below is the real status guard.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      status: true,
      sectionId: true,
      userId: true,
      title: true,
      scheduleJobId: true,
      assignedEditorId: true,
    },
  });

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Editors must be assigned to the section to unschedule (canPublish not required)
  if (user.role === "EDITOR" && post.sectionId) {
    const assignment = await prisma.editorSectionAssignment.findUnique({
      where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
    }
  }

  // Atomic conditional update — the WHERE status='scheduled' filter is the real race guard.
  // If the cron worker published the article between the findUnique above and this point,
  // the UPDATE matches 0 rows and we return 409 without touching the published state.
  const updated = await prisma.$executeRaw`
    UPDATE "Post"
    SET status = 'approved', "publishAt" = NULL, "scheduleJobId" = NULL
    WHERE id = ${postId}
      AND status = 'scheduled'
  `;

  if (updated === 0) {
    return NextResponse.json(
      { error: "Article is no longer scheduled — it may have already been published" },
      { status: 409 }
    );
  }

  // Cancel the schedule job only AFTER the post has been safely transitioned.
  // Even if this update fails (job already consumed), the worker's idempotency guard
  // (WHERE scheduleJobId = post.scheduleJobId) will reject any late execution attempt
  // because scheduleJobId is now NULL on the post.
  if (post.scheduleJobId) {
    prisma.job.update({
      where: { id: post.scheduleJobId },
      data: { status: "dead", lastError: "Cancelled by editor" },
    }).catch(() => {});
  }

  await logActivity({
    eventType: "ARTICLE_UNSCHEDULED",
    userId: user.id,
    meta: JSON.stringify({ postId, cancelledJobId: post.scheduleJobId }),
  });

  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const timeStr = `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;

  prisma.notification.create({
    data: {
      type: "ARTICLE_PUBLISHED",
      userId: user.id,
      recipientId: post.userId,
      time: timeStr,
      group: "TODAY",
      unread: true,
      postId,
      message: `The scheduled publication of "${post.title ?? "your article"}" has been cancelled. It is back in Approved.`,
    },
  }).catch(() => {});

  import("@/lib/fcm-send").then(({ sendPushToUser }) =>
    sendPushToUser(post.userId, {
      title: "Schedule cancelled",
      body: `"${post.title ?? "Your article"}" has been unscheduled and is back in Approved.`,
      url: "/authors/my-articles",
    }).catch(() => {})
  ).catch(() => {});

  return NextResponse.json({ success: true, status: "approved" });
}