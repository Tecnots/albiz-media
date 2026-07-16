import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { applyPreScoringFilters } from "@/app/lib/algorithm/filters";
import { UserContext } from "@/app/lib/algorithm/scorer";
import { computeScore, RankingContext } from "@/app/lib/algorithm/computeScore";
import { applyDiversityAdjustment, interleaveBySource } from "@/app/lib/algorithm/diversity";
import { getRankingCandidates, mapRow, CandidatePost } from "@/app/lib/algorithm/candidates";
import { passesGeoFilter } from "@/app/lib/algorithm/geo";
import { extractTrendingFeatures } from "@/app/lib/algorithm/trendingSignals";
import { FeedMode, SCORING_MODES } from "@/app/lib/algorithm/scoringModes";
import { blobStorageService } from "@/lib/blob-storage";
import {
  SOCIAL_PROOF_MIN_COUNT,
  TRENDING_INJECTION_POSITION,
  ENGAGEMENT_RECENCY_DECAY,
} from "@/app/lib/algorithm/signals";

export type { FeedMode };

// Max cursor offset — prevents stale infinite-scroll sessions from fetching irrelevant content.
const MAX_CURSOR_OFFSET = 500;
// Cursor session TTL in seconds — expired cursors reset to page 0.
const CURSOR_SESSION_TTL_S = 7200; // 2 hours

// ── Opaque cursor encoding ────────────────────────────────────────────────────
// Encodes {offset, timestamp} as a base64url string so clients cannot construct
// arbitrary offsets, and so stale sessions (> 2h) automatically reset to page 0.
function encodeCursor(offset: number): string {
  const payload = JSON.stringify({ o: offset, t: Math.floor(Date.now() / 1000) });
  return Buffer.from(payload).toString("base64url");
}

function decodeCursor(raw: string | null | undefined): number {
  if (!raw || raw === "0") return 0;

  // Legacy: plain integer string sent by old clients.
  const asInt = parseInt(raw);
  if (!isNaN(asInt) && String(asInt) === raw) {
    return Math.max(0, Math.min(asInt, MAX_CURSOR_OFFSET));
  }

  // New: base64url-encoded {o, t}
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const ageSeconds = Math.floor(Date.now() / 1000) - (decoded.t ?? 0);
    if (ageSeconds > CURSOR_SESSION_TTL_S) return 0; // expired — start fresh
    return Math.max(0, Math.min(decoded.o ?? 0, MAX_CURSOR_OFFSET));
  } catch {
    return 0;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function getUserCountryCode(userId: number): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ countryCode: string | null }[]>`
      SELECT "countryCode" FROM "User" WHERE id = ${userId}
    `;
    return rows[0]?.countryCode ?? null;
  } catch { return null; }
}

async function getMutedIds(userId: number): Promise<Set<number>> {
  try {
    const rows = await prisma.$queryRaw<{ mutedId: number }[]>`
      SELECT "mutedId" FROM "UserMute" WHERE "userId" = ${userId}
    `;
    return new Set(rows.map(r => r.mutedId));
  } catch { return new Set(); }
}

// Bidirectional block list: returns all user IDs the current user must never see,
// regardless of who initiated the block.
async function getBlockedIds(userId: number): Promise<Set<number>> {
  try {
    const rows = await prisma.$queryRaw<{ uid: number }[]>`
      SELECT "blockedId" AS uid FROM "BlockedUser" WHERE "blockerId" = ${userId}
      UNION
      SELECT "blockerId" AS uid FROM "BlockedUser" WHERE "blockedId"  = ${userId}
    `;
    return new Set(rows.map(r => r.uid));
  } catch { return new Set(); }
}

async function getSeenPostIds(userId: number): Promise<Set<number>> {
  try {
    const rows = await prisma.$queryRaw<{ postId: number }[]>`
      SELECT "postId" FROM "PostImpression"
      WHERE "userId" = ${userId} AND "seenAt" > NOW() - make_interval(hours => 24)
    `;
    return new Set(rows.map(r => r.postId));
  } catch { return new Set(); }
}

// Build full user context with recency-weighted engagement history
async function getUserContext(
  userId: number,
  followingIds: number[],
  userTags: string[],
  socialProof: Map<number, number>,
  userCountryCode?: string | null,
  localMode?: boolean,
  seenPostIds?: Set<number>
): Promise<UserContext> {
  try {
    const [engRows, authorRows] = await Promise.all([
      prisma.$queryRaw<{ postId: number; action: string; value: number; createdAt: Date }[]>`
        SELECT "postId", action, COALESCE(value, 1.0) as value, "createdAt"
        FROM "PostEngagement"
        WHERE "userId" = ${userId}
          AND "createdAt" > NOW() - make_interval(days => 30)
        ORDER BY "createdAt" DESC
      `,
      prisma.$queryRaw<{ userId: number; action: string; totalWeight: number }[]>`
        SELECT p."userId", pe.action,
               SUM(COALESCE(pe.value, 1.0) * POWER(${ENGAGEMENT_RECENCY_DECAY}::float,
                 EXTRACT(day FROM (NOW() - pe."createdAt"))
               )) AS "totalWeight"
        FROM "PostEngagement" pe
        JOIN "Post" p ON p.id = pe."postId"
        WHERE pe."userId" = ${userId}
          AND pe."createdAt" > NOW() - make_interval(days => 30)
        GROUP BY p."userId", pe.action
      `,
    ]);

    const engagementHistory = new Map<number, { action: string; value: number; daysAgo: number }[]>();
    let totalEngagements = 0;
    for (const row of engRows) {
      const daysAgo = (Date.now() - new Date(row.createdAt).getTime()) / 86_400_000;
      const existing = engagementHistory.get(row.postId) ?? [];
      existing.push({ action: row.action, value: Number(row.value), daysAgo });
      engagementHistory.set(row.postId, existing);
      totalEngagements++;
    }

    const authorHistory = new Map<number, Record<string, number>>();
    for (const row of authorRows) {
      const existing = authorHistory.get(row.userId) ?? {};
      existing[row.action] = Number(row.totalWeight);
      authorHistory.set(row.userId, existing);
    }

    return {
      followingIds: new Set(followingIds),
      userTags,
      engagementHistory,
      authorHistory,
      totalEngagements,
      socialProof,
      seenPostIds,
      userCountryCode: userCountryCode ?? null,
      localMode: localMode ?? false,
    };
  } catch {
    return {
      followingIds: new Set(followingIds),
      userTags,
      engagementHistory: new Map(),
      authorHistory: new Map(),
      totalEngagements: 0,
      socialProof,
      seenPostIds,
      userCountryCode: userCountryCode ?? null,
      localMode: localMode ?? false,
    };
  }
}

// Social proof: count followed users who liked or commented each out-of-network post
async function getSocialProof(
  postIds: number[],
  followingIds: number[]
): Promise<Map<number, number>> {
  if (postIds.length === 0 || followingIds.length === 0) return new Map();
  try {
    const rows = await prisma.$queryRaw<{ postId: number; count: bigint }[]>`
      SELECT "postId", COUNT(DISTINCT "userId") AS count
      FROM (
        SELECT "postId", "userId" FROM "PostLike"
        WHERE "postId" = ANY(${postIds}::int[]) AND "userId" = ANY(${followingIds}::int[])
        UNION
        SELECT "postId", "userId" FROM "PostComment"
        WHERE "postId" = ANY(${postIds}::int[]) AND "userId" = ANY(${followingIds}::int[])
      ) AS combined
      GROUP BY "postId"
      HAVING COUNT(DISTINCT "userId") >= ${SOCIAL_PROOF_MIN_COUNT}
    `;
    return new Map(rows.map(r => [r.postId, Number(r.count)]));
  } catch { return new Map(); }
}

// Top trending post for injection into the For You feed — now a thin
// TrendingScore reader instead of its own bespoke raw-SQL scoring, so this
// no longer duplicates trending logic (it was previously a like-count-only
// approximation completely separate from the real trending computation).
async function getTrendingInjection(
  excludeIds: Set<number>,
  seenIds: Set<number>
): Promise<CandidatePost | null> {
  try {
    const excludeArr = Array.from(excludeIds);
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        p.id, p."userId", p.type, p.content, p.title, p.description,
        p.date, p.time, p.image, p.tags, p.views, p.likes, p.comments, p.shares,
        COALESCE(p."likesCount", 0) AS "likesCount", COALESCE(p."commentsCount", 0) AS "commentsCount",
        COALESCE(p."sharesCount", 0) AS "sharesCount", COALESCE(p."viewsCount", 0) AS "viewsCount",
        COALESCE(p."createdAt", NOW()) AS "createdAt", p."countryCode", p."contentScope", p.slug
      FROM "TrendingScore" ts
      JOIN "Post" p ON p.id = ts."postId"
      JOIN "User" ua ON ua.id = p."userId" AND ua.banned = false AND ua."deactivatedAt" IS NULL
      WHERE (p.status = 'published' OR p.status IS NULL)
        AND p.flagged = false
        AND NOT (p."userId" = ANY(${excludeArr}::int[]))
      ORDER BY ts.score DESC
      LIMIT 5
    `.catch(() => []);

    const candidate = rows.find(r => !seenIds.has(r.id));
    if (!candidate) return null;
    return mapRow(candidate, "out-of-network");
  } catch { return null; }
}

// Batch markAsSeen — single query instead of N sequential inserts
async function markAsSeen(userId: number, postsWithPositions: { id: number; position: number }[]) {
  if (postsWithPositions.length === 0) return;
  try {
    const postIds   = postsWithPositions.map(p => p.id);
    const positions = postsWithPositions.map(p => p.position);
    await prisma.$executeRaw`
      INSERT INTO "PostImpression" ("userId", "postId", "seenAt", position)
      SELECT ${userId}, post_id, NOW(), pos
      FROM unnest(${postIds}::int[], ${positions}::int[]) AS t(post_id, pos)
      ON CONFLICT ("userId", "postId") DO NOTHING
    `;
  } catch { /* non-critical */ }
}

function resolveImage(image: string | null): string | null {
  return blobStorageService.resolveMediaUrl(image);
}

// Exploration jitter — small random perturbation on first page only
function applyExplorationJitter<T extends { score: number }>(scored: T[]): T[] {
  if (scored.length === 0) return scored;
  const median = scored[Math.floor(scored.length / 2)].score;
  return scored.map(s => {
    const distance = median > 0 ? Math.abs(s.score - median) / median : 0;
    const jitterRange = Math.max(0.05, 0.15 - distance * 0.1);
    const jitter = 1 - jitterRange + Math.random() * jitterRange * 2;
    return { ...s, score: s.score * jitter };
  });
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode      = (searchParams.get("mode") ?? "for-you") as FeedMode;
  const rawCursor = searchParams.get("cursor") ?? "0";
  const cursor    = decodeCursor(rawCursor);
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const cfg       = SCORING_MODES[mode] ?? SCORING_MODES["for-you"];

  const authUser = await getAuthUser(req);
  const userId   = authUser?.id || 0;

  // ── Anonymous path ────────────────────────────────────────────────────────
  if (!userId) {
    if (mode === "following") {
      return NextResponse.json({
        posts: [], nextCursor: encodeCursor(0), hasMore: false, total: 0, empty: "sign_in",
      });
    }

    try {
      const anonCountryCode   = req.headers.get("x-vercel-ip-country") ?? null;
      const cutoff            = cfg.maxAgeHours;
      const tagFilter         = cfg.pool.tagFilter;
      const lowerTagFilterAnon = tagFilter ? tagFilter.map((t: string) => t.toLowerCase()) : [];

      let rows: any[];
      if (tagFilter && tagFilter.length > 0) {
        rows = cutoff !== undefined
          ? await prisma.$queryRaw<any[]>`
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
                AND EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE lower(tag) = ANY(${lowerTagFilterAnon}::text[]))
                AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoff})
              ORDER BY p."createdAt" DESC NULLS LAST
              LIMIT 200
            `
          : await prisma.$queryRaw<any[]>`
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
                AND EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE lower(tag) = ANY(${lowerTagFilterAnon}::text[]))
              ORDER BY p."createdAt" DESC NULLS LAST
              LIMIT 200
            `;
        if (rows.length < limit && cutoff !== undefined) {
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
              AND EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE lower(tag) = ANY(${lowerTagFilterAnon}::text[]))
            ORDER BY p."createdAt" DESC NULLS LAST
            LIMIT 200
          `.catch(() => []);
        }
      } else {
        rows = cutoff !== undefined
          ? await prisma.$queryRaw<any[]>`
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
                AND COALESCE(p."createdAt", NOW()) > NOW() - make_interval(hours => ${cutoff})
              ORDER BY p."createdAt" DESC NULLS LAST
              LIMIT 200
            `
          : await prisma.$queryRaw<any[]>`
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
              ORDER BY p."createdAt" DESC NULLS LAST
              LIMIT 200
            `;
        if (rows.length < limit && cutoff !== undefined) {
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
            ORDER BY p."createdAt" DESC NULLS LAST
            LIMIT 200
          `.catch(() => []);
        }
      }

      let candidates: CandidatePost[] = rows.map(r => mapRow(r, "out-of-network"));
      candidates = candidates.filter(p => passesGeoFilter(p, anonCountryCode));

      const authorUserIds = [...new Set(candidates.map(p => p.userId))];
      const authorUsers   = await prisma.$queryRaw<any[]>`
        SELECT id, verified, "isPremium", role, followers
        FROM "User" WHERE id = ANY(${authorUserIds}::int[])
          AND banned = false AND "deactivatedAt" IS NULL
      `.catch(() => []);

      const anonCtx: UserContext = {
        followingIds:      new Set(),
        userTags:          [],
        engagementHistory: new Map(),
        authorHistory:     new Map(),
        totalEngagements:  0,
        socialProof:       new Map(),
        userCountryCode:   anonCountryCode,
      };
      (anonCtx as any).userMap = new Map(authorUsers.map((u: any) => [u.id, u]));

      const anonTrendingFeatures = mode === "trending"
        ? await extractTrendingFeatures(candidates.map(p => p.id))
        : undefined;
      const anonRankingCtx: RankingContext = { userContext: anonCtx, trendingFeatures: anonTrendingFeatures };
      let scored = candidates.map(p => computeScore(p, anonRankingCtx, mode));

      scored.sort((a, b) => b.score - a.score || b.post.id - a.post.id);
      if (mode !== "trending" && cursor === 0) {
        scored = applyExplorationJitter(scored);
        scored.sort((a, b) => b.score - a.score || b.post.id - a.post.id);
      }

      const diverse = applyDiversityAdjustment(scored);

      if (mode === "for-you" && cursor === 0) {
        const injection = await getTrendingInjection(new Set(), new Set());
        const alreadyInFeed = diverse.some(s => s.post.id === injection?.id);
        if (injection && !alreadyInFeed && (injection.contentScope === "GLOBAL" || !injection.contentScope)) {
          const injFeatures = anonTrendingFeatures?.has(injection.id)
            ? anonTrendingFeatures
            : await extractTrendingFeatures([injection.id]);
          const injScore  = computeScore(injection, { userContext: anonCtx, trendingFeatures: injFeatures }, "trending");
          injScore.reason = "Trending right now";
          const pos = Math.min(TRENDING_INJECTION_POSITION - 1, diverse.length);
          diverse.splice(pos, 0, injScore);
        }
      }

      const page          = diverse.slice(cursor, cursor + limit);
      const anonReasonMap = new Map(page.map(s => [s.post.id, s.reason]));
      const enriched      = await enrichWithUsers(page.map(s => s.post), p => anonReasonMap.get(p.id));

      const res = NextResponse.json({
        posts:      enriched,
        nextCursor: encodeCursor(cursor + limit),
        hasMore:    page.length === limit,
        total:      diverse.length,
      });
      res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return res;
    } catch (err: any) {
      console.error("Anonymous feed error:", err?.message);
      return NextResponse.json({ posts: [], nextCursor: encodeCursor(0), hasMore: false, total: 0 });
    }
  }

  // ── Authenticated path ────────────────────────────────────────────────────
  const [followRows, blockedIds, mutedIds, seenIds, interestRows, userCountryCode] = await Promise.all([
    prisma.$queryRaw<{ followingId: number }[]>`SELECT "followingId" FROM "UserFollow" WHERE "followerId" = ${userId}`.catch(() => []),
    getBlockedIds(userId),
    getMutedIds(userId),
    getSeenPostIds(userId),
    prisma.$queryRaw<{ name: string }[]>`SELECT name FROM "UserInterest" WHERE "userId" = ${userId}`.catch(() => []),
    getUserCountryCode(userId),
  ]);

  const followingIds = (followRows as any[]).map(r => r.followingId);
  const userTags     = (interestRows as any[]).map(r => r.name);

  if (cfg.pool.onlyInNetwork && followingIds.length === 0) {
    return NextResponse.json({
      posts: [], nextCursor: encodeCursor(0), hasMore: false, total: 0, empty: "no_follows",
    });
  }

  const candidates = await getRankingCandidates(cfg, userId, followingIds, userTags, seenIds, userCountryCode);

  const outOfNetworkIds = candidates.filter(p => p.source === "out-of-network").map(p => p.id);
  const socialProof     = await getSocialProof(outOfNetworkIds, followingIds);

  const userCtx = await getUserContext(userId, followingIds, userTags, socialProof, userCountryCode, cfg.pool.localMode, seenIds);

  const authorUserIds = [...new Set(candidates.map(p => p.userId))];
  const authorUsers   = await prisma.$queryRaw<any[]>`
    SELECT id, verified, "isPremium", role, followers FROM "User"
    WHERE id = ANY(${authorUserIds}::int[])
      AND banned = false AND "deactivatedAt" IS NULL
  `.catch(() => []);
  (userCtx as any).userMap = new Map(authorUsers.map((u: any) => [u.id, u]));

  const seenFilter = mode === "for-you" ? new Set<number>() : seenIds;

  let filtered = applyPreScoringFilters(candidates, {
    seenPostIds:    seenFilter,
    blockedUserIds: blockedIds,
    mutedUserIds:   mutedIds,
    currentUserId:  userId,
    maxAgeHours:    cfg.maxAgeHours,
  });

  if (filtered.length === 0 && candidates.length > 0) {
    filtered = applyPreScoringFilters(candidates, {
      seenPostIds:    new Set(),
      blockedUserIds: blockedIds,
      mutedUserIds:   mutedIds,
      currentUserId:  userId,
      maxAgeHours:    cfg.maxAgeHours,
    });
  }

  filtered = filtered.filter(p => passesGeoFilter(p, userCountryCode));

  const trendingFeatures = cfg.useTrendingSignals
    ? await extractTrendingFeatures(filtered.map(p => p.id))
    : undefined;
  const rankingCtx: RankingContext = { userContext: userCtx, trendingFeatures };
  let scored = filtered.map(p => computeScore(p, rankingCtx, mode));

  scored.sort((a, b) => b.score - a.score || b.post.id - a.post.id);
  if (mode !== "trending" && cursor === 0) {
    scored = applyExplorationJitter(scored);
    scored.sort((a, b) => b.score - a.score || b.post.id - a.post.id);
  }

  const diverse = cfg.skipDiversity
    ? scored
    : applyDiversityAdjustment(interleaveBySource(scored));

  if (cfg.trendingInjection && cursor === 0) {
    const excludeSet = new Set([userId, ...followingIds]);
    const injection  = await getTrendingInjection(excludeSet, seenIds);
    const alreadyInFeed = diverse.some(s => s.post.id === injection?.id);
    if (injection && !alreadyInFeed && passesGeoFilter(injection, userCountryCode)) {
      const injFeatures = trendingFeatures?.has(injection.id)
        ? trendingFeatures
        : await extractTrendingFeatures([injection.id]);
      const injScore  = computeScore(injection, { userContext: userCtx, trendingFeatures: injFeatures }, "trending");
      injScore.reason = "Trending right now";
      const pos = Math.min(TRENDING_INJECTION_POSITION - 1, diverse.length);
      diverse.splice(pos, 0, injScore);
    }
  }

  const page = diverse.slice(cursor, cursor + limit);

  markAsSeen(userId, page.map((s, i) => ({ id: s.post.id, position: cursor + i + 1 }))).catch(() => {});

  const reasonMap = new Map(page.map(s => [s.post.id, s.reason]));
  const enriched  = await enrichWithUsers(page.map(s => s.post), p => reasonMap.get(p.id));

  return NextResponse.json({
    posts:      enriched,
    nextCursor: encodeCursor(cursor + limit),
    hasMore:    page.length === limit,
    total:      diverse.length,
  });
}

// ── enrich with user + article data ──────────────────────────────────────────

async function enrichWithUsers(posts: any[], getReason?: (p: any) => string | undefined) {
  if (posts.length === 0) return [];

  const userIds        = [...new Set(posts.map(p => p.userId))];
  const articlePostIds = posts.filter(p => p.type === "article").map(p => p.id);

  const [users, articleRows] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT id, name, handle, avatar, title, verified, "isPremium", role, followers, "hasStory"
      FROM "User"
      WHERE id = ANY(${userIds}::int[])
        AND banned = false AND "deactivatedAt" IS NULL
    `,
    articlePostIds.length > 0
      ? prisma.$queryRaw<any[]>`
          SELECT "postId", paragraphs FROM "ArticleContent"
          WHERE "postId" = ANY(${articlePostIds}::int[])
        `
      : Promise.resolve([]),
  ]);

  const userMap    = new Map(users.map(u => [u.id, { ...u, avatar: resolveImage(u.avatar) }]));
  const articleMap = new Map((articleRows as any[]).map(a => [a.postId, a.paragraphs]));

  return posts.map(post => ({
    id:           post.id,
    userId:       post.userId,
    type:         post.type,
    content:      post.content,
    title:        post.title,
    description:  post.description,
    date:         post.date,
    time:         post.time,
    image:        resolveImage(post.image),
    tags:         post.tags,
    source:       post.source,
    slug:         post.slug ?? null,
    reason:       getReason?.(post) ?? null,
    countryCode:  post.countryCode ?? null,
    contentScope: post.contentScope ?? "GLOBAL",
    stats: { views: post.views, likes: post.likes, comments: post.comments, shares: post.shares },
    articleContent: articleMap.has(post.id) ? { paragraphs: articleMap.get(post.id) } : undefined,
    user: userMap.get(post.userId) ?? null,
  }));
}