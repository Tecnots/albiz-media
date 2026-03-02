import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const topics = await prisma.trendingTopic.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(topics);
}
