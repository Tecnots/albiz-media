import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { sendNewPostEmail } from "@/lib/circle-email-service";
import { transitionPostState } from "@/lib/editor-workflow";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/html-sanitize";

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const userIdParam = request.nextUrl.searchParams.get("userId");
  const pageParam = request.nextUrl.searchParams.get("page");
  const page = Math.max(0, parseInt(pageParam ?? "0", 10) || 0);
  // User-scoped queries are bounded by that user's post count (reasonable).
  // The open "all published" query must be paginated to prevent OOM.
  const PAGE_SIZE = 20;

  // Use raw SQL for status filter since Prisma client cache may not know about the field.
  let postIds: number[] | null = null;
  // When true the IDs are already sliced to one page — skip take/skip in findMany.
  let postIdsPaginated = false;
  if (statusParam === "all" && userIdParam) {
    // All posts for a specific user (author studio) — requires auth as that user or admin.
    const authUser = await getAuthUser(request);
    const uid = Number(userIdParam);
    if (!authUser || (authUser.id !== uid && authUser.role !== "ADMIN")) {
      return unauthorized();
    }
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE "userId" = ${uid}`;
    postIds = rows.map((r: { id: any; }) => r.id);
    if (!postIds?.length) return NextResponse.json([]);
  } else if (statusParam === "drafts" && userIdParam) {
    // Draft posts — requires auth as that user or admin.
    const authUser = await getAuthUser(request);
    const uid = Number(userIdParam);
    if (!authUser || (authUser.id !== uid && authUser.role !== "ADMIN")) {
      return unauthorized();
    }
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE status = 'draft' AND "userId" = ${uid}`;
    postIds = rows.map((r: { id: any; }) => r.id);
    if (!postIds?.length) return NextResponse.json([]);
  } else if (userIdParam && statusParam !== "all") {
    // Published posts for a specific user
    const uid = Number(userIdParam);
    const rows = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE (status = 'published' OR status IS NULL) AND "userId" = ${uid}`;
    postIds = rows.map((r: { id: any; }) => r.id);
    if (!postIds?.length) return NextResponse.json([]);
  } else if (statusParam !== "all") {
    // All published posts (feed) — paginate at the SQL level to avoid loading all IDs into memory.
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id FROM "Post" WHERE status = 'published' OR status IS NULL
      ORDER BY id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}
    `;
    postIds = rows.map((r: { id: any; }) => r.id);
    postIdsPaginated = true;
    if (!postIds?.length) return NextResponse.json([]);
  }

  const needsPagination = !userIdParam && !postIdsPaginated;

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
    ...(needsPagination ? { take: PAGE_SIZE, skip: page * PAGE_SIZE } : postIdsPaginated ? {} : {}),
  } as any);

  // Transform to match frontend shape
  const transformed = posts.map(p => {
    const finalImage = blobStorageService.resolveMediaUrl(p.image);

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

  // Rate limit Circle members: 10 posts per hour
  if (authUser.role === "CIRCLE") {
    const limit = await rateLimit(`circle:post:${authUser.id}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(limit.error, {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      });
    }
  }

  try {
    const body = await request.json();
    const userId = authUser.id;
    const { type, title, description, image, tags: rawTags, articleParagraphs, status, slug, seoDescription, sectionId, language, contentScope, preferredEditorId } = body;
    // Sanitize HTML content at write time to prevent stored XSS
    const content = typeof body.content === "string" ? sanitizeHtml(body.content) : null;

    // Auto-extract hashtags from content if no tags provided
    let tags = rawTags;
    if ((!tags || tags.length === 0) && content) {
      const plain = content.replace(/<[^>]*>/g, "");
      const extracted = (plain.match(/#(\w+)/g) ?? []).map((h: string) => h.slice(1));
      if (extracted.length > 0) tags = [...new Set(extracted)];
    }

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

    if (postType === "POST" && authUser.role !== "CIRCLE" && authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Posting to the feed requires a Circle subscription" }, { status: 403 });
    }

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
        status: "draft",
      },
    });

    // Geo-tag via raw SQL (countryCode/contentScope fields added via migration)
    if (authorCountryCode || resolvedScope !== "GLOBAL") {
      await prisma.$executeRaw`
        UPDATE "Post"
        SET "countryCode" = ${authorCountryCode}, "contentScope" = ${resolvedScope}
        WHERE id = ${post.id}
      `.catch(() => { });
    }

    // Set status via strict workflow state machine
    if (status && status !== "draft") {
      // Resolve canPublish for editors based on the requested section
      let userCanPublish = false;
      if (authUser.role === "EDITOR" && sectionId) {
        const esa = await prisma.editorSectionAssignment.findUnique({
          where: { editorId_sectionId: { editorId: authUser.id, sectionId: Number(sectionId) } },
          select: { canPublish: true },
        });
        userCanPublish = esa?.canPublish ?? false;
      } else if (authUser.role === "ADMIN") {
        userCanPublish = true;
      }
      try {
        await transitionPostState(
          post.id,
          authUser.id,
          authUser.role,
          "draft",
          status,
          post.assignedEditorId,
          userCanPublish,
          authUser.canPost,
          "create"
        );
      } catch (err: any) {
        console.error("[posts POST] state transition failed:", err?.message);
        await prisma.post.delete({ where: { id: post.id } }).catch(() => { });
        return NextResponse.json({ error: "Unable to submit this article. Please check your permissions and article requirements." }, { status: 403 });
      }
    } else if (!status) {
      // No status provided — publish directly (backward compat)
      if (!authUser.canPost && authUser.role !== "ADMIN" && authUser.role !== "CIRCLE") {
        await prisma.post.delete({ where: { id: post.id } }).catch(() => { });
        return NextResponse.json({ error: "You don't have permission to publish directly" }, { status: 403 });
      }
      await prisma.$executeRaw`UPDATE "Post" SET status = 'published' WHERE id = ${post.id}`;
    }
    // else: status === "draft" — post was created as draft, nothing more needed

    // Create article content if paragraphs provided
    if (postType === "ARTICLE" && Array.isArray(articleParagraphs) && articleParagraphs.length) {
      const sanitizedParagraphs = articleParagraphs
        .map((p: unknown) => (typeof p === "string" ? sanitizeHtml(p) : ""))
        .filter(Boolean);
      await prisma.articleContent.create({
        data: {
          postId: post.id,
          paragraphs: sanitizedParagraphs,
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
            INNER JOIN "User" u ON u.id = esa."editorId" AND u.banned = false
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
            }).catch(() => { });
            // Push notification to editor
            try {
              const { sendPushToUser } = await import("@/lib/fcm-send");
              await sendPushToUser(assignedEditorId, {
                title: "New article assigned",
                body: `"${title ?? "Untitled"}" is ready for review`,
                url: "/editor/queue",
              });
            } catch { /* non-critical */ }
            // Email notification to editor
            prisma.user.findUnique({ where: { id: assignedEditorId }, select: { email: true, name: true } })
              .then((editor: any) => {
                if (editor?.email) {
                  const { sendEditorAssignmentEmail } = require("@/lib/circle-email-service");
                  sendEditorAssignmentEmail({
                    recipientEmail: editor.email,
                    recipientName: editor.name ?? "Editor",
                    articleTitle: title ?? "Untitled",
                    authorName: authUser.name ?? "Author",
                  }).catch(() => { });
                }
              }).catch(() => { });
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

        // --- Process Mentions (For all users) ---
        if (content && author) {
          try {
            const matches = content.match(/(?<=^|\s)@([a-zA-Z0-9_.-]+)/g) || [];
            const extractedHandles: string[] = Array.from(new Set(matches.map((m: string) => m.substring(1))));
            if (extractedHandles.length > 0) {
              const mentionedUsers = await prisma.user.findMany({
                where: { handle: { in: extractedHandles }, id: { not: userId } },
                select: { id: true, email: true, name: true, notificationPrefs: true }
              });

              if (mentionedUsers.length > 0) {
                const plainContent = (content || "").replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
                const contentSnippet = plainContent.length > 100 ? plainContent.substring(0, 100) + '...' : plainContent;
                const { sendMentionEmail } = await import("@/lib/circle-email-service");
                const { sendPushToUser } = await import("@/lib/fcm-send");

                for (const mUser of mentionedUsers) {
                  // Email
                  const emailEnabled = (mUser.notificationPrefs as any)?.email?.mentions ?? false;
                  if (emailEnabled && mUser.email) {
                    sendMentionEmail({
                      recipientEmail: mUser.email,
                      recipientName: mUser.name,
                      authorName: author.name,
                      authorHandle: author.handle,
                      contentSnippet,
                      postUrlPath: `/#post-${post.id}`
                    }).catch(() => { });
                  }

                  // Push & DB Notification
                  const pushEnabled = (mUser.notificationPrefs as any)?.push?.mentions ?? true;
                  if (pushEnabled) {
                    await prisma.$executeRaw`
                      INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postId", "message")
                      VALUES ('MENTION', ${userId}, ${mUser.id}, NOW(), 'TODAY', true, ${contentSnippet.substring(0, 50)}, ${post.id}, 'mentioned you in a post')
                      ON CONFLICT (type, "userId", "recipientId", "postId") DO UPDATE SET time = NOW(), unread = true
                    `.catch(() => { });

                    sendPushToUser(mUser.id, {
                      title: `${author.name} mentioned you`,
                      body: contentSnippet,
                      url: `/?post=${post.id}`,
                    }).catch(() => { });
                  }
                }
              }
            }
          } catch (mentionErr) {
            console.error("Error processing mentions:", mentionErr);
          }
        }
        // --- End Process Mentions ---
        if (author?.role === "CIRCLE") {
          const plainContent = (content || "").replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
          const postPreview = (title || plainContent || "").slice(0, 80);
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
          if (pushFollowers.length > 0) {
            const { sendPushToUser } = await import("@/lib/fcm-send");
            const senderInfo = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
            if (senderInfo) {
              await Promise.allSettled(
                pushFollowers.map((f: { id: number; }) =>
                  sendPushToUser(f.id, {
                    title: `${senderInfo.name} posted a new update`,
                    body: postPreview || "Tap to view",
                    url: `/?post=${post.id}`,
                    icon: senderInfo.avatar || undefined,
                    image: postImage || undefined,
                  })
                )
              ).catch((err) => console.error("[Post Creation] Push post err:", err));
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
            emailFollowers.map((f: { email: any; name: any; }) =>
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
          ).catch(() => { });
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
      image: blobStorageService.resolveMediaUrl(post.image),
      tags: post.tags,
      stats: { views: "0", likes: "0", comments: "0", shares: "0" },
    });
  } catch (err: any) {
    console.error("Post creation error:", err);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
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

    const currentPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { status: true, userId: true, assignedEditorId: true, sectionId: true },
    });
    if (!currentPost) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    if (authUser.role !== "ADMIN" && currentPost.userId !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Block content edits on articles currently in the editorial review pipeline
    const contentFieldKeys = ["content", "title", "description", "image", "tags", "seoDescription", "sectionId", "language"];
    const hasContentEdits = contentFieldKeys.some(key => body[key] !== undefined);
    const editLockedStatuses = ["submitted", "under_review", "approved"];
    if (hasContentEdits && authUser.role !== "ADMIN" && editLockedStatuses.includes(currentPost.status)) {
      return NextResponse.json(
        { error: "Cannot edit article content while it is in the editorial review pipeline" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (content !== undefined) updates.content = typeof content === "string" ? sanitizeHtml(content) : null;
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

    // Status via strict workflow state machine
    if (status) {
      let canPublish = authUser.role === "ADMIN";
      if (status === "published" && authUser.role === "EDITOR" && currentPost.sectionId) {
        const assignment = await prisma.editorSectionAssignment.findUnique({
          where: { editorId_sectionId: { editorId: authUser.id, sectionId: currentPost.sectionId } },
          select: { canPublish: true },
        });
        canPublish = assignment?.canPublish ?? false;
      }
      try {
        await transitionPostState(
          postId,
          authUser.id,
          authUser.role,
          currentPost.status,
          status,
          currentPost.assignedEditorId,
          canPublish,
          authUser.canPost,
          "edit"
        );
      } catch (err: any) {
        console.error("[posts PUT] state transition failed:", err?.message);
        return NextResponse.json({ error: "Unable to update article status. Please check your permissions and article requirements." }, { status: 403 });
      }
    }

    // Auto-assign editor when author submits for review
    if (status === "submitted") {
      try {
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { sectionId: true, assignedEditorId: true },
        });
        if (post?.sectionId) {
          let assignedEditorId: number | null = null;

          // Keep existing editor on resubmission (e.g. revision cycle)
          if (post.assignedEditorId) {
            const existing = await prisma.user.findUnique({
              where: { id: post.assignedEditorId },
              select: { banned: true },
            });
            if (!existing?.banned) assignedEditorId = post.assignedEditorId;
          }

          // Use preferred editor if they cover this section and aren't banned
          if (!assignedEditorId && preferredEditorId) {
            const valid = await prisma.$queryRaw<{ editorId: number }[]>`
              SELECT esa."editorId" FROM "EditorSectionAssignment" esa
              INNER JOIN "User" u ON u.id = esa."editorId" AND u.banned = false
              WHERE esa."editorId" = ${preferredEditorId} AND esa."sectionId" = ${post.sectionId}
            `;
            if (valid.length > 0) assignedEditorId = preferredEditorId;
          }

          // Fall back to least-busy editor for this section
          if (!assignedEditorId) {
            const editorCounts = await prisma.$queryRaw<{ editorId: number; cnt: bigint }[]>`
              SELECT esa."editorId",
                     COUNT(p.id) AS cnt
              FROM "EditorSectionAssignment" esa
              INNER JOIN "User" u ON u.id = esa."editorId" AND u.banned = false
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
              }).catch(() => { });
              // Push notification to editor
              try {
                const { sendPushToUser } = await import("@/lib/fcm-send");
                await sendPushToUser(assignedEditorId, {
                  title: "New article assigned",
                  body: `"${postRow?.title ?? "Untitled"}" is ready for review`,
                  url: "/editor/queue",
                });
              } catch { /* non-critical */ }
              // Email notification to editor
              prisma.user.findUnique({ where: { id: assignedEditorId }, select: { email: true, name: true } })
                .then((editor: any) => {
                  if (editor?.email) {
                    const { sendEditorAssignmentEmail } = require("@/lib/circle-email-service");
                    sendEditorAssignmentEmail({
                      recipientEmail: editor.email,
                      recipientName: editor.name ?? "Editor",
                      articleTitle: postRow?.title ?? "Untitled",
                      authorName: authUser.name ?? "Author",
                    }).catch(() => { });
                  }
                }).catch(() => { });
            }
          }
        }
      } catch (assignErr) {
        console.error("Editor auto-assign error:", assignErr);
      }
    }

    // Update article body content
    if (Array.isArray(articleParagraphs) && articleParagraphs.length) {
      const sanitizedParagraphs = articleParagraphs
        .map((p: unknown) => (typeof p === "string" ? sanitizeHtml(p) : ""))
        .filter(Boolean);
      const existing = await prisma.articleContent.findUnique({ where: { postId } });
      if (existing) {
        await prisma.articleContent.update({ where: { postId }, data: { paragraphs: sanitizedParagraphs } });
      } else {
        await prisma.articleContent.create({ data: { postId, paragraphs: sanitizedParagraphs } });
      }
    }

    return NextResponse.json({ success: true, id: postId });
  } catch (err: any) {
    console.error("Post update error:", err);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
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

    const postToDelete = await prisma.post.findUnique({
      where: { id: postId },
      select: { status: true, userId: true },
    });
    if (!postToDelete) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    if (authUser.role !== "ADMIN" && postToDelete.userId !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleteLockedStatuses = ["submitted", "under_review", "approved"];
    if (authUser.role !== "ADMIN" && deleteLockedStatuses.includes(postToDelete.status)) {
      return NextResponse.json(
        { error: "Cannot delete an article currently in the editorial pipeline" },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`DELETE FROM "PostComment" WHERE "postId" = ${postId}`;
    await prisma.$executeRaw`DELETE FROM "ArticleContent" WHERE "postId" = ${postId}`;
    await prisma.$executeRaw`DELETE FROM "SavedPost" WHERE "postId" = ${postId}`;
    await prisma.post.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Post delete error:", err);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
