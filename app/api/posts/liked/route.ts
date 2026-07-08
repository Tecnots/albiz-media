import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json([]);

  if (authUser.id !== userId && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<any[]>`SELECT "postId" FROM "PostLike" WHERE "userId" = ${userId}`;
  return NextResponse.json(rows.map(r => r.postId));
}
