import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const id = parseInt(userId);
  const follows = await prisma.userFollow.findMany({
    where: { followerId: id },
    select: { followingId: true },
    orderBy: { id: 'desc' },
    take: 2000,
  });

  return NextResponse.json(follows.map(f => f.followingId));
}
