import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

// GET /api/hashtag/[tag] — posts + stories tagged with #tag.
// Applies the same server-side visibility rule as /api/stories: only
// public stories are visible to non-Circle/anonymous callers.
export async function GET(req: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const clean = decodeURIComponent(tag).replace(/^#/, "").toLowerCase();
  if (!clean) return NextResponse.json({ error: "Missing tag" }, { status: 400 });

  const authUser = await getAuthUser(req);
  const canSeeCircle = authUser?.role === "CIRCLE" || authUser?.role === "ADMIN";
  const visibilityClause = canSeeCircle
    ? Prisma.sql`(s.visibility = 'public' OR s.visibility = 'circle')`
    : Prisma.sql`s.visibility = 'public'`;

  const [posts, stories] = await Promise.all([
    prisma.$queryRaw<{ id: number; userId: number; content: string | null; image: string | null; createdAt: Date }[]>`
      SELECT p.id, p."userId", p.content, p.image, p."createdAt"
      FROM "Post" p
      WHERE p.status = 'published'
        AND EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE lower(t) = ${clean})
      ORDER BY p."createdAt" DESC
      LIMIT 50
    `,
    prisma.$queryRaw<{ id: number; userId: number; imageUrl: string; createdAt: Date }[]>`
      SELECT s.id, s."userId", s."imageUrl", s."createdAt"
      FROM "Story" s
      WHERE s.status = 'published'
        AND s."expiresAt" > NOW()
        AND ${visibilityClause}
        AND jsonb_typeof(s.stickers) = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(s.stickers) elem
          WHERE elem->>'type' = 'hashtag' AND lower(elem->'data'->>'tag') = ${clean}
        )
      ORDER BY s."createdAt" DESC
      LIMIT 50
    `,
  ]);

  const userIds = Array.from(new Set([...posts.map((p) => p.userId), ...stories.map((s) => s.userId)]));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, handle: true, avatar: true, verified: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, { ...u, avatar: blobStorageService.resolveMediaUrl(u.avatar) }]));

  return NextResponse.json({
    tag: clean,
    posts: posts.map((p) => ({
      id: p.id,
      content: p.content,
      image: blobStorageService.resolveMediaUrl(p.image),
      createdAt: p.createdAt.toISOString(),
      user: userMap.get(p.userId) ?? null,
    })),
    stories: stories.map((s) => ({
      id: s.id,
      imageUrl: blobStorageService.resolveMediaUrl(s.imageUrl),
      createdAt: s.createdAt.toISOString(),
      user: userMap.get(s.userId) ?? null,
    })),
  });
}
