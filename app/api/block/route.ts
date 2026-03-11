import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: get list of blocked users for a user (with profile info)
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json([]);

  const blocked = await prisma.$queryRaw<any[]>`
    SELECT b.id as "blockId", b."blockedId", b."createdAt",
           u.name, u.handle, u.avatar, u.title, u.verified, u.role
    FROM "BlockedUser" b
    JOIN "User" u ON u.id = b."blockedId"
    WHERE b."blockerId" = ${userId}
    ORDER BY b."createdAt" DESC
  `;

  return NextResponse.json(blocked);
}

// POST: block a user
export async function POST(request: NextRequest) {
  try {
    const { blockerId, blockedId } = await request.json();
    if (!blockerId || !blockedId) return NextResponse.json({ error: "Missing blockerId or blockedId" }, { status: 400 });
    if (blockerId === blockedId) return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });

    // Add block record
    await prisma.$executeRaw`
      INSERT INTO "BlockedUser" ("blockerId", "blockedId", "createdAt")
      VALUES (${blockerId}, ${blockedId}, NOW())
      ON CONFLICT ("blockerId", "blockedId") DO NOTHING
    `;

    // Also unfollow in both directions
    await prisma.$executeRaw`DELETE FROM "UserFollow" WHERE "followerId" = ${blockerId} AND "followingId" = ${blockedId}`;
    await prisma.$executeRaw`DELETE FROM "UserFollow" WHERE "followerId" = ${blockedId} AND "followingId" = ${blockerId}`;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: unblock a user
export async function DELETE(request: NextRequest) {
  try {
    const { blockerId, blockedId } = await request.json();
    if (!blockerId || !blockedId) return NextResponse.json({ error: "Missing blockerId or blockedId" }, { status: 400 });

    await prisma.$executeRaw`DELETE FROM "BlockedUser" WHERE "blockerId" = ${blockerId} AND "blockedId" = ${blockedId}`;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
