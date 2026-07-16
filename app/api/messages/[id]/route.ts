import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { messagePreview } from "@/lib/message-preview";

// Recompute a conversation's last-message preview from its newest surviving
// message. Called after an edit/delete so the list preview never goes stale
// (and the resulting Conversation write bumps updatedAt for propagation).
async function refreshConversationPreview(conversationId: number) {
  const latest = await prisma.message.findFirst({
    where: { conversationId, deleted: false },
    orderBy: { id: "desc" },
    select: { text: true, encrypted: true, time: true, attachmentType: true, attachmentName: true, attachmentUrl: true },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: latest ? messagePreview(latest) : "",
      ...(latest ? { time: latest.time } : {}),
    },
  });
}

// PATCH /api/messages/[id] — Edit message text
// Accepts plaintext or re-encrypted content for encrypted messages.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const messageId = Number(id);
  if (isNaN(messageId)) {
    return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
  }

  const { text, encrypted, iv, msgIndex, ratchetPublicKey } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (encrypted === true && !iv) {
    return NextResponse.json({ error: "IV required for encrypted messages" }, { status: 400 });
  }

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the original sender may edit their own messages
  if (msg.senderId !== authUser.id) {
    return NextResponse.json({ error: "Can only edit own messages" }, { status: 403 });
  }

  // Edits allowed within 15 minutes of creation
  const ageMs = Date.now() - new Date(msg.createdAt).getTime();
  if (ageMs > 15 * 60 * 1000) {
    return NextResponse.json({ error: "Can only edit messages within 15 minutes" }, { status: 400 });
  }

  // Build the update — carry through all encryption metadata
  const updateData: Record<string, unknown> = {
    text: text.trim(),
    edited: true,
    editedAt: new Date(),
  };
  if (encrypted !== undefined)        updateData.encrypted        = encrypted;
  if (iv !== undefined)               updateData.iv               = iv;
  if (msgIndex !== undefined)         updateData.msgIndex         = msgIndex;
  if (ratchetPublicKey !== undefined) updateData.ratchetPublicKey = ratchetPublicKey;

  await prisma.message.update({
    where: { id: messageId },
    data: updateData,
  });

  // Mirror the edit to the other participant's conversation view
  const conv = await prisma.conversation.findUnique({
    where: { id: msg.conversationId },
    select: { participantId: true, userId: true },
  });
  let mirrorConvoId: number | null = null;
  if (conv) {
    const mirrorConvo = await prisma.conversation.findFirst({
      where: { participantId: conv.userId, userId: conv.participantId ?? undefined },
      select: { id: true },
    });
    if (mirrorConvo) {
      mirrorConvoId = mirrorConvo.id;
      await prisma.message.updateMany({
        where: {
          conversationId: mirrorConvo.id,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        },
        data: updateData,
      });
    }
  }

  // Keep both list previews in sync with the edit.
  await refreshConversationPreview(msg.conversationId);
  if (mirrorConvoId) await refreshConversationPreview(mirrorConvoId);

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
  if (isNaN(messageId)) {
    return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
  }

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (msg.senderId !== authUser.id) {
    return NextResponse.json({ error: "Can only delete own messages" }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { deleted: true, text: "", encrypted: false, iv: null },
  });

  // Mirror the deletion to the other participant's conversation view
  const conv = await prisma.conversation.findUnique({
    where: { id: msg.conversationId },
    select: { participantId: true, userId: true },
  });
  let mirrorConvoId: number | null = null;
  if (conv) {
    const mirrorConvo = await prisma.conversation.findFirst({
      where: { participantId: conv.userId, userId: conv.participantId ?? undefined },
      select: { id: true },
    });
    if (mirrorConvo) {
      mirrorConvoId = mirrorConvo.id;
      await prisma.message.updateMany({
        where: {
          conversationId: mirrorConvo.id,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        },
        data: { deleted: true, text: "", encrypted: false, iv: null },
      });
    }
  }

  // A deleted latest message must drop out of both list previews.
  await refreshConversationPreview(msg.conversationId);
  if (mirrorConvoId) await refreshConversationPreview(mirrorConvoId);

  return NextResponse.json({ ok: true });
}
