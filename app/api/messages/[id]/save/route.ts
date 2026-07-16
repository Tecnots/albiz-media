import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

async function getMessageAndVerifyOwnership(messageId: number, authUserId: number) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversation: { select: { userId: true, participantId: true } },
    },
  });
  if (!message) return null;
  const { userId, participantId } = message.conversation;
  if (authUserId !== userId && authUserId !== participantId) return null;
  return message;
}

// POST — Save/bookmark a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const messageId = Number(id);
  if (isNaN(messageId)) return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });

  const message = await getMessageAndVerifyOwnership(messageId, authUser.id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.message.update({
    where: { id: messageId },
    data: { savedByUser: authUser.id, savedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — Unsave a message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const messageId = Number(id);
  if (isNaN(messageId)) return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });

  const message = await getMessageAndVerifyOwnership(messageId, authUser.id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.message.update({
    where: { id: messageId },
    data: { savedByUser: null, savedAt: null },
  });

  return NextResponse.json({ ok: true });
}
