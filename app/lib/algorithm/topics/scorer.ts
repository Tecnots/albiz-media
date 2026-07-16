import {
  ACTION_WEIGHTS,
  VELOCITY_WINDOWS,
  TOPIC_SIGNAL_WEIGHTS,
  TOPIC_MEDIAN_AGE_HALF_LIFE_HOURS,
  TOPIC_RECENCY_HALF_LIFE_HOURS,
} from "./signals";
import type { TopicAggregate } from "./aggregator";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface TopicScoreBreakdown {
  velocity:      number; // [1.0, 3.0]
  freshness:     number; // [1.0, 3.0]
  participation: number; // [1.0, 2.5]
  popularity:    number; // [1.0, 3.0]
  geo:           number; // [1.0, 2.0]
}

export interface ScoredTopic {
  tag:             string;
  score:           number;
  breakdown:       TopicScoreBreakdown;
  postCount:       number;
  authorCount:     number;
  engagementTotal: number;
  topCountry:      string | null;
}

// ─── Individual signal functions (all pure, no I/O) ──────────────────────────

// Multi-window velocity: measures whether the topic is accelerating.
// Each window compares recent engagement to an equally-sized prior slice.
// Shorter windows are weighted more — a spike in the last hour matters more
// than sustained growth over 6 hours.
function computeVelocityScore(
  velocityWindows: TopicAggregate["velocityWindows"]
): number {
  let combined = 0;

  for (let i = 0; i < VELOCITY_WINDOWS.length; i++) {
    const { recent, prior } = velocityWindows[i] ?? { recent: 0, prior: 0 };
    const spikeRatio = recent / Math.max(prior, 1);
    combined += Math.log1p(spikeRatio) * VELOCITY_WINDOWS[i].weight;
  }

  // Scale up so a genuine 2× spike yields a meaningful boost; cap at 3.0
  return 1.0 + Math.min(2.0, combined * 2.5);
}

// Freshness: prioritises topics that are both young overall (median age) and
// have had recent activity (most recent post close to nowMs).
function computeFreshnessScore(createdAts: Date[], nowMs: number): number {
  if (createdAts.length === 0) return 1.0;

  const agesHours = createdAts
    .map(d => (nowMs - d.getTime()) / 3_600_000)
    .sort((a, b) => a - b);

  const medianAge      = agesHours[Math.floor(agesHours.length / 2)];
  const mostRecentAge  = agesHours[0]; // smallest = youngest post

  const medianDecay  = Math.exp(-Math.LN2 * medianAge     / TOPIC_MEDIAN_AGE_HALF_LIFE_HOURS);
  const recentDecay  = Math.exp(-Math.LN2 * mostRecentAge / TOPIC_RECENCY_HALF_LIFE_HOURS);

  // 60% weight on bulk age, 40% on most recent activity; range [1.0, 3.0]
  return 1.0 + 2.0 * (0.6 * medianDecay + 0.4 * recentDecay);
}

// Participation: rewards conversations with many distinct voices.
// Log-scaled to prevent mega-topics from dominating; range [1.0, 2.5]
function computeParticipationScore(uniqueAuthorCount: number): number {
  return 1.0 + Math.min(1.5, Math.log10(Math.max(uniqueAuthorCount, 1) + 1) * 0.75);
}

// Popularity: weighted per-post engagement using the canonical ACTION_WEIGHTS.
// Dividing by post count and log-scaling prevents large-volume topics from
// permanently occupying the top slots due to sheer age.
function computePopularityScore(
  totalLikes:    number,
  totalComments: number,
  totalShares:   number,
  postCount:     number
): number {
  const weighted =
    totalLikes    * ACTION_WEIGHTS.like    +
    totalComments * ACTION_WEIGHTS.comment +
    totalShares   * ACTION_WEIGHTS.share;

  const perPost = weighted / Math.max(postCount, 1);
  return 1.0 + Math.min(2.0, Math.log10(Math.max(perPost, 0) + 1) * 0.8);
}

// Geo: interpretation depends on scope.
// Global  → spread across many countries is a signal of broad relevance.
// Regional → concentration in the target country boosts the regional ranking.
function computeGeoScore(
  countryCounts: Map<string, number>,
  scope: string
): { score: number; topCountry: string | null } {
  if (countryCounts.size === 0) return { score: 1.0, topCountry: null };

  const entries  = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topEntry = entries[0];
  const total    = entries.reduce((s, [, v]) => s + v, 0);

  if (scope !== "GLOBAL") {
    const regionCount = countryCounts.get(scope) ?? 0;
    const regionRatio = regionCount / Math.max(total, 1);
    return {
      score: 1.0 + Math.min(1.0, regionRatio * 1.5),
      topCountry: topEntry[0],
    };
  }

  // Global: reward breadth (unique countries), softly penalise extreme concentration
  const spreadScore       = 1.0 + Math.min(0.5, Math.log10(countryCounts.size + 1) * 0.3);
  const topRatio          = topEntry[1] / Math.max(total, 1);
  const concentrationPenalty = topRatio > 0.8 ? 0.15 : 0; // suppress hyper-local topics in global list
  return {
    score: Math.max(1.0, spreadScore - concentrationPenalty),
    topCountry: topEntry[0],
  };
}

// ─── Final score (weighted geometric mean) ───────────────────────────────────

// Geometric mean with exponent weights gives each signal proportional influence
// while keeping the output bounded regardless of how extreme any single signal is.
// Range of final score: approximately [1.0, 2.95]
//
// Breakdown is exposed for explainability and stored in TrendingTopicScore.
export function computeTopicScore(
  agg:   TopicAggregate,
  scope: string = "GLOBAL",
  nowMs: number = Date.now()
): ScoredTopic {
  const velocity      = computeVelocityScore(agg.velocityWindows);
  const freshness     = computeFreshnessScore(agg.postCreatedAts, nowMs);
  const participation = computeParticipationScore(agg.authorIds.length);
  const popularity    = computePopularityScore(
    agg.totalLikes,
    agg.totalComments,
    agg.totalShares,
    agg.postIds.length
  );
  const { score: geo, topCountry } = computeGeoScore(agg.countryCounts, scope);

  const w = TOPIC_SIGNAL_WEIGHTS;
  const score =
    Math.pow(velocity,      w.velocity)      *
    Math.pow(freshness,     w.freshness)     *
    Math.pow(participation, w.participation) *
    Math.pow(popularity,    w.popularity)    *
    Math.pow(geo,           w.geo);

  const engagementTotal =
    agg.totalLikes    * ACTION_WEIGHTS.like    +
    agg.totalComments * ACTION_WEIGHTS.comment +
    agg.totalShares   * ACTION_WEIGHTS.share;

  return {
    tag:   agg.tag,
    score,
    breakdown: { velocity, freshness, participation, popularity, geo },
    postCount:       agg.postIds.length,
    authorCount:     agg.authorIds.length,
    engagementTotal: Math.round(engagementTotal),
    topCountry,
  };
}
