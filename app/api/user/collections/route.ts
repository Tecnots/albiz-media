import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

// GET /api/user/collections - Fetch user's collections
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.id) return unauthorized();
    
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

    return NextResponse.json({
      success: true,
      collections: collections.map((c: any) => ({ ...c, image: blobStorageService.resolveMediaUrl(c.image) })),
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to fetch collections"
    }, { status: 500 });
  }
}

// POST /api/user/collections - Create a new collection
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser || !authUser.id) return unauthorized();
  
  try {
    const { name, image } = await request.json();
    const userId = authUser.id;
    
    if (!name || !name.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: "Collection name is required" 
      }, { status: 400 });
    }

    // Check if collection name already exists for this user
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM "UserCollection" 
      WHERE "userId" = ${userId} AND name = ${name.trim()}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Collection with this name already exists" 
      }, { status: 409 });
    }

    // Create the collection
    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO "UserCollection" ("userId", name, image, "createdAt")
      VALUES (${userId}, ${name.trim()}, ${image || ''}, NOW())
      RETURNING id, name, image, "createdAt"
    `;

    return NextResponse.json({ 
      success: true, 
      collection: result[0],
      message: "Collection created successfully" 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to create collection"
    }, { status: 500 });
  }
}

// DELETE /api/user/collections - Delete a collection
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser || !authUser.id) return unauthorized();
  
  try {
    const { collectionId } = await request.json();
    const userId = authUser.id;
    
    if (!collectionId) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing collectionId" 
      }, { status: 400 });
    }

    // Verify collection belongs to user
    const collection = await prisma.$queryRaw<any[]>`
      SELECT id FROM "UserCollection" 
      WHERE id = ${collectionId} AND "userId" = ${userId}
    `;

    if (collection.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Collection not found" 
      }, { status: 404 });
    }

    // Delete all saved posts in this collection
    await prisma.$executeRaw`
      DELETE FROM "SavedPost" 
      WHERE "collectionId" = ${collectionId}
    `;

    // Delete the collection
    await prisma.$executeRaw`
      DELETE FROM "UserCollection" 
      WHERE id = ${collectionId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: "Collection deleted successfully" 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to delete collection"
    }, { status: 500 });
  }
}
