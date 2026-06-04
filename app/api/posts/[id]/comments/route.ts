import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { sendCommentEmail } from "@/lib/circle-email-service";

// Get comments for a post
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (!postId) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

    const comments = await prisma.$queryRaw<any[]>`
      SELECT c.id, c.text, c."userId", c."createdAt",
             u.name, u.handle, u.avatar, u.verified
      FROM "PostComment" c
      JOIN "User" u ON u.id = c."userId"
      WHERE c."postId" = ${postId}
      ORDER BY c."createdAt" DESC
      LIMIT 50
    `;

    return NextResponse.json(comments);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Add a comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const { id } = await params;
    const postId = Number(id);
    if (!postId) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

    const { text } = await request.json();
    const userId = authUser.id;
    if (!text?.trim()) return NextResponse.json({ error: "Missing text" }, { status: 400 });

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
        const postPreview = post.title || post.content?.substring(0, 100) || "";
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

        // Email notification
        const emailEnabled = prefs?.email?.comments ?? false;
        if (emailEnabled && owner?.email) {
          const commenter = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, handle: true },
          });
          if (commenter) {
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
        }
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
    return NextResponse.json({ error: err.message }, { status: 500 });
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

    await prisma.$executeRaw`DELETE FROM "PostComment" WHERE id = ${commentId}`;

    // Decrement post comment count
    const rows = await prisma.$queryRaw<any[]>`SELECT comments FROM "Post" WHERE id = ${postId} LIMIT 1`;
    if (rows.length) {
      const current = parseCount(rows[0].comments);
      const formatted = formatCount(Math.max(0, current - 1));
      await prisma.$executeRaw`UPDATE "Post" SET comments = ${formatted} WHERE id = ${postId}`;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
