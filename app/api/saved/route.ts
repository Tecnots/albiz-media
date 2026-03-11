import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId")) || 0;

  const [collections, savedPosts] = await Promise.all([
    prisma.savedCollection.findMany({ orderBy: { id: "asc" } }),
    userId
      ? prisma.$queryRaw<any[]>`SELECT "postId", "collectionId" FROM "SavedPost" WHERE "userId" = ${userId}`
      : prisma.savedPost.findMany({ select: { postId: true }, orderBy: { id: "asc" } }),
  ]);

  const posts = userId
    ? (savedPosts as any[]).map((r: any) => ({ postId: r.postId, collectionId: r.collectionId }))
    : (savedPosts as any[]).map((sp: any) => ({ postId: sp.postId, collectionId: null }));

  return NextResponse.json({ collections, posts });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, postId, collectionId } = await request.json();
    if (!userId || !postId) return NextResponse.json({ error: "Missing userId or postId" }, { status: 400 });

    if (collectionId) {
      await prisma.$executeRaw`
        INSERT INTO "SavedPost" ("userId", "postId", "collectionId")
        VALUES (${userId}, ${postId}, ${collectionId})
        ON CONFLICT ("userId", "postId") DO UPDATE SET "collectionId" = ${collectionId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "SavedPost" ("userId", "postId")
        VALUES (${userId}, ${postId})
        ON CONFLICT ("userId", "postId") DO NOTHING
      `;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, postId } = await request.json();
    if (!userId || !postId) return NextResponse.json({ error: "Missing userId or postId" }, { status: 400 });

    await prisma.$executeRaw`DELETE FROM "SavedPost" WHERE "userId" = ${userId} AND "postId" = ${postId}`;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
