import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

function resolveImage(image: string | null): string | null {
  return blobStorageService.resolveMediaUrl(image);
}

// Explore Trending Posts — ranked by time-decayed engagement (likes×1 + comments×3),
// with a 7-day half-life so recent engagement beats old virality.
// Moderation: excludes flagged posts, banned users, and deactivated users.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6"), 20);
  const scope = searchParams.get("scope") ?? "local";

  let userCountryCode: string | null = null;
  if (scope === "local") {
    const authUser = await getAuthUser(req);
    if (authUser?.id) {
      const rows = await prisma.$queryRaw<{ countryCode: string | null }[]>`
        SELECT "countryCode" FROM "User" WHERE id = ${authUser.id}
      `.catch(() => []);
      userCountryCode = rows[0]?.countryCode ?? null;
    }
    if (!userCountryCode) {
      userCountryCode = req.headers.get("x-vercel-ip-country") ?? null;
    }
  }

  // Time-decayed engagement score:
  //   rawEngagement = likes×1 + comments×3
  //   decayedScore  = rawEngagement × EXP(-ageSeconds / halfLifeSeconds)
  // Half-life of 7 days means a post loses half its score every week,
  // preventing month-old viral posts from dominating the widget indefinitely.
  const HALF_LIFE_SECONDS = 7 * 24 * 3600; // 7 days

  try {
    let rows: any[];

    if (scope === "local" && userCountryCode) {
      // Country-scoped trending — last 7 days, time-decayed by engagement
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares, p."countryCode",
          (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "rawEngagement",
          (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3)
            * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(p."createdAt", NOW()))) / ${HALF_LIFE_SECONDS}::float)
            AS "engagementScore"
        FROM "Post" p
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        LEFT JOIN "PostLike"    pl ON pl."postId" = p.id
        LEFT JOIN "PostComment" pc ON pc."postId" = p.id
        WHERE (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND p."createdAt" > NOW() - INTERVAL '7 days'
          AND UPPER(p."countryCode") = UPPER(${userCountryCode})
        GROUP BY p.id
        HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
        ORDER BY "engagementScore" DESC, p."createdAt" DESC
        LIMIT ${limit}
      `;

      // Fill remaining slots from global if local is thin
      if (rows.length < limit) {
        const existingIds = rows.map((r: any) => r.id);
        const fillLimit   = limit - rows.length;
        const globalRows = existingIds.length > 0
          ? await prisma.$queryRaw<any[]>`
              SELECT
                p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
                p.views, p.likes, p.comments, p.shares, p."countryCode",
                (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "rawEngagement",
                (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3)
                  * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(p."createdAt", NOW()))) / ${HALF_LIFE_SECONDS}::float)
                  AS "engagementScore"
              FROM "Post" p
              JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
              LEFT JOIN "PostLike"    pl ON pl."postId" = p.id
              LEFT JOIN "PostComment" pc ON pc."postId" = p.id
              WHERE (p.status = 'published' OR p.status IS NULL)
                AND p.flagged = false
                AND p."createdAt" > NOW() - INTERVAL '7 days'
                AND NOT (p.id = ANY(${existingIds}::int[]))
              GROUP BY p.id
              HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
              ORDER BY "engagementScore" DESC, p."createdAt" DESC
              LIMIT ${fillLimit}
            `.catch(() => [])
          : await prisma.$queryRaw<any[]>`
              SELECT
                p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
                p.views, p.likes, p.comments, p.shares, p."countryCode",
                (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "rawEngagement",
                (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3)
                  * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(p."createdAt", NOW()))) / ${HALF_LIFE_SECONDS}::float)
                  AS "engagementScore"
              FROM "Post" p
              JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
              LEFT JOIN "PostLike"    pl ON pl."postId" = p.id
              LEFT JOIN "PostComment" pc ON pc."postId" = p.id
              WHERE (p.status = 'published' OR p.status IS NULL)
                AND p.flagged = false
                AND p."createdAt" > NOW() - INTERVAL '7 days'
              GROUP BY p.id
              HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
              ORDER BY "engagementScore" DESC, p."createdAt" DESC
              LIMIT ${fillLimit}
            `.catch(() => []);
        rows = [...rows, ...globalRows];
      }
    } else {
      // Global trending — last 7 days
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares, p."countryCode",
          (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "rawEngagement",
          (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3)
            * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(p."createdAt", NOW()))) / ${HALF_LIFE_SECONDS}::float)
            AS "engagementScore"
        FROM "Post" p
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        LEFT JOIN "PostLike"    pl ON pl."postId" = p.id
        LEFT JOIN "PostComment" pc ON pc."postId" = p.id
        WHERE (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND p."createdAt" > NOW() - INTERVAL '7 days'
        GROUP BY p.id
        HAVING (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) > 0
        ORDER BY "engagementScore" DESC, p."createdAt" DESC
        LIMIT ${limit}
      `;
    }

    // Fallback 1: include 0-engagement posts within 7 days (no HAVING filter)
    if (rows.length < limit) {
      const existingIds = rows.map((r: any) => r.id);
      const fillLimit   = limit - rows.length;
      const fbRows = existingIds.length > 0
        ? await prisma.$queryRaw<any[]>`
            SELECT
              p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
              p.views, p.likes, p.comments, p.shares, p."countryCode",
              0 AS "rawEngagement",
              0::float AS "engagementScore"
            FROM "Post" p
            JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
            WHERE (p.status = 'published' OR p.status IS NULL)
              AND p.flagged = false
              AND p."createdAt" > NOW() - INTERVAL '7 days'
              AND NOT (p.id = ANY(${existingIds}::int[]))
            ORDER BY p."createdAt" DESC
            LIMIT ${fillLimit}
          `.catch(() => [])
        : await prisma.$queryRaw<any[]>`
            SELECT
              p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
              p.views, p.likes, p.comments, p.shares, p."countryCode",
              0 AS "rawEngagement",
              0::float AS "engagementScore"
            FROM "Post" p
            JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
            WHERE (p.status = 'published' OR p.status IS NULL)
              AND p.flagged = false
              AND p."createdAt" > NOW() - INTERVAL '7 days'
            ORDER BY p."createdAt" DESC
            LIMIT ${fillLimit}
          `.catch(() => []);
      rows = [...rows, ...fbRows];
    }

    // Fallback 2: extend window to 30 days max — never unlimited so old virality can't dominate.
    if (rows.length < limit) {
      const existingIds = rows.map((r: any) => r.id);
      const fillLimit   = limit - rows.length;
      const fbRows = existingIds.length > 0
        ? await prisma.$queryRaw<any[]>`
            SELECT
              p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
              p.views, p.likes, p.comments, p.shares, p."countryCode",
              (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "rawEngagement",
              (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3)
                * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(p."createdAt", NOW()))) / ${HALF_LIFE_SECONDS}::float)
                AS "engagementScore"
            FROM "Post" p
            JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
            LEFT JOIN "PostLike"    pl ON pl."postId" = p.id
            LEFT JOIN "PostComment" pc ON pc."postId" = p.id
            WHERE (p.status = 'published' OR p.status IS NULL)
              AND p.flagged = false
              AND p."createdAt" > NOW() - INTERVAL '30 days'
              AND NOT (p.id = ANY(${existingIds}::int[]))
            GROUP BY p.id
            ORDER BY "engagementScore" DESC, p."createdAt" DESC
            LIMIT ${fillLimit}
          `.catch(() => [])
        : await prisma.$queryRaw<any[]>`
            SELECT
              p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
              p.views, p.likes, p.comments, p.shares, p."countryCode",
              (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3) AS "rawEngagement",
              (COUNT(DISTINCT pl.id) * 1 + COUNT(DISTINCT pc.id) * 3)
                * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(p."createdAt", NOW()))) / ${HALF_LIFE_SECONDS}::float)
                AS "engagementScore"
            FROM "Post" p
            JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
            LEFT JOIN "PostLike"    pl ON pl."postId" = p.id
            LEFT JOIN "PostComment" pc ON pc."postId" = p.id
            WHERE (p.status = 'published' OR p.status IS NULL)
              AND p.flagged = false
              AND p."createdAt" > NOW() - INTERVAL '30 days'
            GROUP BY p.id
            ORDER BY "engagementScore" DESC, p."createdAt" DESC
            LIMIT ${fillLimit}
          `.catch(() => []);
      rows = [...rows, ...fbRows];
    }

    if (rows.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    const authorIds = [...new Set(rows.map(r => r.userId))];
    const authors   = await prisma.$queryRaw<{
      id: number; name: string; handle: string; avatar: string | null;
    }[]>`
      SELECT id, name, handle, avatar FROM "User"
      WHERE id = ANY(${authorIds}::int[])
        AND banned = false AND "deactivatedAt" IS NULL
    `.catch(() => []);

    const authorMap = new Map(authors.map(a => [a.id, a]));

    const posts = rows.map(r => {
      const author = authorMap.get(r.userId);
      return {
        id:              r.id,
        type:            r.type,
        title:           r.title,
        content:         r.content,
        image:           resolveImage(r.image),
        tags:            r.tags ?? [],
        countryCode:     r.countryCode ?? null,
        stats:           { views: r.views, likes: r.likes, comments: r.comments, shares: r.shares },
        engagementScore: Number(r.engagementScore),
        user: author
          ? { id: author.id, name: author.name, handle: author.handle, avatar: resolveImage(author.avatar) }
          : null,
      };
    });

    return NextResponse.json({ posts, scope, countryCode: userCountryCode });
  } catch (err: any) {
    console.error("Explore trending error:", err?.message);
    return NextResponse.json({ posts: [] });
  }
}