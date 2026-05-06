import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/social/threads/[id]/messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const messages = await prisma.socialMessage.findMany({
      where: { threadId: Number(id) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    return NextResponse.json(
      { messages: [], error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
