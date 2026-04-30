import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

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

    // Create notification for post owner
    try {
      const postRows = await prisma.$queryRaw<any[]>`SELECT "userId" as "ownerId", title, content, image FROM "Post" WHERE id = ${postId} LIMIT 1`;
      if (postRows.length && postRows[0].ownerId !== userId) {
        const post = postRows[0];
        const postPreview = post.title || post.content?.substring(0, 100) || "";
        const postImage = post.image || "";
        await prisma.$executeRaw`
          INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage")
          VALUES ('COMMENT', ${userId}, ${postRows[0].ownerId}, NOW(), 'TODAY', true, ${postPreview}, ${postImage})
        `;
      }
    } catch (notifErr) {
      console.error("Error creating comment notification:", notifErr);
      // Don't fail the entire comment operation if notification fails
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
