import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    include: { messages: { orderBy: { id: "asc" } } },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(conversations);
}
