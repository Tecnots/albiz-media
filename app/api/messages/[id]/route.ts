import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// PATCH /api/messages/[id] — Edit message text
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const messageId = Number(id);
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.senderId !== authUser.id) {
    return NextResponse.json({ error: "Can only edit own messages" }, { status: 403 });
  }

  // Allow editing within 15 minutes
  const ageMs = Date.now() - new Date(msg.createdAt).getTime();
  if (ageMs > 15 * 60 * 1000) {
    return NextResponse.json({ error: "Can only edit messages within 15 minutes" }, { status: 400 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { text: text.trim(), edited: true, editedAt: new Date() },
  });

  // Also update the mirrored message in the other participant's conversation
  const conv = await prisma.conversation.findUnique({
    where: { id: msg.conversationId },
    select: { participantId: true, userId: true },
  });
  if (conv) {
    const mirrorConvo = await prisma.conversation.findFirst({
      where: { participantId: conv.userId, userId: conv.participantId ?? 0 },
    });
    if (mirrorConvo) {
      // Find the corresponding message by matching senderId + createdAt
      await prisma.message.updateMany({
        where: {
          conversationId: mirrorConvo.id,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        },
        data: { text: text.trim(), edited: true, editedAt: new Date() },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/messages/[id] — Soft-delete message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const messageId = Number(id);

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.senderId !== authUser.id) {
    return NextResponse.json({ error: "Can only delete own messages" }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { deleted: true, text: "" },
  });

  // Also soft-delete in the mirror conversation
  const conv = await prisma.conversation.findUnique({
    where: { id: msg.conversationId },
    select: { participantId: true, userId: true },
  });
  if (conv) {
    const mirrorConvo = await prisma.conversation.findFirst({
      where: { participantId: conv.userId, userId: conv.participantId ?? 0 },
    });
    if (mirrorConvo) {
      await prisma.message.updateMany({
        where: {
          conversationId: mirrorConvo.id,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        },
        data: { deleted: true, text: "" },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
