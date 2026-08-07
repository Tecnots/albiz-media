import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { id } = await params;
  const postId = Number(id);
  if (!postId || isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      articleContent: true,
      section: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Only the owner or an admin can fetch draft/non-published posts
  if (post.status !== "published" && authUser.role !== "ADMIN" && post.userId !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: post.id,
    userId: post.userId,
    type: post.type.toLowerCase(),
    title: post.title,
    description: post.description,
    content: post.content,
    date: post.date,
    time: post.time,
    image: blobStorageService.resolveMediaUrl(post.image),
    tags: post.tags,
    status: post.status,
    sectionId: post.sectionId ?? null,
    sectionName: post.section?.name ?? null,
    slug: post.slug,
    seoDescription: post.seoDescription,
    language: post.language ?? "en",
    articleParagraphs: post.articleContent?.paragraphs ?? [],
  });
}
