// TEMP TEST ROUTE — DELETE BEFORE PRODUCTION DEPLOY
// Allows testing geo-based feed without browser session
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = parseInt(searchParams.get("userId") ?? "0");
  const mode   = searchParams.get("mode") ?? "for-you";

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const userRows = await prisma.$queryRaw<any[]>`
    SELECT id, name, "countryCode", "countrySource" FROM "User" WHERE id = ${userId}
  `;
  const user = userRows[0];
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Fetch feed for this user by calling the internal feed logic
  const feedUrl = new URL(`/api/feed?mode=${mode}&cursor=0&limit=20`, req.url);
  // We need to simulate the feed with this user's context — query it directly
  const countryCode = user.countryCode;

  const posts = await prisma.$queryRaw<any[]>`
    SELECT p.id, p."userId", p."countryCode", p."contentScope",
           u.name as "authorName", u."countryCode" as "authorCountry"
    FROM "Post" p
    JOIN "User" u ON u.id = p."userId"
    WHERE (p.status = 'published' OR p.status IS NULL)
    ORDER BY p."createdAt" DESC NULLS LAST
  `;

  const filtered = posts.filter((p: any) => {
    if (p.contentScope === "LOCAL" && p.countryCode && countryCode) {
      return p.countryCode === countryCode;
    }
    return true;
  });

  return NextResponse.json({
    testUser: { id: user.id, name: user.name, countryCode },
    mode,
    totalPosts: posts.length,
    afterGeoFilter: filtered.length,
    removedByLocalFilter: posts.length - filtered.length,
    localPosts: filtered.filter((p: any) => p.countryCode === countryCode).length,
    posts: filtered.map((p: any) => ({
      id: p.id,
      author: p.authorName,
      country: p.countryCode,
      scope: p.contentScope,
      sameCountry: p.countryCode === countryCode,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { userId, countryCode } = await req.json();
  if (!userId || !countryCode) return NextResponse.json({ error: "userId + countryCode required" }, { status: 400 });
  await prisma.$executeRaw`
    UPDATE "User" SET "countryCode" = ${countryCode}, "countrySource" = 'MANUAL', "countryUpdatedAt" = NOW()
    WHERE id = ${userId}
  `;
  return NextResponse.json({ ok: true, userId, countryCode });
}
