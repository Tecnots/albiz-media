import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/messages/search?conversationId=N&q=term
// Searches messages within a specific conversation
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const conversationId = Number(searchParams.get("conversationId")) || 0;
  const q = searchParams.get("q")?.trim() || "";

  if (!conversationId || !q) {
    return NextResponse.json({ results: [] });
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      text: { contains: q, mode: "insensitive" },
      // Skip JSON story-reply messages from search
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
