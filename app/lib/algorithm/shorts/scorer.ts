import { prisma } from "@/lib/prisma";
import { countryFactor } from "@/app/lib/algorithm/geo";
import { CandidateShort } from "./candidates";
import {
  SHORTS_DECAY_HALF_LIFE_HOURS,
  SHORTS_FRESHNESS_BOOST_HOURS,
  SHORTS_FRESHNESS_BOOST_SCALE,
  SHORTS_FOLLOWING_BONUS,
  COLD_START_CREATOR_BOOST,
  SHORTS_SEEN_PENALTY,
  SHORTS_AFFINITY_MAX_CONTRIBUTION,
  SHORTS_CROSS_CONTENT_AFFINITY_WEIGHT,
} from "./signals";

// ── User context ──────────────────────────────────────────────────────────────

export interface ShortsUserContext {
  userId: number | null;
  followingIds: Set<number>;
  userTags: string[];
  // Creator affinity: blended from ShortWatchEvent + Post engagement history.
  // Key = creatorUserId, value = normalized affinity score [0, ∞)
  creatorAffinity: Map<number, number>;
  // Total positive short interactions — cold-start detection for the viewer
  totalShortInteractions: number;
  userCountryCode: string | null;
  // Soft-exclude: seen within the last SHORTS_SEEN_WINDOW_HOURS
  recentlySeenIds: Set<number>;
  // Creator metadata for authority scoring
  creatorMeta: Map<number, CreatorMeta>;
}

interface CreatorMeta {
  verified: boolean;
  isPremium: boolean;
  role: string;
  followers: string;
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface ScoredShort {
  short: CandidateShort;
  score: number;
  reason: string;
}

// ── Creator affinity loading ──────────────────────────────────────────────────
// Blends ShortWatchEvent signals (primary) with PostEngagement signals
// for the same creator (secondary, weighted at SHORTS_CROSS_CONTENT_AFFINITY_WEIGHT).

export async function loadCreatorAffinity(userId: number): Promise<Map<number, number>> {
  const [shortRows, postRows] = await Promise.all([
    prisma.$queryRaw<{ userId: number; affinity: number }[]>`
      SELECT s."userId",
        SUM(
          CASE swe.action
            WHEN 'like'         THEN 1.0
            WHEN 'share'        THEN 2.0
            WHEN 'comment'      THEN 1.5
            WHEN 'follow_after' THEN 5.0
            WHEN 'complete'     THEN 0.8
            ELSE 0.0
          END
          * POWER(0.9::float, EXTRACT(EPOCH FROM (NOW() - swe."createdAt")) / 86400.0)
        ) AS affinity
      FROM "ShortWatchEvent" swe
      JOIN "Short" s ON s.id = swe."shortId"
      WHERE swe."userId" = ${userId}
        AND swe.action IN ('like','share','comment','complete','follow_after')
        AND swe."createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY s."userId"
    `.catch(() => []),

    prisma.$queryRaw<{ userId: number; affinity: number }[]>`
      SELECT p."userId",
        SUM(
          CASE pe.action
            WHEN 'like'          THEN 1.0
            WHEN 'comment'       THEN 3.0
            WHEN 'share'         THEN 2.0
            WHEN 'follow_author' THEN 5.0
            WHEN 'dwell'         THEN 0.15
            ELSE 0.0
          END
          * POWER(0.9::float, EXTRACT(EPOCH FROM (NOW() - pe."createdAt")) / 86400.0)
        ) AS affinity
      FROM "PostEngagement" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE pe."userId" = ${userId}
        AND pe.action IN ('like','comment','share','follow_author','dwell')
        AND pe."createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY p."userId"
    `.catch(() => []),
  ]);

  const result = new Map<number, number>();
  for (const r of shortRows) {
    result.set(Number(r.userId), Number(r.affinity ?? 0));
  }
  for (const r of postRows) {
    const id = Number(r.userId);
    const existing = result.get(id) ?? 0;
    result.set(id, existing + Number(r.affinity ?? 0) * SHORTS_CROSS_CONTENT_AFFINITY_WEIGHT);
  }
  return result;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function computeShortsScore(
  short: CandidateShort,
  ctx: ShortsUserContext,
): ScoredShort {
  const ageMs    = Date.now() - (short.publishedAt ?? short.createdAt).getTime();
  const ageHours = Math.max(ageMs / 3_600_000, 0.001);

  // 1. Freshness — exponential decay with cold-start boost for very new shorts
  const decay = Math.pow(0.5, ageHours / SHORTS_DECAY_HALF_LIFE_HOURS);
  const freshness = ageHours < SHORTS_FRESHNESS_BOOST_HOURS
    ? decay * (SHORTS_FRESHNESS_BOOST_SCALE - ageHours / SHORTS_FRESHNESS_BOOST_HOURS)
    : decay;

  // 2. Following signal
  const isFollowing     = ctx.followingIds.has(short.userId);
  const followingFactor = isFollowing ? SHORTS_FOLLOWING_BONUS : 1.0;

  // 3. Interest match — how many of the short's tags match viewer interests
  const interestFactor = computeInterestFactor(short.tags, ctx.userTags);

  // 4. Geo relevance — reuses the same countryFactor() as Posts
  const geoFactor = countryFactor(
    { countryCode: short.countryCode, contentScope: short.contentScope },
    ctx.userCountryCode,
    1.0,
  );

  // 5. Creator affinity — capped contribution so one creator can't dominate the feed
  const rawAffinity    = ctx.creatorAffinity.get(short.userId) ?? 0;
  const affinityFactor = 1.0 + Math.min(SHORTS_AFFINITY_MAX_CONTRIBUTION, rawAffinity * 0.1);

  // 6. Engagement quality proxy — log-scaled popularity normalised by age
  const engagementFactor = computeEngagementFactor(short);

  // 7. Cold-start creator promotion
  const coldStartFactor = short.creatorIsNew ? COLD_START_CREATOR_BOOST : 1.0;

  // 8. Creator authority (verified, premium, role)
  const authorityFactor = computeAuthorityFactor(short.userId, ctx.creatorMeta);

  // 9. Seen penalty — soft, so popular/short loops can resurface
  const seenFactor = ctx.recentlySeenIds.has(short.id) ? SHORTS_SEEN_PENALTY : 1.0;

  // Phase 2 video-behavior factors (zero-weight placeholders)
  // const completionFactor = ...;
  // const skipPenalty      = ...;
  // const loopBonus        = ...;

  const score =
    freshness *
    followingFactor *
    interestFactor *
    geoFactor *
    affinityFactor *
    engagementFactor *
    coldStartFactor *
    authorityFactor *
    seenFactor;

  return { short, score, reason: computeReason(short, ctx, isFollowing) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeInterestFactor(tags: string[], userTags: string[]): number {
  if (userTags.length === 0 || tags.length === 0) return 1.0;
  const userSet = new Set(userTags.map(t => t.toLowerCase()));
  const matches = tags.filter(t => userSet.has(t.toLowerCase())).length;
  // 1.0 baseline + up to 1.5× bonus for a perfect tag match
  return 1.0 + (matches / Math.max(userTags.length, 1)) * 1.5;
}

function computeEngagementFactor(short: CandidateShort): number {
  const total = short.likes + short.shares * 2 + short.comments * 1.5;
  if (total === 0) return 1.0;
  // Log-scaled so viral shorts don't completely overwhelm fresh ones
  return 1.0 + Math.log10(total + 1) * 0.3;
}

function computeAuthorityFactor(
  userId: number,
  creatorMeta: Map<number, CreatorMeta>,
): number {
  const meta = creatorMeta.get(userId);
  if (!meta) return 1.0;
  let factor = 1.0;
  if (meta.verified)  factor += 0.12;
  if (meta.isPremium) factor += 0.06;
  // Follower size as a mild authority signal (log-scaled)
  const followers = parseFollowers(meta.followers);
  factor += Math.log10(Math.max(followers + 1, 1)) * 0.02;
  return Math.min(factor, 1.6);
}

function parseFollowers(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

function computeReason(
  short: CandidateShort,
  ctx: ShortsUserContext,
  isFollowing: boolean,
): string {
  if (isFollowing) return "From someone you follow";
  if (short.source === "collaborative") return "Popular with similar viewers";
  if (short.source === "local") return "In your region";
  const affinity = ctx.creatorAffinity.get(short.userId) ?? 0;
  if (affinity > 2) return "Based on your activity";
  const tags = short.tags.filter(t => ctx.userTags.includes(t));
  if (tags.length > 0) return `Because you like ${tags[0]}`;
  return "Trending";
}