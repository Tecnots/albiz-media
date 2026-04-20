import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  const userId = authUser?.id || Number(request.nextUrl.searchParams.get("userId")) || 0;
  
  console.log("Saved API - authUser:", authUser);
  console.log("Saved API - userId:", userId);

  const [collections, savedPosts] = await Promise.all([
    userId ? prisma.$queryRaw<any[]>`
      SELECT c.id, c.name, c.image, c."createdAt",
             COUNT(s.id)::int as count
      FROM "UserCollection" c
      LEFT JOIN "SavedPost" s ON s."collectionId" = c.id AND s."userId" = ${userId}
      WHERE c."userId" = ${userId}
      GROUP BY c.id
      ORDER BY c."createdAt" DESC
    ` : [],
    userId
      ? prisma.savedPost.findMany({ where: { userId }, select: { postId: true, collectionId: true } })
      : prisma.savedPost.findMany({ select: { postId: true }, orderBy: { id: "asc" } }),
  ]);

  const postIds = userId
    ? (savedPosts as any[]).map((r: any) => r.postId)
    : (savedPosts as any[]).map((sp: any) => sp.postId);

  console.log("Saved API - collections:", collections);
  console.log("Saved API - savedPosts:", savedPosts);
  console.log("Saved API - postIds:", postIds);

  return NextResponse.json({ collections, postIds });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, postId, collectionId } = await request.json();
    
    if (!userId || !postId) {
      return NextResponse.json({ error: "Missing userId or postId" }, { status: 400 });
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
  try {
    const { userId, postId } = await request.json();
    if (!userId || !postId) return NextResponse.json({ error: "Missing userId or postId" }, { status: 400 });

    await prisma.savedPost.deleteMany({
      where: { userId, postId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unsave post error:", err);
    return NextResponse.json({ error: err.message || "Failed to unsave post" }, { status: 500 });
  }
}
