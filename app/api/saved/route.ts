import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [collections, savedPosts] = await Promise.all([
    prisma.savedCollection.findMany({ orderBy: { id: "asc" } }),
    prisma.savedPost.findMany({ include: { post: true }, orderBy: { id: "asc" } }),
  ]);

  return NextResponse.json({
    collections,
    posts: savedPosts.map(sp => sp.postId),
  });
}
