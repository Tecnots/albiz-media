import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET /api/user/collections - Fetch user's collections
export async function GET(request: NextRequest) {
  try {
    console.log("Collections API - Request headers:", Object.fromEntries(request.headers.entries()));
    const authUser = await getAuthUser(request);
    console.log("Collections API - authUser:", authUser);
    
    if (!authUser) {
      console.log("Collections API - No auth user, returning unauthorized");
      return unauthorized();
    }
    
    // Additional security check
    if (!authUser.id) {
      console.log("Collections API - Invalid auth user ID");
      return unauthorized();
    }
    
    const userId = authUser.id;
    console.log("Collections API - Fetching collections for user:", userId);

    // Test database connection first
    console.log("Collections API - Testing database connection...");
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("Collections API - Database connection successful");
    } catch (dbError) {
      console.error("Collections API - Database connection failed:", dbError);
      console.error("Collections API - Database error details:", {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : 'No stack available'
      });
      return NextResponse.json({ 
        success: false, 
        error: "Database connection failed",
        details: dbError instanceof Error ? dbError.message : String(dbError)
      }, { status: 500 });
    }

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
      collections 
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to fetch collections",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/user/collections - Create a new collection
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  
  try {
    const { name, image } = await request.json();
    const userId = authUser.id;
    
    if (!name || !name.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: "Collection name is required" 
      }, { status: 400 });
    }

    console.log("Collections API - Creating collection:", { userId, name, image });

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

    const newCollection = result[0];

    return NextResponse.json({ 
      success: true, 
      collection: newCollection,
      message: "Collection created successfully" 
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to create collection",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE /api/user/collections - Delete a collection
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  
  try {
    const { collectionId } = await request.json();
    const userId = authUser.id;
    
    if (!collectionId) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing collectionId" 
      }, { status: 400 });
    }

    console.log("Collections API - Deleting collection:", { userId, collectionId });

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
    const result = await prisma.$executeRaw`
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
      error: "Failed to delete collection",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
