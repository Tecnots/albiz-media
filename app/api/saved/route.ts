import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId")) || 0;

  const [collections, savedPosts] = await Promise.all([
    prisma.savedCollection.findMany({ orderBy: { id: "asc" } }),
    userId
      ? prisma.savedPost.findMany({ where: { userId }, select: { postId: true, collectionId: true } })
      : prisma.savedPost.findMany({ select: { postId: true }, orderBy: { id: "asc" } }),
  ]);

  const postIds = userId
    ? (savedPosts as any[]).map((r: any) => r.postId)
    : (savedPosts as any[]).map((sp: any) => sp.postId);

  // Fetch full post details for saved posts
  const posts = postIds.length > 0
    ? await prisma.post.findMany({
        where: { id: { in: postIds } },
        include: { articleContent: true, section: true },
      })
    : [];

  // Transform posts to match frontend shape
  const transformedPosts = posts.map(p => ({
    id: p.id,
    userId: p.userId,
    type: p.type.toLowerCase() as "post" | "article",
    content: p.content,
    title: p.title,
    description: p.description,
    date: p.date,
    time: p.time,
    image: p.image,
    tags: p.tags,
    status: p.status,
    sectionId: p.sectionId ?? null,
    sectionName: p.section?.name ?? null,
    sectionColor: p.section?.color ?? null,
    slug: p.slug,
    seoDescription: p.seoDescription,
    language: p.language ?? "en",
    stats: { views: p.views, likes: p.likes, comments: p.comments, shares: p.shares },
    articleContent: p.articleContent
      ? { paragraphs: p.articleContent.paragraphs }
      : undefined,
  }));

  // Map collectionId to each post
  const postsWithCollection = userId
    ? transformedPosts.map(post => {
        const saved = (savedPosts as any[]).find((s: any) => s.postId === post.id);
        return {
          ...post,
          collectionId: saved?.collectionId || null,
        };
      })
    : transformedPosts.map(post => ({ ...post, collectionId: null }));

  return NextResponse.json({ collections, posts: postsWithCollection });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, postId, collectionId } = await request.json();
    
    if (!userId || !postId) {
      return NextResponse.json({ error: "Missing userId or postId" }, { status: 400 });
    }

    await prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      update: { collectionId: collectionId || null },
      create: { userId, postId, collectionId: collectionId || null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Save post error:", err);
    return NextResponse.json({ error: err.message || "Failed to save post" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, postId } = await request.json();
    if (!userId || !postId) return NextResponse.json({ error: "Missing userId or postId" }, { status: 400 });

    await prisma.savedPost.deleteMany({
      where: { userId, postId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unsave post error:", err);
    return NextResponse.json({ error: err.message || "Failed to unsave post" }, { status: 500 });
  }
}
