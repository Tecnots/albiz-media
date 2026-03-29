import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const userIdParam = request.nextUrl.searchParams.get("userId");
  // Use raw SQL for status filter since Prisma client cache may not know about the field.
  let postIds: number[] | null = null;
  if (statusParam === "drafts" && userIdParam) {
    // Return only drafts for a specific user
    const uid = Number(userIdParam);
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE status = 'draft' AND "userId" = ${uid}`;
    postIds = rows.map(r => r.id);
    if (!postIds.length) return NextResponse.json([]);
  } else if (statusParam !== "all") {
    // Default: published only
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE status = 'published' OR status IS NULL`;
    postIds = rows.map(r => r.id);
  }
  const posts = await prisma.post.findMany({
    where: postIds ? { id: { in: postIds } } : {},
    include: { articleContent: true, section: true },
    orderBy: { id: "desc" },
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
    status: p.status,
    sectionId: p.sectionId ?? null,
    sectionName: p.section?.name ?? null,
    sectionColor: p.section?.color ?? null,
    slug: p.slug,
    seoDescription: p.seoDescription,
    stats: { views: p.views, likes: p.likes, comments: p.comments, shares: p.shares },
    articleContent: p.articleContent
      ? { paragraphs: p.articleContent.paragraphs }
      : undefined,
  }));

  return NextResponse.json(transformed);
}

// Create a new post (used by admin news editor)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, title, description, content, image, tags, articleParagraphs, status, slug, seoDescription, sectionId } = body;

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Get next available ID
    const maxPost = await prisma.post.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    const nextId = (maxPost?.id || 0) + 1;

    // Format date
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = now.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
    const date = `${months[now.getMonth()]} ${day}${suffix} ${now.getFullYear()}`;
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const time = `${hours % 12 || 12}:${minutes} ${ampm}`;

    const postType = (type || "article").toUpperCase() as "POST" | "ARTICLE";

    const post = await prisma.post.create({
      data: {
        id: nextId,
        userId,
        type: postType,
        title: title || null,
        description: description || null,
        content: content || null,
        date,
        time,
        image: image || null,
        tags: tags || [],
        slug: slug?.trim() || null,
        seoDescription: seoDescription?.trim() || null,
        sectionId: sectionId ? Number(sectionId) : null,
      },
    });

    // Set status via raw SQL (Prisma client cache may not have this field)
    if (status && status !== "published") {
      await prisma.$executeRaw`UPDATE "Post" SET status = ${status} WHERE id = ${post.id}`;
    }

    // Create article content if paragraphs provided
    if (postType === "ARTICLE" && articleParagraphs?.length) {
      await prisma.articleContent.create({
        data: {
          postId: post.id,
          paragraphs: articleParagraphs,
        },
      });
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
      image: post.image,
      tags: post.tags,
      stats: { views: "0", likes: "0", comments: "0", shares: "0" },
    });
  } catch (err: any) {
    console.error("Post creation error:", err);
    return NextResponse.json({ error: err.message || "Failed to create post" }, { status: 500 });
  }
}

// Edit a post
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, content, title, image, status, date: dateField } = body;
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (content !== undefined) updates.content = content;
    if (title !== undefined) updates.title = title;
    if (image !== undefined) updates.image = image;
    if (dateField !== undefined) updates.date = dateField;

    if (Object.keys(updates).length > 0) {
      await prisma.post.update({ where: { id: postId }, data: updates });
    }
    // Status via raw SQL
    if (status) {
      await prisma.$executeRaw`UPDATE "Post" SET status = ${status} WHERE id = ${postId}`;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete a post
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId } = body;
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    await prisma.$executeRaw`DELETE FROM "PostComment" WHERE "postId" = ${postId}`;
    await prisma.$executeRaw`DELETE FROM "ArticleContent" WHERE "postId" = ${postId}`;
    await prisma.$executeRaw`DELETE FROM "SavedPost" WHERE "postId" = ${postId}`;
    await prisma.post.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
