import { CandidatePost } from "./candidates";
import {
  ACTION_WEIGHTS,
  dwellWeight,
  DECAY_HALF_LIFE_HOURS,
  FRESHNESS_BOOST_HOURS,
  ENGAGEMENT_RECENCY_DECAY,
  COLD_START_THRESHOLD,
} from "./signals";
import { countryFactor } from "./geo";

export interface UserContext {
  followingIds: Set<number>;
  userTags: string[];
  engagementHistory: Map<number, { action: string; value: number; daysAgo: number }[]>;
  authorHistory: Map<number, Record<string, number>>; // weighted by recency
  totalEngagements: number; // cold-start detection
  socialProof?: Map<number, number>; // postId → count of followed users who engaged
  userCountryCode?: string | null;  // ISO 3166-1 alpha-2
  localMode?: boolean;              // true when feed mode is "local"
}

export interface ScoredPost {
  post: CandidatePost;
  score: number;
  reason?: string; // "Why this post?" transparency label
}

function parseStat(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

// Estimated reading time in minutes based on word count
function estimatedReadMinutes(post: CandidatePost): number {
  const words = (post.content ?? "").replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Global engagement rates from post stats
function globalEngagementSignals(post: CandidatePost): Record<string, number> {
  const likes    = parseStat(post.likes);
  const comments = parseStat(post.comments);
  const shares   = parseStat(post.shares);
  const views    = Math.max(parseStat(post.views), 1);
  return {
    like:           likes    / views,
    comment:        comments / views,
    share:          shares   / views,
    dwell:          0,
    follow_author:  0,
    profile_click:  0,
    photo_expand:   0,
    scroll_past:    0,
    social_proof:   0,
    not_interested: 0,
    mute_author:    0,
    block_author:   0,
  };
}

// Blended signals: personal history (recency-weighted) × global rate
function blendedEngagementSignals(
  post: CandidatePost,
  ctx: UserContext
): Record<string, number> {
  const global = globalEngagementSignals(post);
  const postHistory = ctx.engagementHistory.get(post.id) ?? [];

  // Aggregate per-action weighted signals for this specific post
  const postSignals: Record<string, number> = {};
  for (const e of postHistory) {
    const recency = Math.pow(ENGAGEMENT_RECENCY_DECAY, e.daysAgo);
    const w = e.action === "dwell"
      ? dwellWeight(e.value) * recency
      : recency * (e.value ?? 1.0);
    postSignals[e.action] = (postSignals[e.action] ?? 0) + w;
  }

  // Author-level signals
  // authorSig.dwell is a sum of raw seconds × recency — normalize to 0-1 scale
  // so it doesn't dominate the authorTotal vs like (1.0) / comment (1.0)
  const authorSig = ctx.authorHistory.get(post.userId) ?? {};
  const normalizedDwell = authorSig.dwell != null
    ? Math.min(authorSig.dwell / 120, 1.0) // 120s of dwell ≈ 1.0 (same scale as like)
    : 0;
  const authorTotal = (authorSig.like ?? 0) + (authorSig.comment ?? 0) +
                      (authorSig.share ?? 0) + normalizedDwell;
  const authorLikeRate    = (authorSig.like    ?? 0) / Math.max(authorTotal, 1);
  const authorCommentRate = (authorSig.comment ?? 0) / Math.max(authorTotal, 1);
  const authorShareRate   = (authorSig.share   ?? 0) / Math.max(authorTotal, 1);

  const hasAuthorHistory = Object.keys(authorSig).length > 0;
  const α = hasAuthorHistory ? 0.6 : 0;

  // Social proof: how many followed users engaged with this out-of-network post
  const proofCount = ctx.socialProof?.get(post.id) ?? 0;

  return {
    like:           α * authorLikeRate    + (1 - α) * global.like,
    comment:        α * authorCommentRate + (1 - α) * global.comment,
    share:          α * authorShareRate   + (1 - α) * global.share,
    dwell:          postSignals.dwell          ?? 0,
    follow_author:  postSignals.follow_author  ? 1 : 0,
    profile_click:  postSignals.profile_click  ? 1 : 0,
    photo_expand:   post.image                 ? 0.1 : 0,
    scroll_past:    Math.min(postSignals.scroll_past ?? 0, 3), // cap at 3 scroll-pasts
    social_proof:   Math.min(proofCount, 5),  // weight × count, cap at 5
    not_interested: postSignals.not_interested ? 1 : 0,
    mute_author:    postSignals.mute_author    ? 1 : 0,
    block_author:   postSignals.block_author   ? 1 : 0,
  };
}

// Time decay: exponential with freshness boost for very new posts
function timeDecayFactor(post: CandidatePost, halfLifeHours = DECAY_HALF_LIFE_HOURS): number {
  const nowMs   = Date.now();
  const postMs  = new Date(post.createdAt).getTime();
  const hoursOld = Math.max((nowMs - postMs) / 3_600_000, 0);
  const decay    = Math.pow(0.5, hoursOld / halfLifeHours);
  if (hoursOld < FRESHNESS_BOOST_HOURS) return decay * (3.0 - hoursOld * 0.33);
  return decay;
}

// Velocity: engagement per hour, normalized by estimated reading time
function velocityFactor(post: CandidatePost): number {
  const nowMs   = Date.now();
  const postMs  = new Date(post.createdAt).getTime();
  const hoursAge = Math.max((nowMs - postMs) / 3_600_000, 1);
  const readMins = estimatedReadMinutes(post);

  const total = parseStat(post.likes) + parseStat(post.comments) + parseStat(post.shares);
  // Normalize by reading time: a 10-min article shouldn't be penalized vs a 10-word post
  const normalizedAge = hoursAge / Math.max(readMins / 60, 0.1);
  const v = total / normalizedAge;
  return 1.0 + Math.min(0.5, Math.log10(Math.max(v, 1)) * 0.1);
}

// Relationship bonus
function relationshipFactor(post: CandidatePost, ctx: UserContext): number {
  if (ctx.followingIds.has(post.userId)) return 2.5;
  return 1.0;
}

// Tag interest match — interest posts always float first
function interestFactor(post: CandidatePost, userTags: string[], isColdStart: boolean): number {
  if (userTags.length === 0 || post.tags.length === 0) return 1.0;
  const tagSet = new Set(userTags.map(t => t.toLowerCase()));
  const hasMatch = post.tags.some(t => tagSet.has(t.toLowerCase()));
  if (!hasMatch) return isColdStart ? 0.4 : 0.8; // push non-matching below interest posts
  return isColdStart ? 4.0 : 3.0;               // strong boost — interest posts always lead
}

// Content type bonus
function contentTypeFactor(post: CandidatePost): number {
  let m = 1.0;
  if (post.type === "article") m *= 1.15;
  if (post.image) m *= 1.1;
  return m;
}

// Author authority: verified + role + follower count
function authorAuthorityFactor(post: CandidatePost, ctx: UserContext): number {
  const author = (ctx as any).userMap?.get(post.userId);
  if (!author) return 1.0;
  const followers = parseStat(author.followers ?? "0");
  let a = 1.0 + Math.min(0.4, Math.log10(Math.max(followers, 1)) * 0.05);
  if (author.isPremium)            a *= 1.05;
  if (author.verified)             a *= 1.15; // verified authors get a clear boost
  if (author.role === "AUTHOR")    a *= 1.10; // platform authors get a boost
  if (author.role === "CIRCLE")    a *= 1.05;
  return a;
}

// "Why this post?" reason string for transparency
function computeReason(
  post: CandidatePost,
  ctx: UserContext,
  proofCount: number
): string {
  if (ctx.followingIds.has(post.userId)) return "From someone you follow";
  if (proofCount >= 2) return `Liked by ${proofCount} people you follow`;
  if (post.source === "local" || (post.countryCode && post.countryCode === ctx.userCountryCode)) {
    return "Popular in your country";
  }
  if (post.tags.length > 0) {
    const userTagSet = new Set(ctx.userTags.map(t => t.toLowerCase()));
    const matchTag = post.tags.find(t => userTagSet.has(t.toLowerCase()));
    if (matchTag) return `Popular in ${matchTag}`;
  }
  return "Suggested for you";
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function computeXScore(
  post: CandidatePost,
  ctx: UserContext,
  mode: "for-you" | "trending",
  halfLifeHours = DECAY_HALF_LIFE_HOURS
): ScoredPost {
  const isColdStart   = ctx.totalEngagements < COLD_START_THRESHOLD;
  const signals       = blendedEngagementSignals(post, ctx);
  const decay         = timeDecayFactor(post, halfLifeHours);
  const velocity      = velocityFactor(post);
  const content       = contentTypeFactor(post);
  const interest      = interestFactor(post, ctx.userTags, isColdStart);
  const authority     = authorAuthorityFactor(post, ctx);
  const proofCount    = ctx.socialProof?.get(post.id) ?? 0;
  const localMult     = ctx.localMode ? 2.0 : 1.0;
  const geo           = countryFactor(post, ctx.userCountryCode, localMult);

  // Already-seen posts sink to the bottom — penalty instead of hard exclusion
  const seenPenalty = ctx.engagementHistory.has(post.id) ? 0.3 : 1.0;

  // X core formula: Σ (weight_i × P(action_i))
  let engagementScore = 0;
  for (const [action, weight] of Object.entries(ACTION_WEIGHTS)) {
    if (action === "social_proof") {
      engagementScore += weight * signals.social_proof;
    } else {
      engagementScore += weight * (signals[action] ?? 0);
    }
  }

  const baseEngagement = Math.log10(Math.max(engagementScore + 2, 1)) + 1;

  let score: number;
  if (mode === "trending") {
    score = baseEngagement * decay * velocity * content * interest * authority * geo * seenPenalty;
  } else {
    const relationship = relationshipFactor(post, ctx);
    score = baseEngagement * decay * velocity * relationship * content * interest * authority * geo * seenPenalty;
  }

  const reason = computeReason(post, ctx, proofCount);
  return { post, score, reason };
}
