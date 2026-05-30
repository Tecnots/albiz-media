import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "AUTHOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uid = user.id;

  const [published, drafts, aggregate, followers] = await Promise.all([
    // Count published articles
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Post"
      WHERE "userId" = ${uid} AND (status = 'published' OR status IS NULL)
    `,
    // Count drafts
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Post"
      WHERE "userId" = ${uid} AND status = 'draft'
    `,
    // Sum views, likes, comments across all posts
    prisma.$queryRaw<[{ total_views: bigint; total_likes: bigint; total_comments: bigint }]>`
      SELECT
        COALESCE(SUM(CAST(views AS bigint)), 0)    AS total_views,
        COALESCE(SUM(CAST(likes AS bigint)), 0)    AS total_likes,
        COALESCE(SUM(CAST(comments AS bigint)), 0) AS total_comments
      FROM "Post"
      WHERE "userId" = ${uid}
    `,
    // Follower count from UserFollow table
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "UserFollow" WHERE "followingId" = ${uid}
    `,
  ]);

  return NextResponse.json({
    published:   Number(published[0].count),
    drafts:      Number(drafts[0].count),
    totalViews:  Number(aggregate[0].total_views),
    totalLikes:  Number(aggregate[0].total_likes),
    totalComments: Number(aggregate[0].total_comments),
    followers:   Number(followers[0].count),
  });
}
