import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { sendLikeEmail } from "@/lib/circle-email-service";

function parseStat(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/,/g, "").trim().toLowerCase();
  if (clean.endsWith("m")) return Math.round(parseFloat(clean) * 1_000_000);
  if (clean.endsWith("k")) return Math.round(parseFloat(clean) * 1_000);
  return parseInt(clean) || 0;
}

function formatStat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.max(0, n));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const { id } = await params;
    const postId = Number(id);
    if (!postId) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

    const { action } = await request.json();
    const userId = authUser.id;
    if (action !== "like" && action !== "unlike") {
      return NextResponse.json({ error: "Action must be 'like' or 'unlike'" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<any[]>`SELECT likes, "userId" as "ownerId" FROM "Post" WHERE id = ${postId} LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Don't allow post owner to like their own post
    if (userId && rows[0].ownerId === userId) {
      return NextResponse.json({ likes: rows[0].likes, liked: false, skipped: "own_content" });
    }

    if (action === "like" && userId) {
      // Add like record (ignore if already exists)
      await prisma.$executeRaw`INSERT INTO "PostLike" ("postId", "userId") VALUES (${postId}, ${userId}) ON CONFLICT ("postId", "userId") DO NOTHING`;
      // X-algorithm: record engagement signal for personalization
      await prisma.$executeRaw`INSERT INTO "PostEngagement" ("userId", "postId", action, "createdAt") VALUES (${userId}, ${postId}, 'like', NOW()) ON CONFLICT DO NOTHING`;

      // Create notification + email for post owner
      if (rows[0].ownerId !== userId) {
        try {
          const owner = await prisma.user.findUnique({
            where: { id: rows[0].ownerId },
            select: { name: true, email: true, notificationPrefs: true },
          });
          const prefs = owner?.notificationPrefs as any;
          const postRows = await prisma.$queryRaw<any[]>`SELECT title, content, image FROM "Post" WHERE id = ${postId} LIMIT 1`;
          if (postRows.length) {
            const post = postRows[0];
            const postPreview = post.title || post.content?.substring(0, 100) || "";
            const postImage = post.image || "";

            // Push notification
            const pushEnabled = prefs?.push?.likes ?? true;
            if (pushEnabled) {
              await prisma.$executeRaw`
                INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage", "postId")
                VALUES ('LIKE', ${userId}, ${rows[0].ownerId}, NOW(), 'TODAY', true, ${postPreview}, ${postImage}, ${postId})
                ON CONFLICT (type, "userId", "recipientId", "postId") DO NOTHING
              `;
            }

            // Email notification
            const emailEnabled = prefs?.email?.likes ?? false;
            if (emailEnabled && owner?.email) {
              const liker = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, handle: true },
              });
              if (liker) {
                sendLikeEmail({
                  recipientEmail: owner.email,
                  recipientName: owner.name,
                  likerName: liker.name,
                  likerHandle: liker.handle,
                  postPreview,
                  postImage: postImage || undefined,
                  postId,
                }).catch(() => {});
              }
            }
          }
        } catch (notifErr) {
          console.error("Error creating like notification:", notifErr);
        }
      }
    } else if (action === "unlike" && userId) {
      // Remove like record
      await prisma.$executeRaw`DELETE FROM "PostLike" WHERE "postId" = ${postId} AND "userId" = ${userId}`;
    }

    // Count actual likes from PostLike table
    const countRows = await prisma.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "PostLike" WHERE "postId" = ${postId}`;
    const realCount = countRows[0]?.count || 0;

    // Also keep the Post.likes string in sync (use the higher of real count or existing for seed data)
    const seedCount = parseStat(rows[0].likes);
    const displayCount = Math.max(realCount, action === "like" ? seedCount + 1 : seedCount - 1, 0);
    const formatted = formatStat(displayCount);
    await prisma.$executeRaw`UPDATE "Post" SET likes = ${formatted} WHERE id = ${postId}`;

    return NextResponse.json({ likes: formatted, liked: action === "like" });
  } catch (err: any) {
    console.error("Like error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
