import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
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
// Supports ?scope=local|regional|global via countryCode from user profile.
// No freshness boost, no velocity, no jitter — purely what has the most real engagement.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6"), 20);
  // scope: "local" = same country, "global" = worldwide (default fallback when local has <3 results)
  const scope = searchParams.get("scope") ?? "local";

  // Resolve user's country for local trending
  let userCountryCode: string | null = null;
  if (scope === "local") {
    const authUser = await getAuthUser(req);
    if (authUser?.id) {
      const rows = await prisma.$queryRaw<{ countryCode: string | null }[]>`
        SELECT "countryCode" FROM "User" WHERE id = ${authUser.id}
      `.catch(() => []);
      userCountryCode = rows[0]?.countryCode ?? null;
    }
    // Also check Vercel header as fallback
    if (!userCountryCode) {
      userCountryCode = req.headers.get("x-vercel-ip-country") ?? null;
    }
  }

  try {
    let rows: any[];

    if (scope === "local" && userCountryCode) {
      // Country-scoped trending — posts from the same country in the last 7 days
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares, p."countryCode",
          (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
        FROM "Post" p
        LEFT JOIN "PostLike" pl ON pl."postId" = p.id
        LEFT JOIN "PostComment" pc ON pc."postId" = p.id
        WHERE (p.status = 'published' OR p.status IS NULL)
          AND p."createdAt" > NOW() - INTERVAL '7 days'
          AND UPPER(p."countryCode") = UPPER(${userCountryCode})
        GROUP BY p.id
        HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
        ORDER BY "engagementScore" DESC, p."createdAt" DESC
        LIMIT ${limit}
      `;

      // If fewer than limit local results, fall back to global to fill the widget
      if (rows.length < limit) {
        const existingIds: number[] = rows.map((r: any) => r.id);
        const fillLimit = limit - rows.length;
        let globalRows: any[] = [];
        if (existingIds.length > 0) {
          globalRows = await prisma.$queryRaw<any[]>`
            SELECT
              p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
              p.views, p.likes, p.comments, p.shares, p."countryCode",
              (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
            FROM "Post" p
            LEFT JOIN "PostLike" pl ON pl."postId" = p.id
            LEFT JOIN "PostComment" pc ON pc."postId" = p.id
            WHERE (p.status = 'published' OR p.status IS NULL)
              AND p."createdAt" > NOW() - INTERVAL '7 days'
              AND NOT (p.id = ANY(${existingIds}::int[]))
            GROUP BY p.id
            HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
            ORDER BY "engagementScore" DESC, p."createdAt" DESC
            LIMIT ${fillLimit}
          `.catch(() => []);
        } else {
          globalRows = await prisma.$queryRaw<any[]>`
            SELECT
              p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
              p.views, p.likes, p.comments, p.shares, p."countryCode",
              (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
            FROM "Post" p
            LEFT JOIN "PostLike" pl ON pl."postId" = p.id
            LEFT JOIN "PostComment" pc ON pc."postId" = p.id
            WHERE (p.status = 'published' OR p.status IS NULL)
              AND p."createdAt" > NOW() - INTERVAL '7 days'
            GROUP BY p.id
            HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
            ORDER BY "engagementScore" DESC, p."createdAt" DESC
            LIMIT ${fillLimit}
          `.catch(() => []);
        }
        rows = [...rows, ...globalRows];
      }
    } else {
      // Global trending
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares, p."countryCode",
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
    }

    // Fallback 1: remove the HAVING filter — include posts with 0 engagement, still within 7 days
    if (rows.length < limit) {
      const existingIds = rows.map((r: any) => r.id);
      const fillLimit = limit - rows.length;
      let fbRows: any[] = [];
      if (existingIds.length > 0) {
        fbRows = await prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
            p.views, p.likes, p.comments, p.shares, p."countryCode",
            (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
          FROM "Post" p
          LEFT JOIN "PostLike" pl ON pl."postId" = p.id
          LEFT JOIN "PostComment" pc ON pc."postId" = p.id
          WHERE (p.status = 'published' OR p.status IS NULL)
            AND p."createdAt" > NOW() - INTERVAL '7 days'
            AND NOT (p.id = ANY(${existingIds}::int[]))
          GROUP BY p.id
          ORDER BY "engagementScore" DESC, p."createdAt" DESC
          LIMIT ${fillLimit}
        `.catch(() => []);
      } else {
        fbRows = await prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
            p.views, p.likes, p.comments, p.shares, p."countryCode",
            (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
          FROM "Post" p
          LEFT JOIN "PostLike" pl ON pl."postId" = p.id
          LEFT JOIN "PostComment" pc ON pc."postId" = p.id
          WHERE (p.status = 'published' OR p.status IS NULL)
            AND p."createdAt" > NOW() - INTERVAL '7 days'
          GROUP BY p.id
          ORDER BY "engagementScore" DESC, p."createdAt" DESC
          LIMIT ${fillLimit}
        `.catch(() => []);
      }
      rows = [...rows, ...fbRows];
    }

    // Fallback 2: remove both HAVING and time window — show the most-engaged posts ever
    if (rows.length < limit) {
      const existingIds = rows.map((r: any) => r.id);
      const fillLimit = limit - rows.length;
      let fbRows: any[] = [];
      if (existingIds.length > 0) {
        fbRows = await prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
            p.views, p.likes, p.comments, p.shares, p."countryCode",
            (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
          FROM "Post" p
          LEFT JOIN "PostLike" pl ON pl."postId" = p.id
          LEFT JOIN "PostComment" pc ON pc."postId" = p.id
          WHERE (p.status = 'published' OR p.status IS NULL)
            AND NOT (p.id = ANY(${existingIds}::int[]))
          GROUP BY p.id
          ORDER BY "engagementScore" DESC, p."createdAt" DESC
          LIMIT ${fillLimit}
        `.catch(() => []);
      } else {
        fbRows = await prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
            p.views, p.likes, p.comments, p.shares, p."countryCode",
            (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "engagementScore"
          FROM "Post" p
          LEFT JOIN "PostLike" pl ON pl."postId" = p.id
          LEFT JOIN "PostComment" pc ON pc."postId" = p.id
          WHERE (p.status = 'published' OR p.status IS NULL)
          GROUP BY p.id
          ORDER BY "engagementScore" DESC, p."createdAt" DESC
          LIMIT ${fillLimit}
        `.catch(() => []);
      }
      rows = [...rows, ...fbRows];
    }

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
        countryCode: r.countryCode ?? null,
        stats: { views: r.views, likes: r.likes, comments: r.comments, shares: r.shares },
        engagementScore: Number(r.engagementScore),
        user: author
          ? { id: author.id, name: author.name, handle: author.handle, avatar: author.avatar }
          : null,
      };
    });

    return NextResponse.json({ posts, scope, countryCode: userCountryCode });
  } catch (err: any) {
    console.error("Explore trending error:", err?.message);
    return NextResponse.json({ posts: [] });
  }
}
