import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const shorts = await prisma.short.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      videoUrl: true,
      views: true,
      likes: true,
      shares: true,
      publishedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatar: true,
          verified: true,
          country: true,
        },
      },
    },
  });

  return NextResponse.json({ shorts });
}