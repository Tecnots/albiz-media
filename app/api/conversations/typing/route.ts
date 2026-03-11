import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { conversationId, userId } = await req.json();
  if (!conversationId || !userId) {
    return NextResponse.json({ error: "Missing conversationId or userId" }, { status: 400 });
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      typingUserId: userId,
      typingAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
