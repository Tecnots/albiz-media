import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";

function resolveImage(image: string | null): string | null {
  if (!image) return null;
  if (blobStorageService.isAvailable) {
    const blobName = blobStorageService.extractBlobName(image);
    if (blobName) return blobStorageService.getFileUrl(blobName);
  }
  return image;
}

// Explore Trending Posts — ranked by actual engagement (likes + comments×3)
// No freshness boost, no velocity, no jitter — purely what has the most real engagement.
// Only posts with at least 1 engagement action appear.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6"), 20);

  try {
    // Count real engagement from normalized tables (not the string stats field)
    // PostLike = 1pt, PostComment = 3pt — same weights as X-algorithm
    const rows = await prisma.$queryRaw<{
      id: number;
      userId: number;
      type: string;
      title: string | null;
      content: string | null;
      image: string | null;
      tags: string[];
      views: string;
      likes: string;
      comments: string;
      shares: string;
      engagementScore: bigint;
    }[]>`
      SELECT
        p.id,
        p."userId",
        p.type,
        p.title,
        p.content,
        p.image,
        p.tags,
        p.views,
        p.likes,
        p.comments,
        p.shares,
        (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
      FROM "Post" p
      LEFT JOIN "PostLike" pl ON pl."postId" = p.id
      LEFT JOIN "PostComment" pc ON pc."postId" = p.id
      WHERE (p.status = 'published' OR p.status IS NULL)
        AND p."createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY p.id
      HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
      ORDER BY "engagementScore" DESC, p."createdAt" DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    const authorIds = [...new Set(rows.map(r => r.userId))];
    const authors = await prisma.$queryRaw<{
      id: number; name: string; handle: string; avatar: string | null;
    }[]>`
      SELECT id, name, handle, avatar FROM "User"
      WHERE id = ANY(${authorIds}::int[])
    `.catch(() => []);

    const authorMap = new Map(authors.map(a => [a.id, a]));

    const posts = rows.map(r => {
      const author = authorMap.get(r.userId);
      return {
        id:    r.id,
        type:  r.type,
        title: r.title,
        content: r.content,
        image: resolveImage(r.image),
        tags:  r.tags ?? [],
        stats: { views: r.views, likes: r.likes, comments: r.comments, shares: r.shares },
        engagementScore: Number(r.engagementScore),
        user: author
          ? { id: author.id, name: author.name, handle: author.handle, avatar: author.avatar }
          : null,
      };
    });

    return NextResponse.json({ posts });
  } catch (err: any) {
    console.error("Explore trending error:", err?.message);
    return NextResponse.json({ posts: [] });
  }
}
