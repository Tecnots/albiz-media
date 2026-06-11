import { prisma } from "@/lib/prisma";
import { IN_NETWORK_POOL_SIZE, OUT_OF_NETWORK_POOL_SIZE, LOCAL_POOL_SIZE } from "./signals";

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
  views: string;
  likes: string;
  comments: string;
  shares: string;
  createdAt: Date;
  source: "in-network" | "out-of-network" | "local";
  countryCode?: string | null;
  contentScope?: string | null;
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
        p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
        COALESCE(p."createdAt", NOW()) as "createdAt",
        p."countryCode", p."contentScope"
      FROM "Post" p
      WHERE
        p."userId" = ANY(${followingIds}::int[])
        AND (p.status = 'published' OR p.status IS NULL)
      ORDER BY p."createdAt" DESC NULLS LAST, p.id DESC
      LIMIT ${limit}
    `;

    return rows
      .filter(r => !seenPostIds.has(r.id))
      .map(r => ({
        ...r,
        type: r.type?.toLowerCase() ?? "post",
        tags: r.tags ?? [],
        source: "in-network" as const,
        countryCode: r.countryCode ?? null,
        contentScope: r.contentScope ?? "GLOBAL",
      }));
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
        p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
        COALESCE(p."createdAt", NOW()) as "createdAt",
        p."countryCode", p."contentScope"
      FROM "Post" p
      WHERE
        (p.status = 'published' OR p.status IS NULL)
        AND NOT (p."userId" = ANY(${excludeUserIds}::int[]))
        AND UPPER(p."countryCode") = UPPER(${userCountryCode})
        AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => 168)
      ORDER BY p."createdAt" DESC NULLS LAST
      LIMIT ${limit}
    `;

    return rows
      .filter(r => !seenPostIds.has(r.id))
      .map(r => ({
        ...r,
        type: r.type?.toLowerCase() ?? "post",
        tags: r.tags ?? [],
        source: "local" as const,
        countryCode: r.countryCode ?? null,
        contentScope: r.contentScope ?? "GLOBAL",
      }));
  } catch {
    return [];
  }
}

// Phoenix pool: out-of-network posts discovered by tag similarity + velocity
// Approximates the two-tower embedding retrieval with tag co-occurrence overlap
export async function getOutOfNetworkCandidates(
  excludeUserIds: number[],   // current user + followed users
  userTags: string[],          // user's interest tags
  seenPostIds: Set<number>,
  limit = OUT_OF_NETWORK_POOL_SIZE
): Promise<CandidatePost[]> {
  const cutoffHours = 168; // look back 7 days

  let rows: any[];

  try {
    if (userTags.length > 0) {
      // Tag-similarity retrieval: posts whose tags overlap with user's interests
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.content, p.title, p.description,
          p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
          COALESCE(p."createdAt", NOW()) as "createdAt",
          p."countryCode", p."contentScope"
        FROM "Post" p
        WHERE
          (p.status = 'published' OR p.status IS NULL)
          AND NOT (p."userId" = ANY(${excludeUserIds}::int[]))
          AND p.tags && ${userTags}::text[]
          AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoffHours})
        ORDER BY p."createdAt" DESC NULLS LAST
        LIMIT ${limit}
      `;
    } else {
      // No tag preference: fallback to high-engagement recent posts
      rows = await prisma.$queryRaw<any[]>`
        SELECT
          p.id, p."userId", p.type, p.content, p.title, p.description,
          p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
          COALESCE(p."createdAt", NOW()) as "createdAt",
          p."countryCode", p."contentScope"
        FROM "Post" p
        WHERE
          (p.status = 'published' OR p.status IS NULL)
          AND NOT (p."userId" = ANY(${excludeUserIds}::int[]))
          AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoffHours})
        ORDER BY p."createdAt" DESC NULLS LAST
        LIMIT ${limit}
      `;
    }
  } catch {
    return [];
  }

  return rows
    .filter(r => !seenPostIds.has(r.id))
    .map(r => ({
      ...r,
      type: r.type?.toLowerCase() ?? "post",
      tags: r.tags ?? [],
      source: "out-of-network" as const,
      countryCode: r.countryCode ?? null,
      contentScope: r.contentScope ?? "GLOBAL",
    }));
}

// Collaborative filtering pool: posts liked by users with similar taste
// Finds users who liked the same posts as the current user, then surfaces their other likes
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
        p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
        COALESCE(p."createdAt", NOW()) as "createdAt",
        p."countryCode", p."contentScope"
      FROM "Post" p
      JOIN candidate_posts cp ON p.id = cp."postId"
      WHERE (p.status = 'published' OR p.status IS NULL)
        AND p."userId" != ${userId}
      ORDER BY p."createdAt" DESC NULLS LAST
      LIMIT ${limit}
    `;

    return rows
      .filter(r => !seenPostIds.has(r.id))
      .map(r => ({
        ...r,
        type: r.type?.toLowerCase() ?? "post",
        tags: r.tags ?? [],
        source: "out-of-network" as const,
        countryCode: r.countryCode ?? null,
        contentScope: r.contentScope ?? "GLOBAL",
      }));
  } catch {
    return [];
  }
}

// Load posts for anonymous users (no personalization)
export async function getAnonymousCandidates(
  seenPostIds: Set<number>,
  limit = 100
): Promise<CandidatePost[]> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      p.id, p."userId", p.type, p.content, p.title, p.description,
      p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
      COALESCE(p."createdAt", NOW()) as "createdAt",
      p."countryCode", p."contentScope"
    FROM "Post" p
    WHERE (p.status = 'published' OR p.status IS NULL)
    ORDER BY p."createdAt" DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows
    .filter(r => !seenPostIds.has(r.id))
    .map(r => ({
      ...r,
      type: r.type?.toLowerCase() ?? "post",
      tags: r.tags ?? [],
      source: "out-of-network" as const,
      countryCode: r.countryCode ?? null,
      contentScope: r.contentScope ?? "GLOBAL",
    }));
}
