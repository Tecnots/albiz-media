import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { buildShortSummary } from "@/lib/shorts-response";

import { encodeCursor, decodeCursor, getBlockedIds, getMutedIds, getUserFollowingIds, getUserInterestTags, getUserCountryCode } from "@/app/lib/algorithm/shared";
import { getFollowingShorts, getInterestShorts, getCollaborativeShorts, getLocalShorts } from "@/app/lib/algorithm/shorts/candidates";
import { computeShortsScore, loadCreatorAffinity, ShortsUserContext } from "@/app/lib/algorithm/shorts/scorer";
import { applyPreScoringShortFilters } from "@/app/lib/algorithm/shorts/filters";
import { applyShortsDiversity, interleaveShortsBySource, applyExplorationJitter } from "@/app/lib/algorithm/shorts/diversity";
import { SHORTS_SEEN_WINDOW_HOURS } from "@/app/lib/algorithm/shorts/signals";

// ── Recently seen IDs (soft penalty, not hard exclusion) ──────────────────────

async function getRecentlySeenIds(userId: number): Promise<Set<number>> {
  try {
    const rows = await prisma.$queryRaw<{ shortId: number }[]>`
      SELECT DISTINCT "shortId"
      FROM "ShortWatchEvent"
      WHERE "userId" = ${userId}
        AND action   IN ('view','complete')
        AND "createdAt" > NOW() - make_interval(hours => ${SHORTS_SEEN_WINDOW_HOURS})
    `;
    return new Set(rows.map(r => Number(r.shortId)));
  } catch { return new Set(); }
}

// ── Creator metadata batch lookup ─────────────────────────────────────────────

interface CreatorData {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
  verified: boolean;
  isPremium: boolean;
  role: string;
  countryCode: string | null;
  followers: string;
}

async function loadCreatorData(userIds: number[]): Promise<Map<number, CreatorData>> {
  if (userIds.length === 0) return new Map();
  try {
    const rows = await prisma.$queryRaw<CreatorData[]>`
      SELECT id, name, handle, avatar, verified, "isPremium", role, country, followers
      FROM "User"
      WHERE id = ANY(${userIds}::int[])
        AND (banned = false OR banned IS NULL)
        AND "deactivatedAt" IS NULL
    `;
    return new Map(rows.map(r => [Number(r.id), r]));
  } catch { return new Map(); }
}

// ── Liked / saved status for the current page (bulk lookup) ──────────────────

async function getLikedSavedSets(userId: number | null, shortIds: number[]): Promise<{ liked: Set<number>; saved: Set<number> }> {
  if (!userId || shortIds.length === 0) return { liked: new Set(), saved: new Set() };
  try {
    const [likedRows, savedRows] = await Promise.all([
      prisma.$queryRaw<{ shortId: number }[]>`
        SELECT "shortId" FROM "ShortLike" WHERE "userId" = ${userId} AND "shortId" = ANY(${shortIds}::int[])
      `,
      prisma.$queryRaw<{ shortId: number }[]>`
        SELECT "shortId" FROM "SavedShort" WHERE "userId" = ${userId} AND "shortId" = ANY(${shortIds}::int[])
      `,
    ]);
    return {
      liked: new Set(likedRows.map(r => Number(r.shortId))),
      saved: new Set(savedRows.map(r => Number(r.shortId))),
    };
  } catch {
    return { liked: new Set(), saved: new Set() };
  }
}

// ── Record impressions (fire-and-forget) ──────────────────────────────────────

function recordImpressions(shortIds: number[], userId: number | null, sessionId: string | null): void {
  if (shortIds.length === 0) return;
  const now = new Date();
  for (const id of shortIds) {
    prisma.$executeRaw`
      INSERT INTO "ShortWatchEvent" ("shortId", "userId", "sessionId", "action", "createdAt")
      VALUES (${id}, ${userId}, ${sessionId}, 'view', ${now})
    `.catch(() => {});
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req).catch(() => null);
  const userId   = authUser?.id ?? null;

  const { searchParams } = req.nextUrl;
  const rawCursor  = searchParams.get("cursor");
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset     = decodeCursor(rawCursor);
  const isFirstPage = offset === 0;

  // ── Phase 1: User context (all in parallel) ─────────────────────────────────
  const [blockedIds, mutedIds, followingIds, userTags, userCountryCode, creatorAffinity, recentlySeenIds] =
    await Promise.all([
      userId ? getBlockedIds(userId)       : Promise.resolve(new Set<number>()),
      userId ? getMutedIds(userId)         : Promise.resolve(new Set<number>()),
      userId ? getUserFollowingIds(userId) : Promise.resolve([] as number[]),
      userId ? getUserInterestTags(userId) : Promise.resolve([] as string[]),
      userId ? getUserCountryCode(userId)  : Promise.resolve(null as string | null),
      userId ? loadCreatorAffinity(userId) : Promise.resolve(new Map<number, number>()),
      userId ? getRecentlySeenIds(userId)  : Promise.resolve(new Set<number>()),
    ]);

  const followingIdSet = new Set(followingIds);

  // ── Phase 2: Candidate pools (all in parallel) ─────────────────────────────
  const [followingPool, interestPool, collabPool, localPool] = await Promise.all([
    getFollowingShorts(followingIds, new Set()),
    getInterestShorts(userTags, followingIds, new Set()),
    userId
      ? getCollaborativeShorts(userId, new Set())
      : Promise.resolve([]),
    userCountryCode
      ? getLocalShorts(userCountryCode, followingIds, new Set())
      : Promise.resolve([]),
  ]);

  // ── Phase 3: Merge + pre-scoring filter ────────────────────────────────────
  const merged   = [...followingPool, ...interestPool, ...collabPool, ...localPool];
  const filtered = applyPreScoringShortFilters(merged, {
    userId,
    blockedIds,
    mutedIds,
    seenIds: new Set(), // Shorts are rewatchable — no hard exclusion of seen IDs
  });

  // ── Phase 4: Creator metadata ──────────────────────────────────────────────
  const uniqueCreatorIds = [...new Set(filtered.map(s => s.userId))];
  const creatorMap       = await loadCreatorData(uniqueCreatorIds);

  const creatorMeta = new Map(
    [...creatorMap.entries()].map(([id, c]) => [
      id,
      { verified: c.verified, isPremium: c.isPremium, role: c.role, followers: c.followers },
    ])
  );

  // ── Phase 5: Score, sort, diversity, interleave ────────────────────────────
  const ctx: ShortsUserContext = {
    userId,
    followingIds:           followingIdSet,
    userTags,
    creatorAffinity,
    totalShortInteractions: recentlySeenIds.size,
    userCountryCode,
    recentlySeenIds,
    creatorMeta,
  };

  // Cold-start fallback — no personalized candidates at all
  if (filtered.length === 0) {
    return serveTrending(req, userId, limit);
  }

  let scored = filtered.map(s => computeShortsScore(s, ctx));
  scored     = applyExplorationJitter(scored, isFirstPage);
  scored.sort((a, b) => b.score - a.score);
  scored = applyShortsDiversity(scored);
  scored = interleaveShortsBySource(scored);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const total      = scored.length;
  const page       = scored.slice(offset, offset + limit);
  const hasMore    = offset + limit < total;
  const nextCursor = hasMore ? encodeCursor(offset + limit) : null;

  // Enrich page — creatorMap already populated from Phase 4
  const pageCreatorIds = [...new Set(page.map(s => s.short.userId))];
  const missing = pageCreatorIds.filter(id => !creatorMap.has(id));
  if (missing.length > 0) {
    const extra = await loadCreatorData(missing);
    extra.forEach((v, k) => creatorMap.set(k, v));
  }

  const { liked: likedSet, saved: savedSet } = await getLikedSavedSets(userId, page.map(({ short }) => short.id));

  const shorts = page.map(({ short, score, reason }, idx) =>
    buildShortResponse(short, creatorMap.get(short.userId) ?? null, reason, score, offset + idx + 1, {
      liked: likedSet.has(short.id),
      saved: savedSet.has(short.id),
    })
  );

  // Fire-and-forget impression recording
  const sessionId = req.cookies.get("session_id")?.value ?? null;
  recordImpressions(shorts.map((s: any) => s.id), userId, sessionId);

  return NextResponse.json({ shorts, nextCursor, hasMore, total });
}

// ── Trending fallback (cold start / unauthenticated) ──────────────────────────

async function serveTrending(_req: NextRequest, userId: number | null, limit: number) {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT s.id, s.title, s."thumbnailUrl", s."videoUrl",
             s.views, s.likes, s.shares, s.comments, s.tags,
             s."publishedAt", s."createdAt",
             u.id AS "u_id", u.name AS "u_name", u.handle AS "u_handle",
             u.avatar AS "u_avatar", u.verified AS "u_verified",
             u."isPremium" AS "u_isPremium", u."countryCode" AS "u_countryCode",
             u.followers AS "u_followers"
      FROM "Short" s
      JOIN "User" u ON u.id = s."userId"
        AND u.banned = false AND u."deactivatedAt" IS NULL
      WHERE s.status  = 'published'
        AND s.flagged = false
        AND COALESCE(s."publishedAt", s."createdAt") > NOW() - INTERVAL '7 days'
      ORDER BY (s.likes + s.shares * 2) DESC,
               COALESCE(s."publishedAt", s."createdAt") DESC
      LIMIT ${limit}
    `;
    const { liked: likedSet, saved: savedSet } = await getLikedSavedSets(userId, rows.map(r => r.id));
    const shorts = rows.map(r =>
      buildShortResponse(
        { ...r, userId: r.u_id },
        {
          id:          r.u_id,
          name:        r.u_name,
          handle:      r.u_handle,
          avatar:      r.u_avatar,
          verified:    r.u_verified ?? false,
          isPremium:   r.u_isPremium ?? false,
          role:        "USER",
          countryCode: r.u_countryCode,
          followers:   r.u_followers ?? "0",
        },
        "Trending",
        0,
        0,
        { liked: likedSet.has(r.id), saved: savedSet.has(r.id) },
      )
    );
    return NextResponse.json({ shorts, nextCursor: null, hasMore: false, total: shorts.length });
  } catch {
    return NextResponse.json({ shorts: [], nextCursor: null, hasMore: false, total: 0 });
  }
}

// ── Response shape ────────────────────────────────────────────────────────────
// Backward-compatible with the existing mapShort() on the frontend.

function buildShortResponse(
  short: any,
  creator: CreatorData | null,
  reason: string,
  score: number,
  rank = 0,
  status: { liked?: boolean; saved?: boolean } = {},
) {
  return {
    ...buildShortSummary(short, creator, status),
    // Extended fields (ignored by existing mapShort, available for future use)
    reason,
    score: Math.round(score * 10000) / 10000,
    rank,
    tags: short.tags ?? [],
  };
}