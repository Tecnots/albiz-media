import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

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
  if (!["request_revision", "approve", "note_only"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, sectionId: true, userId: true, status: true, title: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Verify editor covers this section
    if (post.sectionId) {
      const assignment = await prisma.editorSectionAssignment.findUnique({
        where: { editorId_sectionId: { editorId: user.id, sectionId: post.sectionId } },
      });
      if (!assignment) {
        return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
      }
    }

    const newStatus = action === "request_revision" ? "revision_requested"
      : action === "approve" ? "approved"
      : post.status; // note_only leaves status unchanged

    if (action !== "note_only") {
      await prisma.post.update({
        where: { id: postId },
        data: { status: newStatus, assignedEditorId: user.id },
      });
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

    // Record editorial activity (append-only audit log).
    // note_only only counts as activity when a note was actually written.
    if (action !== "note_only" || createdNote) {
      try {
        await prisma.editorActivity.create({
          data: {
            editorId: user.id,
            postId,
            action: action === "note_only" ? "note" : action,
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

    return NextResponse.json({ success: true, status: newStatus, note: createdNote });
  } catch (err) {
    console.error("[editor/article/review POST]", err);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
