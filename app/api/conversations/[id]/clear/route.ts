import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// POST /api/conversations/[id]/clear — Clear all messages in a conversation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const conversationId = Number(id);

  // Verify the user owns this conversation
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participantId: true },
  });
  if (!conv || (conv.participantId && conv.participantId !== authUser.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft-delete all messages in this conversation view only
  await prisma.message.updateMany({
    where: { conversationId },
    data: { deleted: true, text: "" },
  });

  // Reset conversation metadata
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessage: "", unreadCount: 0 },
  });

  return NextResponse.json({ ok: true });
}
