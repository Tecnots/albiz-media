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
  if (user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { postId: postIdStr } = await params;
  const postId = parseInt(postIdStr);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const { action, note, type, priority } = await req.json();
  if (!["start_review", "request_revision", "approve", "note_only"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, sectionId: true, userId: true, status: true, title: true, assignedEditorId: true, user: { select: { email: true, name: true } } },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    if (post.assignedEditorId !== user.id) {
      return NextResponse.json({ error: "You are not assigned to review this article" }, { status: 403 });
    }

    // Verify editor covers this section
    let assignment: { editorId: number; sectionId: number; canPublish: boolean } | null = null;
    if (post.sectionId) {
      assignment = await prisma.editorSectionAssignment.findUnique({
        where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
      });
      if (!assignment) {
        return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
      }
    }

    const newStatus = action === "start_review" ? "under_review"
      : action === "request_revision" ? "revision_requested"
      : action === "approve" ? "approved"
      : post.status; // note_only leaves status unchanged

    if (action !== "note_only") {
      try {
        await transitionPostState(
          post.id,
          user.id,
          user.role,
          post.status,
          newStatus,
          post.assignedEditorId,
          assignment ? assignment.canPublish : false,
          user.canPost || false,
          action
        );
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
    }

    let createdNote = null;
    if (note?.trim()) {
      const validTypes = ["general", "factual", "style", "grammar", "structure"];
      const noteType = validTypes.includes(type) ? type : "general";
      const notePriority = priority === "major" ? "major" : "minor";
      createdNote = await prisma.editorNote.create({
        data: {
          postId,
          editorId: user.id,
          note: note.trim(),
          type: noteType,
          priority: notePriority,
        },
        select: {
          id: true, note: true, type: true, priority: true, createdAt: true, resolvedAt: true,
          editor: { select: { id: true, name: true, avatar: true } },
        },
      });
    }

    // Record editorial activity for note_only actions (status transitions are logged by the state machine).
    if (action === "note_only" && createdNote) {
      try {
        await prisma.editorActivity.create({
          data: {
            editorId: user.id,
            postId,
            action: "note",
          },
        });
      } catch {
        // Activity logging is non-critical
      }
    }

    if (action === "note_only") {
      return NextResponse.json({ success: true, status: post.status, note: createdNote });
    }

    // Notify the author
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    const timeStr = `${displayHour}:${minutes} ${ampm}`;

    const message =
      action === "request_revision"
        ? `Your article "${post.title ?? "Untitled"}" needs revisions`
        : `Your article "${post.title ?? "Untitled"}" has been approved`;

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
        update: { time: timeStr, unread: true, message },
        create: {
          type: "NEW_POST",
          userId: user.id,
          recipientId: post.userId,
          postId: post.id,
          time: timeStr,
          group: "TODAY",
          unread: true,
          message,
        },
      });
    } catch {
      // Notification is non-critical
    }

    // Push notification to author (fire-and-forget)
    try {
      const { sendPushToUser } = await import("@/lib/fcm-send");
      await sendPushToUser(post.userId, {
        title: action === "request_revision" ? "Revision requested" : "Article approved",
        body: message,
        url: "/authors/my-articles",
      });
    } catch {
      // Push is non-critical
    }

    // Email notification to author (fire-and-forget)
    if ((action === "request_revision" || action === "approve") && post.user?.email) {
      sendEditorialNotificationEmail({
        recipientEmail: post.user.email,
        recipientName: post.user.name ?? "Author",
        type: action === "request_revision" ? "revision_requested" : "approved",
        articleTitle: post.title ?? "Untitled",
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, status: newStatus, note: createdNote });
  } catch (err) {
    console.error("[editor/article/review POST]", err);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
