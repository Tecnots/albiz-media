import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { notifyAdmin } from "@/lib/admin-notifier";

const VALID_REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "Misinformation",
  "Inappropriate content",
  "Copyright violation",
  "Violence",
  "Other",
] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId)) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

  const { reason, description } = await request.json();
  if (!reason || !VALID_REASONS.includes(reason as any)) {
    return NextResponse.json({ error: "A valid reason is required" }, { status: 400 });
  }

  // Verify post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, title: true, content: true, userId: true, flagged: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Don't allow reporting your own content
  if (post.userId === authUser.id) {
    return NextResponse.json({ error: "You cannot report your own content" }, { status: 400 });
  }

  // Upsert: one report per user per post (update reason if already reported)
  const report = await prisma.contentReport.upsert({
    where: { postId_reporterId: { postId, reporterId: authUser.id } },
    create: {
      postId,
      reporterId: authUser.id,
      reason,
      description: description?.trim() || null,
      status: "PENDING",
    },
    update: {
      reason,
      description: description?.trim() || null,
      status: "PENDING",
    },
  });

  // Flag the post if not already flagged
  if (!post.flagged) {
    await prisma.post.update({
      where: { id: postId },
      data: { flagged: true, flagReason: reason },
    });
  }

  // Notify admin (fire-and-forget)
  notifyAdmin({
    type: "CONTENT_REPORT",
    title: "Content reported",
    message: `A post was reported for "${reason}"`,
    metadata: { postId, reportId: report.id, reporterId: authUser.id, reason },
  });

  logActivity({
    eventType: "CONTENT_REPORTED",
    userId: authUser.id,
    meta: `reported post #${postId} for "${reason}"`,
  });

  return NextResponse.json({ success: true });
}