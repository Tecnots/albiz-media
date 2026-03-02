import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const posts = await prisma.circlePost.findMany({
    include: { member: true },
    orderBy: { id: "asc" },
  });

  // Transform to match frontend shape
  const transformed = posts.map(p => ({
    memberId: p.memberId,
    content: p.content,
    image: p.image,
    stats: { likes: p.likes, comments: p.comments },
  }));

  return NextResponse.json(transformed);
}
