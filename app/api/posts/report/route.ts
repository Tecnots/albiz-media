import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { notifyAdmin } from "@/lib/admin-notifier";
import { logActivity } from "@/lib/activity-logger";

/**
 * This endpoint previously only flipped Post.flagged/flagReason directly and
 * never wrote a ContentReport row, no self-report guard, no dedupe — so
 * content flagged only through this path was hidden from the public feed
 * but invisible to the admin content-reports queue, which is driven off
 * ContentReport rows (audit finding M-6). It now shares the same
 * ContentReport-backed logic as /api/posts/[id]/report.
 */
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { postId, reason } = await request.json();

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      select: { id: true, title: true, userId: true, flagged: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.userId === authUser.id) {
      return NextResponse.json({ error: "You cannot report your own content" }, { status: 400 });
    }

    const reportReason = (reason || "Other").toString().slice(0, 200);

    const report = await prisma.contentReport.upsert({
      where: { postId_reporterId: { postId: post.id, reporterId: authUser.id } },
      create: { postId: post.id, reporterId: authUser.id, reason: reportReason, status: "PENDING" },
      update: { reason: reportReason, status: "PENDING" },
    });

    if (!post.flagged) {
      await prisma.post.update({
        where: { id: post.id },
        data: { flagged: true, flagReason: reportReason },
      });
    }

    // Notify admin
    await notifyAdmin({
      type: "CONTENT_REPORT",
      title: "Post reported",
      message: post.title
        ? `Post "${post.title}" was reported — ${reportReason}`
        : `A post was reported — ${reportReason}`,
      metadata: { postId: post.id, reportId: report.id, reportedBy: authUser.id, reason: reportReason },
    });

    logActivity({
      eventType: "CONTENT_REPORTED",
      userId: authUser.id,
      meta: `reported post #${post.id} for "${reportReason}"`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[posts/report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
