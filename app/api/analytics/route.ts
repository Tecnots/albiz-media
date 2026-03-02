import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [stats, views, topPosts, snapshot] = await Promise.all([
    prisma.analyticsStat.findMany({ orderBy: { id: "asc" } }),
    prisma.viewOverTime.findMany({ orderBy: { id: "asc" } }),
    prisma.topPost.findMany({ orderBy: { id: "asc" } }),
    prisma.quickSnapshot.findMany({ orderBy: { id: "asc" } }),
  ]);

  return NextResponse.json({ stats, views, topPosts, snapshot });
}
