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
  const posts: any[] = await prisma.post.findMany({
    where: postIds ? { id: { in: postIds } } : {},
    include: {
      articleContent: true,
      section: true,
      editorNotes: userIdParam
        ? {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              note: true,
              type: true,
              priority: true,
              resolvedAt: true,
              createdAt: true,
              editor: { select: { id: true, name: true, avatar: true } },
            },
          }
        : false,
    },
    orderBy: { id: "desc" },
  } as any);

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
      editorNotes: (p as any).editorNotes ?? [],
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
    const { type, title, description, content, image, tags: rawTags, articleParagraphs, status, slug, seoDescription, sectionId, language, contentScope, preferredEditorId } = body;

    // Auto-extract hashtags from content if no tags provided
    let tags = rawTags;
    if ((!tags || tags.length === 0) && content) {
      const plain = content.replace(/<[^>]*>/g, "");
      const extracted = (plain.match(/#(\w+)/g) ?? []).map((h: string) => h.slice(1));
      if (extracted.length > 0) tags = [...new Set(extracted)];
    }

    // Get next available ID
    const maxPost = await prisma.post.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    const nextId = (maxPost?.id || 0) + 1;

    // Resolve author's country for geo-tagging
    const authorRows = await prisma.$queryRaw<{ countryCode: string | null }[]>`
      SELECT "countryCode" FROM "User" WHERE id = ${userId}
    `.catch(() => []);
    const authorCountryCode = authorRows[0]?.countryCode ?? null;

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

    const validScopes = ["GLOBAL", "REGIONAL", "LOCAL"];
    let resolvedScope = validScopes.includes(contentScope) ? contentScope : "GLOBAL";

    // LOCAL/REGIONAL scope is meaningless without a country to scope to: the geo
    // filter would hide the post from everyone (including same-country viewers,
    // since the post itself has no country). Fall back to GLOBAL so it stays visible.
    if (resolvedScope !== "GLOBAL" && !authorCountryCode) {
      resolvedScope = "GLOBAL";
    }

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

    // Geo-tag via raw SQL (countryCode/contentScope fields added via migration)
    if (authorCountryCode || resolvedScope !== "GLOBAL") {
      await prisma.$executeRaw`
        UPDATE "Post"
        SET "countryCode" = ${authorCountryCode}, "contentScope" = ${resolvedScope}
        WHERE id = ${post.id}
      `.catch(() => {});
    }

    // Set status via raw SQL (Prisma client cache may not have this field)
    if (status) {
      if (status === "published" && !authUser.canPost && authUser.role !== "ADMIN") {
        await prisma.post.delete({ where: { id: post.id } }).catch(() => {});
        return NextResponse.json({ error: "You don't have permission to publish" }, { status: 403 });
      }
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

    // Auto-assign editor when submitted for review
    if (status === "submitted" && sectionId) {
      try {
        let assignedEditorId: number | null = null;

        if (preferredEditorId) {
          const valid = await prisma.$queryRaw<{ editorId: number }[]>`
            SELECT "editorId" FROM "EditorSectionAssignment"
            WHERE "editorId" = ${preferredEditorId} AND "sectionId" = ${Number(sectionId)}
          `;
          if (valid.length > 0) assignedEditorId = preferredEditorId;
        }

        if (!assignedEditorId) {
          const editorCounts = await prisma.$queryRaw<{ editorId: number; cnt: bigint }[]>`
            SELECT esa."editorId", COUNT(p.id) AS cnt
            FROM "EditorSectionAssignment" esa
            LEFT JOIN "Post" p
              ON p."assignedEditorId" = esa."editorId"
              AND p.status IN ('submitted','under_review','revision_requested')
            WHERE esa."sectionId" = ${Number(sectionId)}
            GROUP BY esa."editorId"
            ORDER BY cnt ASC
            LIMIT 1
          `;
          if (editorCounts.length > 0) assignedEditorId = editorCounts[0].editorId;
        }

        if (assignedEditorId !== null) {
          await prisma.$executeRaw`
            UPDATE "Post" SET "assignedEditorId" = ${assignedEditorId} WHERE id = ${post.id}
          `;
          const editorPrefs = await prisma.editorPreferences.findUnique({
            where: { editorId: assignedEditorId },
            select: { notifyOnSubmit: true },
          });
          if (!editorPrefs || editorPrefs.notifyOnSubmit) {
            const now2 = new Date();
            const h2 = now2.getHours();
            const m2 = String(now2.getMinutes()).padStart(2, "0");
            const ampm2 = h2 >= 12 ? "PM" : "AM";
            const timeStr2 = `${h2 % 12 || 12}:${m2} ${ampm2}`;
            await prisma.notification.upsert({
              where: {
                type_userId_recipientId_postId: {
                  type: "NEW_POST",
                  userId,
                  recipientId: assignedEditorId,
                  postId: post.id,
                },
              },
              update: { time: timeStr2, unread: true },
              create: {
                type: "NEW_POST",
                userId,
                recipientId: assignedEditorId,
                postId: post.id,
                time: timeStr2,
                group: "TODAY",
                unread: true,
                message: `New article for review: "${title ?? "Untitled"}"`,
              },
            }).catch(() => {});
          }
        }
      } catch (assignErr) {
        console.error("Editor auto-assign error (POST):", assignErr);
      }
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

          // Send FCM push notifications
          console.log(`[Post Creation] Querying followers for push notifications for user ${userId}...`);
          const pushFollowers = await prisma.$queryRaw<{ id: number }[]>`
            SELECT u.id
            FROM "UserFollow" uf
            JOIN "User" u ON u.id = uf."followerId"
            WHERE uf."followingId" = ${userId}
              AND (
                u."notificationPrefs" IS NULL
                OR u."notificationPrefs"->'push'->>'posts' IS NULL
                OR (u."notificationPrefs"->'push'->>'posts')::boolean = true
              )
          `;
          console.log(`[Post Creation] Found ${pushFollowers.length} followers eligible for push notification.`);
          if (pushFollowers.length > 0) {
            const { sendPushToUser } = await import("@/lib/fcm-send");
            const senderInfo = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
            if (senderInfo) {
              console.log(`[Post Creation] Sending push to ${pushFollowers.length} followers...`);
              Promise.allSettled(
                pushFollowers.map(f =>
                  sendPushToUser(f.id, {
                    title: `${senderInfo.name} posted a new update`,
                    body: postPreview || "Tap to view",
                    url: `/?post=${post.id}`,
                    icon: senderInfo.avatar || undefined,
                    image: postImage || undefined,
                  })
                )
              ).then((results) => {
                console.log(`[Post Creation] Finished sending push notifications. Results:`, results.map(r => r.status));
              }).catch((err) => console.error("[Post Creation] Push post err:", err));
            } else {
              console.warn(`[Post Creation] Could not find sender info for user ${userId}`);
            }
          }

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
      articleParagraphs, preferredEditorId,
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
      if (status === "published" && !authUser.canPost && authUser.role !== "ADMIN") {
        return NextResponse.json({ error: "You don't have permission to publish" }, { status: 403 });
      }
      await prisma.$executeRaw`UPDATE "Post" SET status = ${status} WHERE id = ${postId}`;
    }

    // Auto-assign editor when author submits for review
    if (status === "submitted") {
      try {
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { sectionId: true },
        });
        if (post?.sectionId) {
          let assignedEditorId: number | null = null;

          // Use preferred editor if they cover this section
          if (preferredEditorId) {
            const valid = await prisma.$queryRaw<{ editorId: number }[]>`
              SELECT "editorId" FROM "EditorSectionAssignment"
              WHERE "editorId" = ${preferredEditorId} AND "sectionId" = ${post.sectionId}
            `;
            if (valid.length > 0) assignedEditorId = preferredEditorId;
          }

          // Fall back to least-busy editor for this section
          if (!assignedEditorId) {
            const editorCounts = await prisma.$queryRaw<{ editorId: number; cnt: bigint }[]>`
              SELECT esa."editorId",
                     COUNT(p.id) AS cnt
              FROM "EditorSectionAssignment" esa
              LEFT JOIN "Post" p
                ON p."assignedEditorId" = esa."editorId"
                AND p.status IN ('submitted','under_review','revision_requested')
              WHERE esa."sectionId" = ${post.sectionId}
              GROUP BY esa."editorId"
              ORDER BY cnt ASC
              LIMIT 1
            `;
            if (editorCounts.length > 0) assignedEditorId = editorCounts[0].editorId;
          }

          if (assignedEditorId !== null) {
            await prisma.$executeRaw`
              UPDATE "Post" SET "assignedEditorId" = ${assignedEditorId} WHERE id = ${postId}
            `;
            // Notify the editor
            const now = new Date();
            const h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, "0");
            const ampm = h >= 12 ? "PM" : "AM";
            const timeStr = `${h % 12 || 12}:${m} ${ampm}`;
            const postRow = await prisma.post.findUnique({
              where: { id: postId },
              select: { title: true, userId: true },
            });
            const editorPrefs = await prisma.editorPreferences.findUnique({
              where: { editorId: assignedEditorId },
              select: { notifyOnSubmit: true },
            });
            if (!editorPrefs || editorPrefs.notifyOnSubmit) {
              await prisma.notification.upsert({
                where: {
                  type_userId_recipientId_postId: {
                    type: "NEW_POST",
                    userId: postRow?.userId ?? 0,
                    recipientId: assignedEditorId,
                    postId,
                  },
                },
                update: { time: timeStr, unread: true },
                create: {
                  type: "NEW_POST",
                  userId: postRow?.userId ?? 0,
                  recipientId: assignedEditorId,
                  postId,
                  time: timeStr,
                  group: "TODAY",
                  unread: true,
                  message: `New article for review: "${postRow?.title ?? "Untitled"}"`,
                },
              }).catch(() => {});
            }
          }
        }
      } catch (assignErr) {
        console.error("Editor auto-assign error:", assignErr);
      }
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
