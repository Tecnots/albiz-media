import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { conversationId, userId, typing } = await req.json();
  if (!conversationId || (userId && authUser.id !== userId)) {
    return NextResponse.json({ error: "Missing or invalid conversationId or userId" }, { status: 400 });
  }

  // The caller passes their OWN conversation view (participantId = them).
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, participantId: authUser.id },
    select: { userId: true, participantId: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Unauthorized conversation" }, { status: 403 });
  }

  // A typing indicator must land on the OTHER participant's view — that is the
  // row the recipient polls. Writing it there (and bumping updatedAt) is what
  // makes "typing…" reach them in near real time (T-1).
  const mirror = await prisma.conversation.findFirst({
    where: { participantId: conv.userId, userId: conv.participantId ?? undefined },
    select: { id: true },
  });
  if (!mirror) {
    // No thread on the recipient's side yet (e.g. before the first message).
    return NextResponse.json({ ok: true });
  }

  const isStop = typing === false;
  await prisma.conversation.update({
    where: { id: mirror.id },
    data: isStop
      ? { typingUserId: null, typingAt: null }
      : { typingUserId: authUser.id, typingAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
