import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET /api/messages/search?conversationId=N&q=term
// Searches plaintext messages within a conversation the authenticated user participates in.
// Encrypted messages are excluded from server-side search — they must be searched
// client-side after decryption.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { searchParams } = req.nextUrl;
  const conversationId = Number(searchParams.get("conversationId")) || 0;
  const q = searchParams.get("q")?.trim() || "";

  if (!conversationId || !q) {
    return NextResponse.json({ results: [] });
  }

  // Verify the authenticated user is a participant in the requested conversation (IDOR fix)
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, participantId: authUser.id },
  });
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      encrypted: false,  // ciphertext cannot be meaningfully searched server-side
      deleted: false,
      text: { contains: q, mode: "insensitive" },
      NOT: { text: { startsWith: "{" } },
    },
    orderBy: { id: "desc" },
    take: 50,
    select: {
      id: true,
      text: true,
      fromMe: true,
      senderId: true,
      createdAt: true,
      time: true,
    },
  });

  return NextResponse.json({ results: messages });
}
