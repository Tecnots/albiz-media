import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { buildShortSummary } from "@/lib/shorts-response";

// GET /api/user/saved - Fetch user's saved posts, shorts, and collections
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.id) return unauthorized();

    const userId = authUser.id;

    let savedPosts: any[] = [];
    try {
      savedPosts = await prisma.$queryRaw<any[]>`
        SELECT "postId", "collectionId", "createdAt" FROM "SavedPost"
        WHERE "userId" = ${userId}
      `;
    } catch {
      savedPosts = [];
    }

    const posts = savedPosts.map((r: any) => ({
      postId: r.postId,
      collectionId: r.collectionId,
      savedAt: r.createdAt,
    }));

    let shorts: any[] = [];
    try {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT s.id, s.title, s."thumbnailUrl", s."videoUrl",
               s.views, s.likes, s.shares, s.comments,
               s."publishedAt", s."createdAt", ss."collectionId", ss."createdAt" AS "savedAt",
               u.id AS "u_id", u.name AS "u_name", u.handle AS "u_handle",
               u.avatar AS "u_avatar", u.verified AS "u_verified", u."countryCode" AS "u_countryCode",
               (sl.id IS NOT NULL) AS liked
        FROM "SavedShort" ss
        JOIN "Short" s ON s.id = ss."shortId"
        JOIN "User" u ON u.id = s."userId"
        LEFT JOIN "ShortLike" sl ON sl."shortId" = s.id AND sl."userId" = ${userId}
        WHERE ss."userId" = ${userId}
        ORDER BY ss."createdAt" DESC
      `;
      shorts = rows.map((r: any) => ({
        ...buildShortSummary(
          r,
          { id: r.u_id, name: r.u_name, handle: r.u_handle, avatar: r.u_avatar, verified: r.u_verified, countryCode: r.u_countryCode },
          { liked: r.liked, saved: true },
        ),
        collectionId: r.collectionId,
        savedAt: r.savedAt,
      }));
    } catch {
      shorts = [];
    }

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
      shorts,
      totalSaved: posts.length + shorts.length
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to fetch saved data"
    }, { status: 500 });
  }
}

// POST /api/user/saved - Add a post or short to saved items
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.id) return unauthorized();

    const { postId, shortId, collectionId } = await request.json();
    const userId = authUser.id;

    if (shortId) {
      const shortCheck = await prisma.$queryRaw<any[]>`SELECT id FROM "Short" WHERE id = ${shortId}`;
      if (shortCheck.length === 0) {
        return NextResponse.json({ success: false, error: "Short not found" }, { status: 404 });
      }
      const existingShort = await prisma.$queryRaw<any[]>`
        SELECT id FROM "SavedShort" WHERE "userId" = ${userId} AND "shortId" = ${shortId}
      `;
      if (existingShort.length > 0) {
        return NextResponse.json({ success: false, error: "Short already saved" }, { status: 409 });
      }
      if (collectionId) {
        const col = await prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM "UserCollection" WHERE id = ${collectionId} AND "userId" = ${userId} LIMIT 1
        `;
        if (col.length === 0) {
          return NextResponse.json({ success: false, error: "Collection not found" }, { status: 404 });
        }
        await prisma.$executeRaw`
          INSERT INTO "SavedShort" ("userId", "shortId", "collectionId") VALUES (${userId}, ${shortId}, ${collectionId})
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "SavedShort" ("userId", "shortId") VALUES (${userId}, ${shortId})
        `;
      }
      return NextResponse.json({ success: true, message: "Short saved successfully" });
    }

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

// DELETE /api/user/saved - Remove a post or short from saved items
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser || !authUser.id) return unauthorized();

  try {
    const { postId, shortId } = await request.json();
    const userId = authUser.id;

    if (shortId) {
      await prisma.$executeRaw`
        DELETE FROM "SavedShort" WHERE "userId" = ${userId} AND "shortId" = ${shortId}
      `;
      return NextResponse.json({ success: true, message: "Short unsaved successfully" });
    }

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
