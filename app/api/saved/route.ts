import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const userId = authUser.id;

  const [collections, savedPosts] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT c.id, c.name, c.image, c."createdAt",
             COUNT(s.id)::int as count
      FROM "UserCollection" c
      LEFT JOIN "SavedPost" s ON s."collectionId" = c.id AND s."userId" = ${userId}
      WHERE c."userId" = ${userId}
      GROUP BY c.id
      ORDER BY c."createdAt" DESC
    `,
    prisma.savedPost.findMany({ where: { userId }, select: { postId: true, collectionId: true } }),
  ]);

  const postIds = (savedPosts as any[]).map((r: any) => r.postId);

  return NextResponse.json({ collections, postIds });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const userId = authUser.id;

  try {
    const { postId, collectionId } = await request.json();
    
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    await prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      update: { collectionId: collectionId || null },
      create: { userId, postId, collectionId: collectionId || null },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Save post error:", err);
    return NextResponse.json({ error: err.message || "Failed to save post" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const userId = authUser.id;

  try {
    const { postId } = await request.json();
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    await prisma.savedPost.deleteMany({
      where: { userId, postId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unsave post error:", err);
    return NextResponse.json({ error: err.message || "Failed to unsave post" }, { status: 500 });
  }
}
