import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const featured = searchParams.get("featured") === "true";
    const flagged = searchParams.get("flagged") === "true";
    const search = searchParams.get("search");

    const where: any = {};
    if (type && type !== "All") {
      where.type = type.toUpperCase() === "ARTICLES" ? "ARTICLE" : "POST";
    }
    if (featured) where.featured = true;
    if (flagged) where.flagged = true;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            avatar: true,
            role: true,
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    // Map to the format expected by the frontend
    const formattedPosts = posts.map(post => ({
      id: post.id,
      userId: post.userId,
      userName: post.user.name,
      avatar: post.user.avatar,
      type: post.type,
      title: post.title,
      content: post.content,
      date: post.date,
      image: post.image,
      tags: post.tags,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      status: post.status,
      featured: post.featured,
      pinned: post.pinned,
      flagged: post.flagged,
      flagReason: post.flagReason,
    }));

    return NextResponse.json(formattedPosts);
  } catch (error) {
    console.error("Admin Posts GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { postId, action } = body;

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    let data: any = {};
    switch (action) {
      case "feature":
        data.featured = true;
        break;
      case "unfeature":
        data.featured = false;
        break;
      case "pin":
        data.pinned = true;
        break;
      case "unpin":
        data.pinned = false;
        break;
      case "dismiss-flag":
        data.flagged = false;
        data.flagReason = null;
        data.status = "published";
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updatedPost = await prisma.post.update({
      where: { id: Number(postId) },
      data,
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error("Admin Posts PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { postId, reason } = body;

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    // 1. Fetch post details before deletion to notify the user
    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      select: { userId: true, title: true, content: true, image: true }
    });

    if (post) {
      // 2. Create notification for the user
      await prisma.notification.create({
        data: {
          type: "POST_REMOVED" as any, // Cast because of recent schema change
          userId: 13, // Albiz Admin user ID from seed data
          recipientId: post.userId,
          time: new Date().toISOString(),
          group: "TODAY",
          unread: true,
          postPreview: post.title || post.content?.substring(0, 50) || "content",
          postImage: post.image,
          message: reason || "Your post was removed for violating community guidelines."
        }
      });
    }

    // 3. Delete the post
    await prisma.post.delete({
      where: { id: Number(postId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin Posts DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
