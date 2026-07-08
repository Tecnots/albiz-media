import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { conversationId, userId } = await req.json();
  if (!conversationId || (userId && authUser.id !== userId)) {
    return NextResponse.json({ error: "Missing or invalid conversationId or userId" }, { status: 400 });
  }

  // Verify user is a participant in this conversation
  const conv = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ participantId: authUser.id }, { userId: authUser.id }],
    },
  });

  if (!conv) {
    return NextResponse.json({ error: "Unauthorized conversation" }, { status: 403 });
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      typingUserId: authUser.id,
      typingAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
