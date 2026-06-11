// Ad ranking engine — relevance + revenue blend.
//
// Pure and side-effect free so it can be unit tested and run client-side for
// the admin "ranking preview". Mirrors the structure of app/lib/algorithm/scorer.ts:
// hard eligibility gates first, then a weighted base score multiplied by
// CTR / pacing / priority factors. The serve route feeds it DB rows + the
// viewer's context and ranks the survivors.

import { getRegion } from "@/lib/regions";
import type { AdAlgorithm } from "./ads";

export interface AdCampaignForScoring {
  id: number;
  cpc: number;
  createdAt: Date | string;
  priority: number;
  promoteTargetId: number | null;
  targetCountries: string[];
  targetTags: string[];
  targetAudience: string; // all | guests | members | followers
  pacing: string; // even | accelerated
  dailyBudget: number | null;
  frequencyCap: number;
  advertiserName: string;
}

export interface AdCreativeForScoring {
  id: number;
  weight: number;
  impressions: number;
  clicks: number;
}

export interface AdViewerContext {
  userId: number | null;
  countryCode: string | null;
  userTags: string[];
  followingIds: Set<number>;
  isMember: boolean;
  // campaignId → impressions already shown to this viewer today
  recentImpressions: Map<number, number>;
  // campaignId → amount already spent today (for even pacing)
  spentToday: Map<number, number>;
  // fraction of the day elapsed, 0..1 (passed in so the module stays pure)
  dayFraction: number;
}

export interface AdScoreResult {
  score: number; // -Infinity when ineligible
  eligible: boolean;
  relevance: number; // 0..1, exposed for minRelevance + debugging
  reason: string; // why this ad would be (or wasn't) shown
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Laplace-smoothed click-through rate so a creative with 1 impression and
// 1 click doesn't read as a perfect 100% CTR.
function smoothedCtr(creative: AdCreativeForScoring): number {
  return (creative.clicks + 1) / (creative.impressions + 20);
}

// 0..1 relevance of a campaign to the viewer from geo + interest targeting.
// Untargeted dimensions contribute a neutral 0.5 so a broad campaign isn't
// punished for not being narrowly targeted.
function relevanceFactor(c: AdCampaignForScoring, ctx: AdViewerContext): number {
  // Geo
  let geo = 0.5;
  if (c.targetCountries.length > 0) {
    const cc = ctx.countryCode?.toUpperCase() ?? null;
    if (cc && c.targetCountries.map((x) => x.toUpperCase()).includes(cc)) geo = 1.0;
    else if (cc) {
      const userRegion = getRegion(cc);
      const regionHit = c.targetCountries.some((t) => getRegion(t.toUpperCase()) === userRegion);
      geo = regionHit ? 0.7 : 0.0;
    } else {
      geo = 0.0; // campaign targets countries but viewer has none
    }
  }

  // Interests
  let tag = 0.5;
  if (c.targetTags.length > 0) {
    if (ctx.userTags.length === 0) tag = 0.3;
    else {
      const viewerSet = new Set(ctx.userTags.map((t) => t.toLowerCase()));
      const overlap = c.targetTags.filter((t) => viewerSet.has(t.toLowerCase())).length;
      tag = overlap > 0 ? clamp01(0.6 + 0.2 * overlap) : 0.1;
    }
  }

  // Follower targeting — viewer follows the promoted profile
  let follow = 0.5;
  if (c.targetAudience === "followers" && c.promoteTargetId) {
    follow = ctx.followingIds.has(c.promoteTargetId) ? 1.0 : 0.2;
  }

  return clamp01((geo + tag + follow) / 3);
}

// Exponential decay on campaign age — newer campaigns surface, ~14 day half-life.
function recencyFactor(c: AdCampaignForScoring, now: number): number {
  const ageHours = Math.max((now - new Date(c.createdAt).getTime()) / 3_600_000, 0);
  return Math.pow(0.5, ageHours / (14 * 24));
}

// 1.0 when on/under the even-pacing curve, shrinking toward 0 the further the
// campaign is ahead of where its daily budget says it should be by now.
function pacingFactor(c: AdCampaignForScoring, ctx: AdViewerContext, strictness: number): number {
  if (c.pacing !== "even" || !c.dailyBudget || c.dailyBudget <= 0) return 1.0;
  const spent = ctx.spentToday.get(c.id) ?? 0;
  const spentFrac = clamp01(spent / c.dailyBudget);
  const ahead = Math.max(0, spentFrac - ctx.dayFraction); // 0 = on pace
  return clamp01(1 - strictness * ahead);
}

export function scoreAd(
  c: AdCampaignForScoring,
  creative: AdCreativeForScoring,
  ctx: AdViewerContext,
  weights: AdAlgorithm,
  maxCpc: number,
  now: number,
): AdScoreResult {
  // ── Hard eligibility gates ──────────────────────────────────────────────
  const ineligible = (reason: string): AdScoreResult => ({
    score: -Infinity,
    eligible: false,
    relevance: 0,
    reason,
  });

  if (c.targetAudience === "guests" && ctx.isMember) return ineligible("Guests only");
  if (c.targetAudience === "members" && !ctx.isMember) return ineligible("Members only");

  if (c.targetCountries.length > 0) {
    const cc = ctx.countryCode?.toUpperCase() ?? null;
    const exactMatch = cc && c.targetCountries.map((x) => x.toUpperCase()).includes(cc);
    if (!exactMatch) {
      // Allow same-region viewers — consistent with relevanceFactor regional scoring (0.7).
      // Hard-block only when there's no country at all or no regional overlap.
      const regionMatch = cc && c.targetCountries.some(
        (t) => getRegion(t.toUpperCase()) != null && getRegion(t.toUpperCase()) === getRegion(cc)
      );
      if (!regionMatch) return ineligible("Outside target countries");
    }
  }

  const cap = c.frequencyCap > 0 ? c.frequencyCap : weights.defaultFrequencyCap;
  if (cap > 0 && (ctx.recentImpressions.get(c.id) ?? 0) >= cap) {
    return ineligible("Frequency cap reached");
  }

  // Hard pacing stop — never overspend the daily budget.
  if (c.pacing === "even" && c.dailyBudget && c.dailyBudget > 0) {
    if ((ctx.spentToday.get(c.id) ?? 0) >= c.dailyBudget) return ineligible("Daily budget spent");
  }

  const relevance = relevanceFactor(c, ctx);
  if (weights.minRelevance > 0 && relevance < weights.minRelevance) {
    return ineligible("Below relevance threshold");
  }

  // ── Soft score ──────────────────────────────────────────────────────────
  const bidFactor = maxCpc > 0 ? clamp01(c.cpc / maxCpc) : 0;
  const recency = recencyFactor(c, now);

  const base =
    weights.bidWeight * bidFactor +
    weights.relevanceWeight * relevance +
    weights.recencyWeight * recency;

  // CTR multiplier — proven creatives get lift, scaled by ctrInfluence.
  // smoothedCtr ~0.05 maps to ~1.0; the (ctr/0.05) ratio is clamped to 0..2.
  const ctrRatio = Math.min(2, smoothedCtr(creative) / 0.05);
  const ctrMult = 1 + weights.ctrInfluence * (ctrRatio - 1);

  const pacing = pacingFactor(c, ctx, weights.pacingStrictness);
  const priorityMult = 1 + Math.max(0, c.priority) * 0.1;

  const score = base * ctrMult * pacing * priorityMult;

  // ── Transparency reason ─────────────────────────────────────────────────
  let reason = "Sponsored";
  if (c.targetAudience === "followers" && c.promoteTargetId && ctx.followingIds.has(c.promoteTargetId)) {
    reason = "From someone you follow";
  } else if (c.targetTags.length > 0 && ctx.userTags.length > 0) {
    const viewerSet = new Set(ctx.userTags.map((t) => t.toLowerCase()));
    const hit = c.targetTags.find((t) => viewerSet.has(t.toLowerCase()));
    if (hit) reason = `Based on your interest in ${hit}`;
  } else if (c.targetCountries.length > 0 && ctx.countryCode) {
    reason = "Popular in your country";
  }

  return { score, eligible: true, relevance, reason };
}

// Weighted A/B rotation: favor the higher-CTR / higher-weight creative while
// still exploring. `rand` (0..1) is injected so the module stays deterministic
// in tests; the serve route passes Math.random().
export function pickCreative<T extends AdCreativeForScoring>(
  creatives: T[],
  ctrInfluence: number,
  rand: number,
): T | null {
  if (creatives.length === 0) return null;
  if (creatives.length === 1) return creatives[0];

  const scored = creatives.map((cr) => {
    const ctrBoost = 1 + ctrInfluence * (Math.min(2, smoothedCtr(cr) / 0.05) - 1);
    return { cr, w: Math.max(0.0001, cr.weight) * Math.max(0.1, ctrBoost) };
  });
  const total = scored.reduce((s, x) => s + x.w, 0);
  let r = rand * total;
  for (const x of scored) {
    r -= x.w;
    if (r <= 0) return x.cr;
  }
  return scored[scored.length - 1].cr;
}
