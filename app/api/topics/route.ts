import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const topics = await prisma.contentTopic.findMany();
  return NextResponse.json(topics);
}
