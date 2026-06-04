import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { sendNewPostEmail } from "@/lib/circle-email-service";

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const userIdParam = request.nextUrl.searchParams.get("userId");
  // Use raw SQL for status filter since Prisma client cache may not know about the field.
  let postIds: number[] | null = null;
  if (statusParam === "all" && userIdParam) {
    // All posts for a specific user (author studio)
    const uid = Number(userIdParam);
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE "userId" = ${uid}`;
    postIds = rows.map(r => r.id);
    if (!postIds.length) return NextResponse.json([]);
  } else if (statusParam === "drafts" && userIdParam) {
    const uid = Number(userIdParam);
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE status = 'draft' AND "userId" = ${uid}`;
    postIds = rows.map(r => r.id);
    if (!postIds.length) return NextResponse.json([]);
  } else if (userIdParam && statusParam !== "all") {
    // Published posts for a specific user
    const uid = Number(userIdParam);
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE (status = 'published' OR status IS NULL) AND "userId" = ${uid}`;
    postIds = rows.map(r => r.id);
    if (!postIds.length) return NextResponse.json([]);
  } else if (statusParam !== "all") {
    // All published posts (feed)
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE status = 'published' OR status IS NULL`;
    postIds = rows.map(r => r.id);
  }
  const posts = await prisma.post.findMany({
    where: postIds ? { id: { in: postIds } } : {},
    include: { articleContent: true, section: true },
    orderBy: { id: "desc" },
  });

  // Transform to match frontend shape
  const transformed = posts.map(p => {
    let finalImage = p.image;
    if (finalImage && blobStorageService.isAvailable) {
      const blobName = blobStorageService.extractBlobName(finalImage);
      if (blobName) finalImage = blobStorageService.getFileUrl(blobName);
    }

    return {
      id: p.id,
      userId: p.userId,
      type: p.type.toLowerCase() as "post" | "article", // POST→post, ARTICLE→article
      content: p.content,
      title: p.title,
      description: p.description,
      date: p.date,
      time: p.time,
      image: finalImage,
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
    };
  });

  return NextResponse.json(transformed);
}

// Create a new post (used by admin news editor)
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const body = await request.json();
    const userId = authUser.id;
    const { type, title, description, content, image, tags, articleParagraphs, status, slug, seoDescription, sectionId, language } = body;

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
        language: language || "en",
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

    // Notify followers if this is a published post by a CIRCLE user
    const finalStatus = status || "published";
    if (finalStatus === "published") {
      try {
        const author = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, name: true, handle: true },
        });
        if (author?.role === "CIRCLE") {
          const postPreview = (title || content || "").slice(0, 80);
          const postImage = image || "";

          // Push notifications — filtered by follower's push.posts preference
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage", "postId")
            SELECT 'NEW_POST', ${userId}, uf."followerId", NOW(), 'TODAY', true, ${postPreview}, ${postImage}, ${post.id}
            FROM "UserFollow" uf
            JOIN "User" u ON u.id = uf."followerId"
            WHERE uf."followingId" = ${userId}
              AND (
                u."notificationPrefs" IS NULL
                OR u."notificationPrefs"->'push'->>'posts' IS NULL
                OR (u."notificationPrefs"->'push'->>'posts')::boolean = true
              )
            ON CONFLICT (type, "userId", "recipientId", "postId") DO NOTHING
          `;

          // Email notifications — followers who have email.posts enabled
          const emailFollowers = await prisma.$queryRaw<{ email: string; name: string }[]>`
            SELECT u.email, u.name
            FROM "UserFollow" uf
            JOIN "User" u ON u.id = uf."followerId"
            WHERE uf."followingId" = ${userId}
              AND u.email IS NOT NULL
              AND (
                u."notificationPrefs" IS NULL
                OR u."notificationPrefs"->'email'->>'posts' IS NULL
                OR (u."notificationPrefs"->'email'->>'posts')::boolean = true
              )
          `;
          // Fire-and-forget — don't block the response
          Promise.allSettled(
            emailFollowers.map(f =>
              sendNewPostEmail({
                recipientEmail: f.email,
                recipientName: f.name,
                authorName: author.name,
                authorHandle: author.handle,
                postPreview,
                postImage: postImage || undefined,
                postId: post.id,
              })
            )
          ).catch(() => {});
        }
      } catch (notifErr) {
        console.error("Error creating new post notifications:", notifErr);
      }
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
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const body = await request.json();
    const {
      postId, content, title, description, image, status,
      tags, seoDescription, sectionId, language,
      articleParagraphs,
    } = body;
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (content !== undefined) updates.content = content;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (image !== undefined) updates.image = image;
    if (tags !== undefined) updates.tags = tags;
    if (seoDescription !== undefined) updates.seoDescription = seoDescription ?? null;
    if (sectionId !== undefined) updates.sectionId = sectionId ?? null;
    if (language !== undefined) updates.language = language;

    if (Object.keys(updates).length > 0) {
      await prisma.post.update({ where: { id: postId }, data: updates });
    }

    // Status via raw SQL
    if (status) {
      await prisma.$executeRaw`UPDATE "Post" SET status = ${status} WHERE id = ${postId}`;
    }

    // Update article body content
    if (articleParagraphs?.length) {
      const existing = await prisma.articleContent.findUnique({ where: { postId } });
      if (existing) {
        await prisma.articleContent.update({ where: { postId }, data: { paragraphs: articleParagraphs } });
      } else {
        await prisma.articleContent.create({ data: { postId, paragraphs: articleParagraphs } });
      }
    }

    return NextResponse.json({ success: true, id: postId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete a post
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
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
