import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const { followingId } = await request.json();

  if (authUser.id === followingId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  await prisma.userFollow.upsert({
    where: { followerId_followingId: { followerId: authUser.id, followingId } },
    create: { followerId: authUser.id, followingId },
    update: {},
  });

  return NextResponse.json({ success: true, action: "followed" });
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const { followingId } = await request.json();

  await prisma.userFollow.deleteMany({
    where: { followerId: authUser.id, followingId },
  });

  return NextResponse.json({ success: true, action: "unfollowed" });
}
