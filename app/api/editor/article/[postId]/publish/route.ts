import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { transitionPostState } from "@/lib/editor-workflow";
import { sendEditorialNotificationEmail } from "@/lib/circle-email-service";

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
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, sectionId: true, userId: true, status: true, title: true, assignedEditorId: true, user: { select: { email: true, name: true } } },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    if (!post.sectionId) {
      return NextResponse.json({ error: "Article has no section" }, { status: 400 });
    }

    const assignment = await prisma.editorSectionAssignment.findUnique({
      where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
    }
    if (!assignment.canPublish) {
      return NextResponse.json({ error: "You do not have publish permission for this section" }, { status: 403 });
    }

    try {
      await transitionPostState(
        postId,
        user.id,
        user.role,
        post.status,
        "published",
        post.assignedEditorId,
        assignment.canPublish,
        user.canPost || false,
        "publish"
      );
    } catch (err: any) {
      console.error("[editor/article/publish] state transition failed:", err?.message);
      return NextResponse.json({ error: "Unable to publish this article. Please verify the article status and try again." }, { status: 403 });
    }



    // Notify author
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    const timeStr = `${displayHour}:${minutes} ${ampm}`;

    try {
      await prisma.notification.upsert({
        where: {
          type_userId_recipientId_postId: {
            type: "NEW_POST",
            userId: user.id,
            recipientId: post.userId,
            postId: post.id,
          },
        },
        update: { time: timeStr, unread: true, message: `Your article "${post.title ?? "Untitled"}" has been published` },
        create: {
          type: "NEW_POST",
          userId: user.id,
          recipientId: post.userId,
          postId: post.id,
          time: timeStr,
          group: "TODAY",
          unread: true,
          message: `Your article "${post.title ?? "Untitled"}" has been published`,
        },
      });
    } catch {
      // Non-critical
    }

    // Push notification to author (fire-and-forget)
    try {
      const { sendPushToUser } = await import("@/lib/fcm-send");
      await sendPushToUser(post.userId, {
        title: "Article published",
        body: `Your article "${post.title ?? "Untitled"}" is now live`,
        url: "/",
      });
    } catch {
      // Push is non-critical
    }

    // Email notification to author (fire-and-forget)
    if (post.user?.email) {
      sendEditorialNotificationEmail({
        recipientEmail: post.user.email,
        recipientName: post.user.name ?? "Author",
        type: "published",
        articleTitle: post.title ?? "Untitled",
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[editor/article/publish POST]", err);
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
