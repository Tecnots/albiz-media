import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// Get user's collections with post counts
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const userId = authUser.id;

  const collections = await prisma.$queryRaw<any[]>`
    SELECT c.id, c.name, c.image, c."createdAt",
           COUNT(s.id)::int as count
    FROM "UserCollection" c
    LEFT JOIN "SavedPost" s ON s."collectionId" = c.id AND s."userId" = ${userId}
    WHERE c."userId" = ${userId}
    GROUP BY c.id
    ORDER BY c."createdAt" DESC
  `;

  return NextResponse.json(collections);
}

// Create a new collection
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const userId = authUser.id;

  try {
    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO "UserCollection" ("userId", "name", "image", "createdAt")
      VALUES (${userId}, ${name.trim()}, '', NOW())
      RETURNING id, name, image, "createdAt"
    `;

    return NextResponse.json({ ...result[0], count: 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete a collection (posts become uncollected, not deleted)
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const userId = authUser.id;

  try {
    const { collectionId } = await request.json();
    if (!collectionId) return NextResponse.json({ error: "Missing collectionId" }, { status: 400 });

    // Verify collection belongs to user
    const collection = await prisma.$queryRaw<any[]>`
      SELECT id FROM "UserCollection" 
      WHERE id = ${collectionId} AND "userId" = ${userId}
    `;

    if (collection.length === 0) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Unlink posts from this collection
    await prisma.$executeRaw`UPDATE "SavedPost" SET "collectionId" = NULL WHERE "collectionId" = ${collectionId}`;
    await prisma.$executeRaw`DELETE FROM "UserCollection" WHERE id = ${collectionId}`;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
