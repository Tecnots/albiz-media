import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { followerId, followingId } = await request.json();

  if (followerId === followingId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  await prisma.userFollow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });

  return NextResponse.json({ success: true, action: "followed" });
}

export async function DELETE(request: Request) {
  const { followerId, followingId } = await request.json();

  await prisma.userFollow.deleteMany({
    where: { followerId, followingId },
  });

  return NextResponse.json({ success: true, action: "unfollowed" });
}
