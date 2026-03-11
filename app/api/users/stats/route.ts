import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users/stats?userId=1
// Returns real follower count, following count, and post count from database
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  try {
    const [followerRows, followingRows, postRows, user] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "UserFollow" WHERE "followingId" = ${userId}`,
      prisma.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "UserFollow" WHERE "followerId" = ${userId}`,
      prisma.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM "Post" WHERE "userId" = ${userId} AND (status = 'published' OR status IS NULL)`,
      prisma.user.findUnique({ where: { id: userId }, select: { publicKey: true } }),
    ]);

    return NextResponse.json({
      followers: followerRows[0]?.count || 0,
      following: followingRows[0]?.count || 0,
      posts: postRows[0]?.count || 0,
      publicKey: user?.publicKey || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
