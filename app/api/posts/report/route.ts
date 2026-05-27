import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { notifyAdmin } from "@/lib/admin-notifier";

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
      select: { id: true, title: true, userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Mark post as flagged
    await prisma.post.update({
      where: { id: Number(postId) },
      data: {
        flagged: true,
        flagReason: reason || "Reported by user",
      },
    });

    // Notify admin
    await notifyAdmin({
      type: "CONTENT_REPORT",
      title: "Post reported",
      message: post.title
        ? `Post "${post.title}" was reported — ${reason || "no reason given"}`
        : `A post was reported — ${reason || "no reason given"}`,
      metadata: { postId: post.id, reportedBy: authUser.id, reason },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
