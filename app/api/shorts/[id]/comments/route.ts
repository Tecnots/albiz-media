import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkCommentAbuse } from "@/lib/abuse-detection";
import { blobStorageService } from "@/lib/blob-storage";

// Mirrors app/api/posts/[id]/comments/route.ts's shape and pagination
// behavior exactly, backed by ShortComment instead of PostComment, and using
// the ShortLike-style authoritative recount (Short.comments is a plain int,
// unlike Post's display-string counter) instead of increment/decrement math.

// Get comments for a short — supports cursor-based pagination.
//   ?parentId absent → top-level comments (parentId IS NULL), newest first,
//                      each annotated with its replyCount.
//   ?parentId=<id>   → replies to that top-level comment, oldest first.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const shortId = Number(id);
    if (!shortId) return NextResponse.json({ error: "Invalid short ID" }, { status: 400 });

    const cursorParam = request.nextUrl.searchParams.get("cursor");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const parentIdParam = request.nextUrl.searchParams.get("parentId");
    const cursor = cursorParam ? Number(cursorParam) : null;
    const limit = Math.min(Math.max(1, parseInt(limitParam ?? "20", 10) || 20), 50);
    const parentId = parentIdParam ? Number(parentIdParam) : null;

    let rows: any[];

    if (parentId) {
      rows = cursor
        ? await prisma.$queryRaw<any[]>`
            SELECT c.id, c.text, c."userId", c."createdAt", c."parentId",
                   u.name, u.handle, u.avatar, u.verified
            FROM "ShortComment" c
            JOIN "User" u ON u.id = c."userId"
            WHERE c."shortId" = ${shortId} AND c."parentId" = ${parentId} AND c.id > ${cursor}
            ORDER BY c.id ASC
            LIMIT ${limit + 1}
          `
        : await prisma.$queryRaw<any[]>`
            SELECT c.id, c.text, c."userId", c."createdAt", c."parentId",
                   u.name, u.handle, u.avatar, u.verified
            FROM "ShortComment" c
            JOIN "User" u ON u.id = c."userId"
            WHERE c."shortId" = ${shortId} AND c."parentId" = ${parentId}
            ORDER BY c.id ASC
            LIMIT ${limit + 1}
          `;
    } else {
      rows = cursor
        ? await prisma.$queryRaw<any[]>`
            SELECT c.id, c.text, c."userId", c."createdAt", c."parentId",
                   u.name, u.handle, u.avatar, u.verified,
                   (SELECT COUNT(*)::int FROM "ShortComment" r WHERE r."parentId" = c.id) AS "replyCount"
            FROM "ShortComment" c
            JOIN "User" u ON u.id = c."userId"
            WHERE c."shortId" = ${shortId} AND c."parentId" IS NULL AND c.id < ${cursor}
            ORDER BY c.id DESC
            LIMIT ${limit + 1}
          `
        : await prisma.$queryRaw<any[]>`
            SELECT c.id, c.text, c."userId", c."createdAt", c."parentId",
                   u.name, u.handle, u.avatar, u.verified,
                   (SELECT COUNT(*)::int FROM "ShortComment" r WHERE r."parentId" = c.id) AS "replyCount"
            FROM "ShortComment" c
            JOIN "User" u ON u.id = c."userId"
            WHERE c."shortId" = ${shortId} AND c."parentId" IS NULL
            ORDER BY c.id DESC
            LIMIT ${limit + 1}
          `;
    }

    const hasMore = rows.length > limit;
    const comments = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? comments[comments.length - 1].id : null;

    const resolved = comments.map((c: any) => ({
      ...c,
      avatar: blobStorageService.resolveMediaUrl(c.avatar),
      replyCount: parentId ? undefined : Number(c.replyCount ?? 0),
    }));

    return NextResponse.json({ comments: resolved, nextCursor, hasMore });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function recountComments(shortId: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "ShortComment" WHERE "shortId" = ${shortId}
  `;
  const count = Number(rows[0]?.count ?? 0);
  await prisma.$executeRaw`UPDATE "Short" SET comments = ${count} WHERE id = ${shortId}`.catch(() => {});
  return count;
}

// Add a comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const commentLimit = await rateLimit(`comment:${authUser.id}`, 30, 60 * 1000);
  if (!commentLimit.allowed) {
    return NextResponse.json(commentLimit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((commentLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  const commentAbuse = await checkCommentAbuse(authUser.id);
  if (commentAbuse.blocked) {
    return NextResponse.json({ error: commentAbuse.reason }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((commentAbuse.retryAfterMs ?? 60_000) / 1000)) },
    });
  }

  try {
    const { id } = await params;
    const shortId = Number(id);
    if (!shortId) return NextResponse.json({ error: "Invalid short ID" }, { status: 400 });

    const body = await request.json();
    const text = body.text?.trim()?.slice(0, 2000);
    const userId = authUser.id;
    if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

    const shortCheck = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM "Short" WHERE id = ${shortId} LIMIT 1`;
    if (!shortCheck.length) return NextResponse.json({ error: "Short not found" }, { status: 404 });

    // Same one-level flattening as Posts: a reply always attaches to the
    // original top-level comment, even if replying to a reply.
    let parentId: number | null = null;
    const requestedParentId = Number(body.parentId) || null;
    if (requestedParentId) {
      const parentRows = await prisma.$queryRaw<{ id: number; shortId: number; parentId: number | null }[]>`
        SELECT id, "shortId", "parentId" FROM "ShortComment" WHERE id = ${requestedParentId} LIMIT 1
      `;
      const parentComment = parentRows[0];
      if (!parentComment || parentComment.shortId !== shortId) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
      parentId = parentComment.parentId ?? parentComment.id;
    }

    await prisma.$executeRaw`
      INSERT INTO "ShortComment" ("shortId", "userId", "text", "parentId", "createdAt")
      VALUES (${shortId}, ${userId}, ${text.trim()}, ${parentId}, NOW())
    `;

    const totalComments = await recountComments(shortId);

    const newComment = await prisma.$queryRaw<any[]>`
      SELECT c.id, c.text, c."userId", c."createdAt", c."parentId",
             u.name, u.handle, u.avatar, u.verified
      FROM "ShortComment" c
      JOIN "User" u ON u.id = c."userId"
      WHERE c."shortId" = ${shortId}
      ORDER BY c.id DESC
      LIMIT 1
    `;

    const created = newComment[0];
    if (!created) return NextResponse.json({ success: true, totalComments });

    return NextResponse.json({
      ...created,
      avatar: blobStorageService.resolveMediaUrl(created.avatar),
      replyCount: created.parentId ? undefined : 0,
      totalComments,
    });
  } catch (err: any) {
    console.error("[shorts/comments POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete a comment (owner-only, same permission model as Posts)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { id } = await params;
    const shortId = Number(id);
    const { commentId } = await request.json();
    if (!commentId) return NextResponse.json({ error: "Missing commentId" }, { status: 400 });

    const owned = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "ShortComment" WHERE id = ${commentId} AND "userId" = ${authUser.id}
    `;
    if (!owned.length) {
      return NextResponse.json({ success: false, error: "Comment not found" }, { status: 404 });
    }

    await prisma.$executeRaw`DELETE FROM "ShortComment" WHERE id = ${commentId} AND "userId" = ${authUser.id}`;

    const totalComments = await recountComments(shortId);

    return NextResponse.json({ success: true, totalComments });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
