import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/follow/{userId}/list?type=followers|following
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const id = parseInt(userId);
  const type = request.nextUrl.searchParams.get("type") || "followers";

  if (type === "following") {
    // Users that this person follows
    const rows = await prisma.$queryRaw<any[]>`
      SELECT u.id, u.name, u.handle, u.avatar, u.title, u.verified, u."isPremium", u.role, u.followers
      FROM "UserFollow" f
      JOIN "User" u ON u.id = f."followingId"
      WHERE f."followerId" = ${id}
      ORDER BY f."createdAt" DESC
    `;
    return NextResponse.json(rows);
  }

  // Followers — people who follow this user
  const rows = await prisma.$queryRaw<any[]>`
    SELECT u.id, u.name, u.handle, u.avatar, u.title, u.verified, u."isPremium", u.role, u.followers
    FROM "UserFollow" f
    JOIN "User" u ON u.id = f."followerId"
    WHERE f."followingId" = ${id}
    ORDER BY f."createdAt" DESC
  `;
  return NextResponse.json(rows);
}
