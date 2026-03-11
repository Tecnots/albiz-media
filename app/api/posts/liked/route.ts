import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json([]);

  const rows = await prisma.$queryRaw<any[]>`SELECT "postId" FROM "PostLike" WHERE "userId" = ${userId}`;
  return NextResponse.json(rows.map(r => r.postId));
}
