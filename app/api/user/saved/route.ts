import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

// GET /api/user/saved - Fetch user's saved posts and collections
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.id) return unauthorized();
    
    const userId = authUser.id;
    
    let savedPosts: any[] = [];
    try {
      savedPosts = await prisma.$queryRaw<any[]>`
        SELECT "postId", "collectionId" FROM "SavedPost" 
        WHERE "userId" = ${userId}
      `;
    } catch {
      savedPosts = [];
    }

    const posts = savedPosts.map((r: any) => ({ 
      postId: r.postId, 
      collectionId: r.collectionId 
    }));
    
    let collections: any[] = [];
    try {
      collections = await prisma.$queryRaw<any[]>`
        SELECT id, name, image, "createdAt" FROM "UserCollection" 
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
      `;
    } catch {
      collections = [];
    }

    const resolvedCollections = collections.map((c: any) => ({ ...c, image: blobStorageService.resolveMediaUrl(c.image) }));
    return NextResponse.json({
      success: true,
      collections: resolvedCollections,
      posts,
      totalSaved: posts.length
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to fetch saved data"
    }, { status: 500 });
  }
}

// POST /api/user/saved - Add a post to saved items
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.id) return unauthorized();
    
    const { postId, collectionId } = await request.json();
    const userId = authUser.id;
    
    if (!postId) {
      return NextResponse.json({ success: false, error: "Missing postId" }, { status: 400 });
    }

    let existing: any[] = [];
    try {
      existing = await prisma.$queryRaw<any[]>`
        SELECT id, "collectionId" FROM "SavedPost" 
        WHERE "userId" = ${userId} AND "postId" = ${postId}
      `;
    } catch {
      existing = [];
    }

    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: "Post already saved", existing }, { status: 409 });
    }

    try {
      const postCheck = await prisma.$queryRaw<any[]>`SELECT id FROM "Post" WHERE id = ${postId}`;
      
      if (postCheck.length === 0) {
        return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
      }
      
      if (collectionId) {
        const col = await prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM "UserCollection" WHERE id = ${collectionId} AND "userId" = ${userId} LIMIT 1
        `;
        if (col.length === 0) {
          return NextResponse.json({ success: false, error: 'Collection not found' }, { status: 404 });
        }
        await prisma.$executeRaw`
          INSERT INTO "SavedPost" ("userId", "postId", "collectionId")
          VALUES (${userId}, ${postId}, ${collectionId})
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "SavedPost" ("userId", "postId")
          VALUES (${userId}, ${postId})
        `;
      }
    } catch (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Post saved successfully" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to save post" }, { status: 500 });
  }
}

// DELETE /api/user/saved - Remove a post from saved items
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser || !authUser.id) return unauthorized();
  
  try {
    const { postId } = await request.json();
    const userId = authUser.id;
    
    if (!postId) {
      return NextResponse.json({ success: false, error: "Missing postId" }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM "SavedPost" WHERE "userId" = ${userId} AND "postId" = ${postId}
    `;

    return NextResponse.json({ success: true, message: "Post unsaved successfully" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to unsave post" }, { status: 500 });
  }
}
