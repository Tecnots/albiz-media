import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);

    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { articleContent: true, section: true, user: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    let finalImage = post.image;
    if (finalImage && blobStorageService.isAvailable) {
      const blobName = blobStorageService.extractBlobName(finalImage);
      if (blobName) finalImage = blobStorageService.getFileUrl(blobName);
    }

    let avatarUrl = post.user.avatar;
    if (avatarUrl && blobStorageService.isAvailable) {
      const blobName = blobStorageService.extractBlobName(avatarUrl);
      if (blobName) avatarUrl = blobStorageService.getFileUrl(blobName);
    }

    return NextResponse.json({
      id: post.id,
      userId: post.userId,
      type: post.type.toLowerCase() as "post" | "article",
      content: post.content,
      title: post.title,
      description: post.description,
      date: post.date,
      time: post.time,
      image: finalImage,
      tags: post.tags,
      status: post.status,
      sectionId: post.sectionId ?? null,
      sectionName: post.section?.name ?? null,
      sectionColor: post.section?.color ?? null,
      slug: post.slug,
      seoDescription: post.seoDescription,
      language: post.language ?? "en",
      stats: { views: post.views, likes: post.likes, comments: post.comments, shares: post.shares },
      articleContent: post.articleContent
        ? { paragraphs: post.articleContent.paragraphs }
        : undefined,
      user: {
        id: post.user.id,
        name: post.user.name,
        handle: post.user.handle,
        avatar: avatarUrl,
        title: post.user.title || "",
        verified: post.user.verified,
        isPremium: post.user.isPremium,
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
