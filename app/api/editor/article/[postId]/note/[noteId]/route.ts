import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; noteId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { postId: postIdStr, noteId: noteIdStr } = await params;
  const postId = parseInt(postIdStr);
  const noteId = parseInt(noteIdStr);
  if (isNaN(postId) || isNaN(noteId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { resolved } = await req.json();

  try {
    const note = await prisma.editorNote.findUnique({
      where: { id: noteId },
      select: { id: true, postId: true, editorId: true },
    });
    if (!note || note.postId !== postId) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Authors can mark resolved; editors can unresolve
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, title: true },
    });
    const isAuthor = user.id === post?.userId;
    const isEditor = user.role === "EDITOR" || user.role === "ADMIN";
    if (!isAuthor && !isEditor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.editorNote.update({
      where: { id: noteId },
      data: {
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? user.id : null,
      },
      select: { id: true, resolvedAt: true, resolvedBy: true },
    });

    // When an author resolves a note, notify the note's editor (if they opted in).
    if (resolved && isAuthor && note.editorId !== user.id) {
      try {
        const prefs = await prisma.editorPreferences.findUnique({
          where: { editorId: note.editorId },
          select: { notifyOnResolve: true },
        });
        if (!prefs || prefs.notifyOnResolve) {
          const now = new Date();
          const minutes = now.getMinutes().toString().padStart(2, "0");
          const ampm = now.getHours() >= 12 ? "PM" : "AM";
          const displayHour = now.getHours() % 12 || 12;
          const timeStr = `${displayHour}:${minutes} ${ampm}`;
          const resolveMsg = `${user.name ?? "An author"} resolved a note on "${post?.title ?? "Untitled"}"`;
          await prisma.notification.upsert({
            where: {
              type_userId_recipientId_postId: {
                type: "NEW_POST",
                userId: user.id,
                recipientId: note.editorId,
                postId,
              },
            },
            update: { time: timeStr, unread: true, message: resolveMsg },
            create: {
              type: "NEW_POST",
              userId: user.id,
              recipientId: note.editorId,
              postId,
              time: timeStr,
              group: "TODAY",
              unread: true,
              message: resolveMsg,
            },
          });
          try {
            const { sendPushToUser } = await import("@/lib/fcm-send");
            await sendPushToUser(note.editorId, {
              title: "Note resolved",
              body: resolveMsg,
              url: `/editor/review/${postId}`,
            });
          } catch { /* non-critical */ }
        }
      } catch {
        // Notification is non-critical
      }
    }

    return NextResponse.json({ success: true, note: updated });
  } catch (err) {
    console.error("[note/resolve PATCH]", err);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}
