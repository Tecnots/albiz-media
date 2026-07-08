import { CandidatePost } from "./candidates";
import { computeXScore, UserContext, ScoredPost } from "./scorer";
import { FeedMode, SCORING_MODES } from "./scoringModes";
import { velocityMultiplier, geoClusterMultiplier, globalSocialProofMultiplier, TrendingFeatures } from "./trendingSignals";

// The single scoring entry point for every feed mode — nothing outside
// app/lib/algorithm/ should import computeXScore directly after this lands.
// computeXScore itself is unmodified; every mode difference (including
// trending's velocity/geo-cluster/social-proof extras and following's
// personal-affinity multiplier) is layered on here, driven entirely by
// SCORING_MODES.

export interface RankingContext {
  userContext: UserContext;
  // Precomputed per-batch trending features (velocity/geo/social-proof) —
  // present only when scoring in "trending" mode. A missing entry for a
  // given item just means no trending boost is applied (e.g. a post too new
  // to have been through the last precompute cycle yet).
  trendingFeatures?: Map<number, TrendingFeatures>;
}

// "following"'s extra post-hoc multiplier — moved in verbatim from
// app/api/feed/route.ts so computeScore() is the only place any per-item
// multiplier is ever applied, for any mode.
function personalAffinity(authorId: number, authorHistory: Map<number, Record<string, number>>): number {
  const sig = authorHistory.get(authorId);
  if (!sig) return 1.0;
  const total = (sig.like ?? 0) + (sig.comment ?? 0) * 3 + (sig.share ?? 0) * 2 + (sig.dwell ?? 0) * 0.5;
  return 1.0 + Math.min(2.0, total / 10);
}

// Every field computeXScore reads for personalization, user history, or
// interest matching becomes empty/absent — this (not a branch inside
// scorer.ts) is what guarantees trending mode carries zero personalization.
// `userMap` (author follower count/verified/role) is carried through
// unchanged: it's global author metadata, the same for every viewer, not personalization.
function buildNeutralContext(context: RankingContext): UserContext {
  const neutral: UserContext = {
    followingIds: new Set(),
    userTags: [],
    engagementHistory: new Map(),
    authorHistory: new Map(),
    totalEngagements: 0,
    socialProof: undefined,
    seenPostIds: undefined,
    userCountryCode: null,
    localMode: false,
  };
  (neutral as any).userMap = (context.userContext as any).userMap;
  return neutral;
}

export function computeScore(item: CandidatePost, context: RankingContext, mode: FeedMode): ScoredPost {
  const cfg = SCORING_MODES[mode] ?? SCORING_MODES["for-you"];
  const ctx = cfg.usePersonalization ? context.userContext : buildNeutralContext(context);

  let scored = computeXScore(item, ctx, cfg.computeXScoreMode, cfg.halfLifeHours); // full reuse, zero duplication

  if (cfg.applyPersonalAffinity) {
    const affinity = personalAffinity(item.userId, context.userContext.authorHistory);
    scored = { ...scored, score: scored.score * affinity };
  }

  if (!cfg.useTrendingSignals) return scored;

  const features = context.trendingFeatures?.get(item.id);
  if (!features) return scored;

  const velocity = velocityMultiplier(features);
  const geo = geoClusterMultiplier(features);
  const proof = globalSocialProofMultiplier(features);

  return { ...scored, score: scored.score * velocity * geo * proof };
}
