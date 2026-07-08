import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { sendCommentEmail, sendMentionEmail } from "@/lib/circle-email-service";
import { sendPushToUser } from "@/lib/fcm-send";
import { rateLimit } from "@/lib/rate-limit";
import { checkCommentAbuse } from "@/lib/abuse-detection";
import { blobStorageService } from "@/lib/blob-storage";

// Get comments for a post — supports cursor-based pagination
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (!postId) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

    const cursorParam = request.nextUrl.searchParams.get("cursor");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const cursor = cursorParam ? Number(cursorParam) : null;
    const limit = Math.min(Math.max(1, parseInt(limitParam ?? "20", 10) || 20), 50);

    const rows = cursor
      ? await prisma.$queryRaw<any[]>`
          SELECT c.id, c.text, c."userId", c."createdAt",
                 u.name, u.handle, u.avatar, u.verified
          FROM "PostComment" c
          JOIN "User" u ON u.id = c."userId"
          WHERE c."postId" = ${postId} AND c.id < ${cursor}
          ORDER BY c.id DESC
          LIMIT ${limit + 1}
        `
      : await prisma.$queryRaw<any[]>`
          SELECT c.id, c.text, c."userId", c."createdAt",
                 u.name, u.handle, u.avatar, u.verified
          FROM "PostComment" c
          JOIN "User" u ON u.id = c."userId"
          WHERE c."postId" = ${postId}
          ORDER BY c.id DESC
          LIMIT ${limit + 1}
        `;

    const hasMore = rows.length > limit;
    const comments = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? comments[comments.length - 1].id : null;

    const resolved = comments.map((c: any) => ({
      ...c,
      avatar: blobStorageService.resolveMediaUrl(c.avatar),
    }));

    // Return object with pagination metadata; comments array kept at root for backward compat
    return NextResponse.json({ comments: resolved, nextCursor, hasMore });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Add a comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const commentLimit = await rateLimit(`comment:${authUser.id}`, 30, 60 * 1000);
  if (!commentLimit.allowed) {
    return NextResponse.json(commentLimit.error, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((commentLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  const commentAbuse = await checkCommentAbuse(authUser.id);
  if (commentAbuse.blocked) {
    return NextResponse.json({ error: commentAbuse.reason }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((commentAbuse.retryAfterMs ?? 60_000) / 1000)) },
    });
  }

  try {
    const { id } = await params;
    const postId = Number(id);
    if (!postId) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

    const body = await request.json();
    const text = body.text?.trim()?.slice(0, 2000);
    const userId = authUser.id;
    if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

    // Insert comment
    await prisma.$executeRaw`
      INSERT INTO "PostComment" ("postId", "userId", "text", "createdAt")
      VALUES (${postId}, ${userId}, ${text.trim()}, NOW())
    `;
    // X-algorithm: record comment engagement signal
    prisma.$executeRaw`INSERT INTO "PostEngagement" ("userId", "postId", action, "createdAt") VALUES (${userId}, ${postId}, 'comment', NOW())`.catch(() => {});

    // Create notification + email for post owner
    try {
      const postRows = await prisma.$queryRaw<any[]>`SELECT "userId" as "ownerId", title, content, image FROM "Post" WHERE id = ${postId} LIMIT 1`;
      if (postRows.length && postRows[0].ownerId !== userId) {
        const post = postRows[0];
        const plainContent = (post.content || "").replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
        const postPreview = post.title || plainContent.substring(0, 100) || "";
        const postImage = post.image || "";
        const ownerId = postRows[0].ownerId;

        const owner = await prisma.user.findUnique({
          where: { id: ownerId },
          select: { name: true, email: true, notificationPrefs: true },
        });
        const prefs = owner?.notificationPrefs as any;

        // Push notification
        const pushEnabled = prefs?.push?.comments ?? true;
        if (pushEnabled) {
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage")
            VALUES ('COMMENT', ${userId}, ${ownerId}, NOW(), 'TODAY', true, ${postPreview}, ${postImage})
            ON CONFLICT (type, "userId", "recipientId", "postId") DO UPDATE SET time = NOW(), unread = true, "postPreview" = ${postPreview}
          `;
        }

        const commenter = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, handle: true },
        });

        // Browser push
        if (pushEnabled && commenter) {
          sendPushToUser(ownerId, {
            title: `${commenter.name} commented on your post`,
            body: text.trim().substring(0, 100),
            url: `/posts/${postId}`,
          }).catch(() => {});
        }

        // Email notification
        const emailEnabled = prefs?.email?.comments ?? false;
        if (emailEnabled && owner?.email && commenter) {
          sendCommentEmail({
            recipientEmail: owner.email,
            recipientName: owner.name,
            commenterName: commenter.name,
            commenterHandle: commenter.handle,
            commentText: text.trim(),
            postPreview,
            postId,
          }).catch(() => {});
        }

        // --- Process Mentions (For all users) ---
        if (text && commenter) {
          try {
            const matches = text.match(/(?<=^|\s)@([a-zA-Z0-9_.-]+)/g) || [];
            const extractedHandles: string[] = Array.from(new Set(matches.map((m: string) => m.substring(1))));
            if (extractedHandles.length > 0) {
              const mentionedUsers = await prisma.user.findMany({
                where: { handle: { in: extractedHandles }, id: { not: userId } },
                select: { id: true, email: true, name: true, notificationPrefs: true }
              });
              
              if (mentionedUsers.length > 0) {
                const plainContent = text.trim();
                const contentSnippet = plainContent.length > 100 ? plainContent.substring(0, 100) + '...' : plainContent;
                
                for (const mUser of mentionedUsers) {
                  // Email
                  const emailEnabled = (mUser.notificationPrefs as any)?.email?.mentions ?? false;
                  if (emailEnabled && mUser.email) {
                    sendMentionEmail({
                      recipientEmail: mUser.email,
                      recipientName: mUser.name,
                      authorName: commenter.name,
                      authorHandle: commenter.handle,
                      contentSnippet,
                      postUrlPath: `/#post-${postId}`
                    }).catch(() => {});
                  }
                  
                  // Push & DB Notification
                  const pushEnabled = (mUser.notificationPrefs as any)?.push?.mentions ?? true;
                  if (pushEnabled) {
                    await prisma.$executeRaw`
                      INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postId", "message")
                      VALUES ('MENTION', ${userId}, ${mUser.id}, NOW(), 'TODAY', true, ${contentSnippet.substring(0, 50)}, ${postId}, 'mentioned you in a comment')
                      ON CONFLICT (type, "userId", "recipientId", "postId") DO UPDATE SET time = NOW(), unread = true
                    `.catch(() => {});
                    
                    sendPushToUser(mUser.id, {
                      title: `${commenter.name} mentioned you`,
                      body: contentSnippet,
                      url: `/?post=${postId}`,
                    }).catch(() => {});
                  }
                }
              }
            }
          } catch (mentionErr) {
            console.error("Error processing comment mentions:", mentionErr);
          }
        }
        // --- End Process Mentions ---
      }
    } catch (notifErr) {
      console.error("Error creating comment notification:", notifErr);
    }

    // Increment post comment count
    const rows = await prisma.$queryRaw<any[]>`SELECT comments FROM "Post" WHERE id = ${postId} LIMIT 1`;
    if (rows.length) {
      const current = parseCount(rows[0].comments);
      const formatted = formatCount(current + 1);
      await prisma.$executeRaw`UPDATE "Post" SET comments = ${formatted} WHERE id = ${postId}`;
    }

    // Fetch the newly created comment with user info
    const newComment = await prisma.$queryRaw<any[]>`
      SELECT c.id, c.text, c."userId", c."createdAt",
             u.name, u.handle, u.avatar, u.verified
      FROM "PostComment" c
      JOIN "User" u ON u.id = c."userId"
      WHERE c."postId" = ${postId}
      ORDER BY c.id DESC
      LIMIT 1
    `;

    return NextResponse.json(newComment[0] || { success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete a comment
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const { id } = await params;
    const postId = Number(id);
    const { commentId } = await request.json();
    if (!commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

    await prisma.$executeRaw`DELETE FROM "PostComment" WHERE id = ${commentId} AND "userId" = ${authUser.id}`;

    // Decrement post comment count
    const rows = await prisma.$queryRaw<any[]>`SELECT comments FROM "Post" WHERE id = ${postId} LIMIT 1`;
    if (rows.length) {
      const current = parseCount(rows[0].comments);
      const formatted = formatCount(Math.max(0, current - 1));
      await prisma.$executeRaw`UPDATE "Post" SET comments = ${formatted} WHERE id = ${postId}`;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseCount(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.max(0, n));
}
