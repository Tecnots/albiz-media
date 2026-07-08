import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

function resolveImage(image: string | null): string | null {
  return blobStorageService.resolveMediaUrl(image);
}

// Explore "Trending Now" post grid — a thin reader of TrendingScore, the
// durable cache the periodic recompute-trending job maintains (see
// lib/workers/trending-worker.ts) via the same computeScore()/SCORING_MODES
// engine the Home Feed and feed's own "Trending" tab use. This route no
// longer scores anything itself — it only applies moderation/visibility
// filtering and country-scope preference at read time.
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

  try {
    let rows: any[] = [];

    if (scope === "local" && userCountryCode) {
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares, p."countryCode",
          ts.score AS "engagementScore"
        FROM "TrendingScore" ts
        JOIN "Post" p ON p.id = ts."postId"
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        WHERE (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND UPPER(p."countryCode") = UPPER(${userCountryCode})
        ORDER BY ts.score DESC
        LIMIT ${limit}
      `.catch(() => []);
    }

    // Fill remaining slots from global trending if local is thin (or scope=global).
    if (rows.length < limit) {
      const existingIds = rows.map((r: any) => r.id);
      const fillLimit = limit - rows.length;
      const globalRows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares, p."countryCode",
          ts.score AS "engagementScore"
        FROM "TrendingScore" ts
        JOIN "Post" p ON p.id = ts."postId"
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        WHERE (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND NOT (p.id = ANY(${existingIds}::int[]))
        ORDER BY ts.score DESC
        LIMIT ${fillLimit}
      `.catch(() => []);
      rows = [...rows, ...globalRows];
    }

    // Last-resort fallback: TrendingScore hasn't been populated yet (e.g. right
    // after deploy, before the first recompute-trending run) — fall back to
    // recent posts rather than showing an empty widget.
    if (rows.length < limit) {
      const existingIds = rows.map((r: any) => r.id);
      const fillLimit = limit - rows.length;
      const fbRows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.title, p.content, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares, p."countryCode",
          0::float AS "engagementScore"
        FROM "Post" p
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        WHERE (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND NOT (p.id = ANY(${existingIds}::int[]))
        ORDER BY p."createdAt" DESC
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
