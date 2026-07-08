import { prisma } from "@/lib/prisma";
import {
  SHORTS_FOLLOWING_POOL, SHORTS_INTEREST_POOL,
  SHORTS_COLLAB_POOL, SHORTS_LOCAL_POOL,
  COLD_START_CREATOR_THRESHOLD,
} from "./signals";

// ── CandidateShort ────────────────────────────────────────────────────────────

export interface CandidateShort {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  format: string;
  tags: string[];
  countryCode: string | null;
  contentScope: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  publishedAt: Date | null;
  createdAt: Date;
  source: "following" | "interest" | "collaborative" | "local";
  creatorIsNew: boolean;
}

function mapRow(r: any, source: CandidateShort["source"]): CandidateShort {
  return {
    id:           r.id,
    userId:       Number(r.userId),
    title:        r.title ?? "",
    description:  r.description ?? null,
    videoUrl:     r.videoUrl ?? "",
    thumbnailUrl: r.thumbnailUrl ?? null,
    format:       r.format ?? "vertical",
    tags:         r.tags ?? [],
    countryCode:  r.countryCode ?? null,
    contentScope: r.contentScope ?? "GLOBAL",
    views:        Number(r.views ?? 0),
    likes:        Number(r.likes ?? 0),
    shares:       Number(r.shares ?? 0),
    comments:     Number(r.comments ?? 0),
    publishedAt:  r.publishedAt ? new Date(r.publishedAt) : null,
    createdAt:    r.createdAt   ? new Date(r.createdAt)   : new Date(),
    source,
    creatorIsNew: r.creatorShortCount !== undefined
      ? Number(r.creatorShortCount) < COLD_START_CREATOR_THRESHOLD
      : false,
  };
}

// Sentinel to safely pass empty arrays to ANY(). Postgres ANY(-1) never matches.
function safeArr(ids: (number | string)[]): number[] {
  return ids.length > 0 ? ids.map(Number) : [-1];
}

// ── Following pool (Thunder) ──────────────────────────────────────────────────

export async function getFollowingShorts(
  followingIds: number[],
  seenIds: Set<number>,
  limit = SHORTS_FOLLOWING_POOL,
): Promise<CandidateShort[]> {
  if (followingIds.length === 0) return [];
  try {
    const seen = safeArr(Array.from(seenIds));
    const rows = await prisma.$queryRaw<any[]>`
      SELECT s.*,
        (SELECT COUNT(*) FROM "Short" s2
         WHERE s2."userId" = s."userId" AND s2.status = 'published') AS "creatorShortCount"
      FROM "Short" s
      JOIN "User" u ON u.id = s."userId"
        AND u.banned = false AND u."deactivatedAt" IS NULL
      WHERE s."userId" = ANY(${followingIds}::int[])
        AND s.status   = 'published'
        AND s.flagged  = false
        AND NOT (s.id = ANY(${seen}::int[]))
      ORDER BY COALESCE(s."publishedAt", s."createdAt") DESC NULLS LAST
      LIMIT ${limit}
    `;
    return rows.map(r => mapRow(r, "following"));
  } catch { return []; }
}

// ── Interest pool (Phoenix) ───────────────────────────────────────────────────

export async function getInterestShorts(
  userTags: string[],
  excludeUserIds: number[],
  seenIds: Set<number>,
  limit = SHORTS_INTEREST_POOL,
): Promise<CandidateShort[]> {
  const seen    = safeArr(Array.from(seenIds));
  const exclude = safeArr(excludeUserIds);
  const cutoff  = 30;

  try {
    if (userTags.length > 0) {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT s.*,
          (SELECT COUNT(*) FROM "Short" s2
           WHERE s2."userId" = s."userId" AND s2.status = 'published') AS "creatorShortCount"
        FROM "Short" s
        JOIN "User" u ON u.id = s."userId"
          AND u.banned = false AND u."deactivatedAt" IS NULL
        WHERE s.status  = 'published'
          AND s.flagged = false
          AND NOT (s."userId" = ANY(${exclude}::int[]))
          AND NOT (s.id       = ANY(${seen}::int[]))
          AND s.tags && ${userTags}::text[]
          AND COALESCE(s."publishedAt", s."createdAt") > NOW() - make_interval(days => ${cutoff})
        ORDER BY COALESCE(s."publishedAt", s."createdAt") DESC NULLS LAST
        LIMIT ${limit}
      `;
      return rows.map(r => mapRow(r, "interest"));
    }

    // Cold-start fallback: no interest tags — recency-sorted
    const rows = await prisma.$queryRaw<any[]>`
      SELECT s.*,
        (SELECT COUNT(*) FROM "Short" s2
         WHERE s2."userId" = s."userId" AND s2.status = 'published') AS "creatorShortCount"
      FROM "Short" s
      JOIN "User" u ON u.id = s."userId"
        AND u.banned = false AND u."deactivatedAt" IS NULL
      WHERE s.status  = 'published'
        AND s.flagged = false
        AND NOT (s."userId" = ANY(${exclude}::int[]))
        AND NOT (s.id       = ANY(${seen}::int[]))
        AND COALESCE(s."publishedAt", s."createdAt") > NOW() - make_interval(days => ${cutoff})
      ORDER BY COALESCE(s."publishedAt", s."createdAt") DESC NULLS LAST
      LIMIT ${limit}
    `;
    return rows.map(r => mapRow(r, "interest"));
  } catch { return []; }
}

// ── Collaborative pool ────────────────────────────────────────────────────────
// CTE finds users with overlapping positive interactions, then surfaces their shorts.
// Returns empty until ShortWatchEvent accumulates sufficient data.

export async function getCollaborativeShorts(
  userId: number,
  seenIds: Set<number>,
  limit = SHORTS_COLLAB_POOL,
): Promise<CandidateShort[]> {
  try {
    const seen = safeArr(Array.from(seenIds));
    const rows = await prisma.$queryRaw<any[]>`
      WITH similar_users AS (
        SELECT swe2."userId" AS sim_id, COUNT(*) AS overlap
        FROM "ShortWatchEvent" swe1
        JOIN "ShortWatchEvent" swe2
          ON  swe1."shortId"  = swe2."shortId"
          AND swe2."userId"  != ${userId}
          AND swe2."userId"  IS NOT NULL
          AND swe2.action    IN ('like','share','complete','follow_after')
        WHERE swe1."userId"  = ${userId}
          AND swe1.action    IN ('like','share','complete','follow_after')
        GROUP BY swe2."userId"
        ORDER BY overlap DESC
        LIMIT 30
      ),
      candidate_ids AS (
        SELECT DISTINCT swe."shortId"
        FROM "ShortWatchEvent" swe
        JOIN similar_users su ON swe."userId" = su.sim_id
        WHERE swe.action IN ('like','share','complete','follow_after')
          AND NOT (swe."shortId" = ANY(${seen}::int[]))
      )
      SELECT s.*,
        (SELECT COUNT(*) FROM "Short" s2
         WHERE s2."userId" = s."userId" AND s2.status = 'published') AS "creatorShortCount"
      FROM "Short" s
      JOIN "User" u ON u.id = s."userId"
        AND u.banned = false AND u."deactivatedAt" IS NULL
      JOIN candidate_ids ci ON s.id = ci."shortId"
      WHERE s.status  = 'published'
        AND s.flagged = false
        AND s."userId" != ${userId}
      ORDER BY COALESCE(s."publishedAt", s."createdAt") DESC NULLS LAST
      LIMIT ${limit}
    `;
    return rows.map(r => mapRow(r, "collaborative"));
  } catch { return []; }
}

// ── Local pool ────────────────────────────────────────────────────────────────

export async function getLocalShorts(
  countryCode: string,
  excludeUserIds: number[],
  seenIds: Set<number>,
  limit = SHORTS_LOCAL_POOL,
): Promise<CandidateShort[]> {
  const seen    = safeArr(Array.from(seenIds));
  const exclude = safeArr(excludeUserIds);
  const cutoff  = 14;
  const cc      = countryCode.toUpperCase();

  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT s.*,
        (SELECT COUNT(*) FROM "Short" s2
         WHERE s2."userId" = s."userId" AND s2.status = 'published') AS "creatorShortCount"
      FROM "Short" s
      JOIN "User" u ON u.id = s."userId"
        AND u.banned = false AND u."deactivatedAt" IS NULL
      WHERE s.status  = 'published'
        AND s.flagged = false
        AND NOT (s."userId" = ANY(${exclude}::int[]))
        AND NOT (s.id       = ANY(${seen}::int[]))
        AND UPPER(COALESCE(s."countryCode", '')) = ${cc}
        AND COALESCE(s."publishedAt", s."createdAt") > NOW() - make_interval(days => ${cutoff})
      ORDER BY COALESCE(s."publishedAt", s."createdAt") DESC NULLS LAST
      LIMIT ${limit}
    `;
    return rows.map(r => mapRow(r, "local"));
  } catch { return []; }
}