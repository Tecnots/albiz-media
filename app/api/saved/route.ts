import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

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
      ? prisma.$queryRaw<any[]>`SELECT "postId", "collectionId" FROM "SavedPost" WHERE "userId" = ${userId}`
      : prisma.savedPost.findMany({ select: { postId: true }, orderBy: { id: "asc" } }),
  ]);

  const posts = userId
    ? (savedPosts as any[]).map((r: any) => ({ postId: r.postId, collectionId: r.collectionId }))
    : (savedPosts as any[]).map((sp: any) => ({ postId: sp.postId, collectionId: null }));

  console.log("Saved API - collections:", collections);
  console.log("Saved API - savedPosts:", savedPosts);
  console.log("Saved API - posts:", posts);

  return NextResponse.json({ collections, posts });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const { postId, collectionId } = await request.json();
    const userId = authUser.id;
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

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
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const { postId } = await request.json();
    const userId = authUser.id;
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    await prisma.$executeRaw`DELETE FROM "SavedPost" WHERE "userId" = ${userId} AND "postId" = ${postId}`;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
