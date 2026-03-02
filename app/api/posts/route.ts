import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const posts = await prisma.post.findMany({
    include: { articleContent: true },
    orderBy: { id: "asc" },
  });

  // Transform to match frontend shape
  const transformed = posts.map(p => ({
    id: p.id,
    userId: p.userId,
    type: p.type.toLowerCase() as "post" | "article", // POST→post, ARTICLE→article
    content: p.content,
    title: p.title,
    description: p.description,
    date: p.date,
    time: p.time,
    image: p.image,
    tags: p.tags,
    stats: { views: p.views, likes: p.likes, comments: p.comments, shares: p.shares },
    articleContent: p.articleContent
      ? { paragraphs: p.articleContent.paragraphs }
      : undefined,
  }));

  return NextResponse.json(transformed);
}
