import { prisma } from "@/lib/prisma";
import { IN_NETWORK_POOL_SIZE, OUT_OF_NETWORK_POOL_SIZE, LOCAL_POOL_SIZE } from "./signals";
import { ScoringModeConfig } from "./scoringModes";

export interface CandidatePost {
  id: number;
  userId: number;
  type: string;
  content: string | null;
  title: string | null;
  description: string | null;
  date: string;
  time: string | null;
  image: string | null;
  tags: string[];
  // Human-readable display strings — kept for backward compat; prefer integer fields below.
  views: string;
  likes: string;
  comments: string;
  shares: string;
  // Integer engagement counters — populated via migration backfill; used by ranking engine.
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  createdAt: Date;
  source: "in-network" | "out-of-network" | "local";
  countryCode?: string | null;
  contentScope?: string | null;
}

// Exported so callers building their own raw-SQL candidate queries (the
// feed route's trending-injection reader, etc.) don't need a second copy of
// this exact mapping.
export function mapRow(r: any, source: CandidatePost["source"]): CandidatePost {
  return {
    ...r,
    type:          r.type?.toLowerCase() ?? "post",
    tags:          r.tags ?? [],
    source,
    countryCode:   r.countryCode  ?? null,
    contentScope:  r.contentScope ?? "GLOBAL",
    likesCount:    Number(r.likesCount    ?? 0),
    commentsCount: Number(r.commentsCount ?? 0),
    sharesCount:   Number(r.sharesCount   ?? 0),
    viewsCount:    Number(r.viewsCount    ?? 0),
  };
}

// Thunder pool: recent posts from followed users, ordered by recency
export async function getInNetworkCandidates(
  followingIds: number[],
  seenPostIds: Set<number>,
  limit = IN_NETWORK_POOL_SIZE
): Promise<CandidatePost[]> {
  if (followingIds.length === 0) return [];

  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        p.id, p."userId", p.type, p.content, p.title, p.description,
        p.date, p.time, p.image, p.tags,
        p.views, p.likes, p.comments, p.shares,
        COALESCE(p."likesCount", 0)    AS "likesCount",
        COALESCE(p."commentsCount", 0) AS "commentsCount",
        COALESCE(p."sharesCount", 0)   AS "sharesCount",
        COALESCE(p."viewsCount", 0)    AS "viewsCount",
        COALESCE(p."createdAt", NOW()) AS "createdAt",
        p."countryCode", p."contentScope"
      FROM "Post" p
      JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
      WHERE
        p."userId" = ANY(${followingIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
        AND p.flagged = false
      ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
      LIMIT ${limit}
    `;

    return rows
      .filter(r => !seenPostIds.has(r.id))
      .map(r => mapRow(r, "in-network"));
  } catch {
    return [];
  }
}

// Local pool: recent posts from the user's own country — regardless of follow graph
export async function getLocalCandidates(
  userCountryCode: string,
  excludeUserIds: number[],
  seenPostIds: Set<number>,
  limit = LOCAL_POOL_SIZE
): Promise<CandidatePost[]> {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        p.id, p."userId", p.type, p.content, p.title, p.description,
        p.date, p.time, p.image, p.tags,
        p.views, p.likes, p.comments, p.shares,
        COALESCE(p."likesCount", 0)    AS "likesCount",
        COALESCE(p."commentsCount", 0) AS "commentsCount",
        COALESCE(p."sharesCount", 0)   AS "sharesCount",
        COALESCE(p."viewsCount", 0)    AS "viewsCount",
        COALESCE(p."createdAt", NOW()) AS "createdAt",
        p."countryCode", p."contentScope"
      FROM "Post" p
      JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
      WHERE
        (p.status = 'published' OR p.status IS NULL)
        AND p.flagged = false
        AND NOT (p."userId" = ANY(${excludeUserIds}::int[]))
        AND UPPER(p."countryCode") = UPPER(${userCountryCode})
        AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => 168)
      ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
      LIMIT ${limit}
    `;

    return rows
      .filter(r => !seenPostIds.has(r.id))
      .map(r => mapRow(r, "local"));
  } catch {
    return [];
  }
}

// Phoenix pool: out-of-network posts discovered by tag similarity + velocity
export async function getOutOfNetworkCandidates(
  excludeUserIds: number[],
  userTags: string[],
  seenPostIds: Set<number>,
  limit = OUT_OF_NETWORK_POOL_SIZE
): Promise<CandidatePost[]> {
  const cutoffHours = 168;

  let rows: any[];

  try {
    if (userTags.length > 0) {
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.content, p.title, p.description,
          p.date, p.time, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares,
          COALESCE(p."likesCount", 0)    AS "likesCount",
          COALESCE(p."commentsCount", 0) AS "commentsCount",
          COALESCE(p."sharesCount", 0)   AS "sharesCount",
          COALESCE(p."viewsCount", 0)    AS "viewsCount",
          COALESCE(p."createdAt", NOW()) AS "createdAt",
          p."countryCode", p."contentScope"
        FROM "Post" p
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        WHERE
          (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND NOT (p."userId" = ANY(${excludeUserIds}::int[]))
          AND p.tags && ${userTags}::text[]
          AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoffHours})
        ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.content, p.title, p.description,
          p.date, p.time, p.image, p.tags,
          p.views, p.likes, p.comments, p.shares,
          COALESCE(p."likesCount", 0)    AS "likesCount",
          COALESCE(p."commentsCount", 0) AS "commentsCount",
          COALESCE(p."sharesCount", 0)   AS "sharesCount",
          COALESCE(p."viewsCount", 0)    AS "viewsCount",
          COALESCE(p."createdAt", NOW()) AS "createdAt",
          p."countryCode", p."contentScope"
        FROM "Post" p
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        WHERE
          (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND NOT (p."userId" = ANY(${excludeUserIds}::int[]))
          AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoffHours})
        ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
        LIMIT ${limit}
      `;
    }
  } catch {
    return [];
  }

  return rows
    .filter(r => !seenPostIds.has(r.id))
    .map(r => mapRow(r, "out-of-network"));
}

// Collaborative filtering pool: posts liked by users with similar taste
export async function getCollaborativeCandidates(
  userId: number,
  seenPostIds: Set<number>,
  limit = 100
): Promise<CandidatePost[]> {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      WITH similar_users AS (
        SELECT pl2."userId" AS sim_id, COUNT(*) AS overlap
        FROM "PostLike" pl1
        JOIN "PostLike" pl2
          ON pl1."postId" = pl2."postId"
          AND pl2."userId" != ${userId}
        WHERE pl1."userId" = ${userId}
        GROUP BY pl2."userId"
        ORDER BY overlap DESC
        LIMIT 30
      ),
      candidate_posts AS (
        SELECT DISTINCT pl."postId"
        FROM "PostLike" pl
        JOIN similar_users su ON pl."userId" = su.sim_id
        WHERE pl."postId" NOT IN (
          SELECT "postId" FROM "PostImpression" WHERE "userId" = ${userId}
        )
      )
      SELECT
        p.id, p."userId", p.type, p.content, p.title, p.description,
        p.date, p.time, p.image, p.tags,
        p.views, p.likes, p.comments, p.shares,
        COALESCE(p."likesCount", 0)    AS "likesCount",
        COALESCE(p."commentsCount", 0) AS "commentsCount",
        COALESCE(p."sharesCount", 0)   AS "sharesCount",
        COALESCE(p."viewsCount", 0)    AS "viewsCount",
        COALESCE(p."createdAt", NOW()) AS "createdAt",
        p."countryCode", p."contentScope"
      FROM "Post" p
      JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
      JOIN candidate_posts cp ON p.id = cp."postId"
      WHERE (p.status = 'published' OR p.status IS NULL)
        AND p.flagged = false
        AND p."userId" != ${userId}
      ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
      LIMIT ${limit}
    `;

    return rows
      .filter(r => !seenPostIds.has(r.id))
      .map(r => mapRow(r, "out-of-network"));
  } catch {
    return [];
  }
}

// Anonymous candidates — no personalization
export async function getAnonymousCandidates(
  seenPostIds: Set<number>,
  limit = 100
): Promise<CandidatePost[]> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      p.id, p."userId", p.type, p.content, p.title, p.description,
      p.date, p.time, p.image, p.tags,
      p.views, p.likes, p.comments, p.shares,
      COALESCE(p."likesCount", 0)    AS "likesCount",
      COALESCE(p."commentsCount", 0) AS "commentsCount",
      COALESCE(p."sharesCount", 0)   AS "sharesCount",
      COALESCE(p."viewsCount", 0)    AS "viewsCount",
      COALESCE(p."createdAt", NOW()) AS "createdAt",
      p."countryCode", p."contentScope"
    FROM "Post" p
    JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
    WHERE (p.status = 'published' OR p.status IS NULL)
      AND p.flagged = false
    ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
    LIMIT ${limit}
  `;

  return rows
    .filter(r => !seenPostIds.has(r.id))
    .map(r => mapRow(r, "out-of-network"));
}

// ── shared candidate generation for every feed mode ─────────────────────────
// Promoted from app/api/feed/route.ts's former private `getCandidates` — this
// is the "same candidate generation pipeline" every mode (including
// trending) shares. Callers pass a ScoringModeConfig (SCORING_MODES[mode])
// instead of the old route-local FeedConfig.
export async function getRankingCandidates(
  cfg: ScoringModeConfig,
  userId: number,
  followingIds: number[],
  userTags: string[],
  seenIds: Set<number>,
  userCountryCode?: string | null
): Promise<CandidatePost[]> {
  const cutoffHours = cfg.maxAgeHours ?? 168;
  const excludeIds = [userId, ...followingIds];
  const tagFilter = cfg.pool.tagFilter;

  if (cfg.pool.onlyInNetwork) {
    if (followingIds.length === 0) return [];
    try {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.content, p.title, p.description,
          p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
          COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
          COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
          COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
        FROM "Post" p
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        WHERE p."userId" = ANY(${followingIds}::int[])
          AND (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
        ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
        LIMIT 300
      `;
      return rows.map(r => mapRow(r, "in-network"));
    } catch { return []; }
  }

  if (tagFilter && tagFilter.length > 0) {
    try {
      const lowerTagFilter = tagFilter.map((t: string) => t.toLowerCase());
      let rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.content, p.title, p.description,
          p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
          COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
          COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
          COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
        FROM "Post" p
        JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
        WHERE (p.status = 'published' OR p.status IS NULL)
          AND p.flagged = false
          AND EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE lower(tag) = ANY(${lowerTagFilter}::text[]))
          AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoffHours})
        ORDER BY p."createdAt" DESC NULLS LAST
        LIMIT 300
      `.catch(() => []);

      if (rows.length === 0) {
        rows = await prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.content, p.title, p.description,
            p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
            COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
            COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
            COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
          FROM "Post" p
          JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
          WHERE (p.status = 'published' OR p.status IS NULL)
            AND p.flagged = false
            AND EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE lower(tag) = ANY(${lowerTagFilter}::text[]))
          ORDER BY p."createdAt" DESC NULLS LAST
          LIMIT 300
        `.catch(() => []);
      }

      return rows.map(r => ({
        ...mapRow(r, "out-of-network"),
        source: (followingIds.includes(r.userId) ? "in-network" : "out-of-network") as CandidatePost["source"],
      }));
    } catch { return []; }
  }

  // For You + Trending + Local: in-network + out-of-network + optional collaborative + optional local pool
  const [inRows, outRows, collabRows, localRows] = await Promise.all([
    followingIds.length > 0
      ? prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.content, p.title, p.description,
            p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
            COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
            COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
            COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
          FROM "Post" p
          JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
          WHERE p."userId" = ANY(${followingIds}::int[])
            AND (p.status = 'published' OR p.status IS NULL)
            AND p.flagged = false
          ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC LIMIT 200
        `.catch(() => [])
      : Promise.resolve([]),

    userTags.length > 0
      ? prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.content, p.title, p.description,
            p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
            COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
            COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
            COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
          FROM "Post" p
          JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
          WHERE (p.status = 'published' OR p.status IS NULL)
            AND p.flagged = false
            AND NOT (p."userId" = ANY(${excludeIds}::int[]))
            AND p.tags && ${userTags}::text[]
            AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoffHours})
          ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC LIMIT 200
        `.catch(() => [])
      : prisma.$queryRaw<any[]>`
          SELECT
            p.id, p."userId", p.type, p.content, p.title, p.description,
            p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
            COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
            COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
            COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
          FROM "Post" p
          JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
          WHERE (p.status = 'published' OR p.status IS NULL)
            AND p.flagged = false
            AND NOT (p."userId" = ANY(${excludeIds}::int[]))
            AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoffHours})
          ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC LIMIT 200
        `.catch(() => []),

    cfg.pool.useCollaborativePool
      ? getCollaborativeCandidates(userId, seenIds, 100)
      : Promise.resolve([]),

    cfg.pool.useLocalPool && userCountryCode
      ? getLocalCandidates(userCountryCode, excludeIds, seenIds, 200)
      : Promise.resolve([]),
  ]);

  const inNetwork = (inRows as any[]).map(r => mapRow(r, "in-network"));
  let outOfNetwork = (outRows as any[]).map(r => mapRow(r, "out-of-network"));
  const collab = collabRows as CandidatePost[];
  const local = localRows as CandidatePost[];

  if (outOfNetwork.length === 0) {
    const fallbackRows = await prisma.$queryRaw<any[]>`
      SELECT
        p.id, p."userId", p.type, p.content, p.title, p.description,
        p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
        COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
        COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
        COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
      FROM "Post" p
      JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
      WHERE (p.status = 'published' OR p.status IS NULL)
        AND p.flagged = false
        AND NOT (p."userId" = ANY(${excludeIds}::int[]))
      ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC LIMIT 200
    `.catch(() => []);
    outOfNetwork = (fallbackRows as any[]).map(r => mapRow(r, "out-of-network"));
  }

  if (inNetwork.length === 0 && outOfNetwork.length === 0 && local.length === 0) {
    const fallbackRows = await prisma.$queryRaw<any[]>`
      SELECT
        p.id, p."userId", p.type, p.content, p.title, p.description,
        p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
        COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
        COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
        COALESCE(p."createdAt", NOW()) as "createdAt", p."countryCode", p."contentScope", p.slug
      FROM "Post" p
      JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
      WHERE (p.status = 'published' OR p.status IS NULL)
        AND p.flagged = false
        AND NOT (p."userId" = ANY(${excludeIds}::int[]))
      ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC LIMIT 200
    `.catch(() => []);
    return (fallbackRows as any[]).map(r => mapRow(r, "out-of-network"));
  }

  // Deduplicate across pools before returning — the same post can appear in
  // both the in-network pool (followed author) and the collab pool (similar-user liked).
  const dedupIds = new Set<number>(seenIds);
  return [...inNetwork, ...outOfNetwork, ...collab, ...local].filter(p => {
    if (dedupIds.has(p.id)) return false;
    dedupIds.add(p.id);
    return true;
  });
}