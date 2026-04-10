import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

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
