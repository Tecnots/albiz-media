import {
  MIN_POST_COUNT,
  MIN_UNIQUE_AUTHORS,
  MAX_SINGLE_AUTHOR_RATIO,
  MAX_FLAGGED_RATIO,
  BOT_ENGAGEMENT_Z_SCORE,
} from "./signals";
import type { TopicAggregate } from "./aggregator";
import type { ScoredTopic } from "./scorer";

// ─── Stopword / noise tag list ────────────────────────────────────────────────

// Tags that should never appear in trending regardless of volume.
// Includes: grammar words, generic platform-action words, single chars.
const BLOCKED_TAGS = new Set([
  // Articles / prepositions
  "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of",
  "by", "as", "be", "is", "are", "was", "with", "it", "this", "that",
  "he", "she", "we", "you", "i", "me", "my", "but", "not", "no",
  // Platform actions
  "trending", "viral", "breaking", "news", "post", "posts",
  "follow", "like", "share", "repost", "comment", "subscribe",
  "thread", "update", "alert",
  // Meta tags
  "photo", "video", "image", "link", "article", "blog",
  "retweet", "rt", "via", "cc",
]);

// ─── Individual checks (exported so they can be unit-tested) ─────────────────

export function isBlockedTag(tag: string): boolean {
  return tag.length < 2 || BLOCKED_TAGS.has(tag.toLowerCase());
}

export function passesMinimumThresholds(agg: TopicAggregate): boolean {
  return agg.postIds.length >= MIN_POST_COUNT && agg.authorIds.length >= MIN_UNIQUE_AUTHORS;
}

// Spam: >MAX_SINGLE_AUTHOR_RATIO of posts from one author = coordinated push
export function passesAuthorConcentrationCheck(agg: TopicAggregate): boolean {
  if (agg.postIds.length === 0) return false;

  const authorFreq = new Map<number, number>();
  for (const p of agg.posts) {
    authorFreq.set(p.userId, (authorFreq.get(p.userId) ?? 0) + 1);
  }
  const maxCount = Math.max(...authorFreq.values());
  return maxCount / agg.postIds.length <= MAX_SINGLE_AUTHOR_RATIO;
}

// Quality: too many flagged posts in the topic = suppress it
export function passesFlaggedContentCheck(agg: TopicAggregate): boolean {
  if (agg.postIds.length === 0) return false;
  return agg.flaggedCount / agg.postIds.length <= MAX_FLAGGED_RATIO;
}

// Bot/anomaly detection: z-score on per-post weighted engagement across all topics.
// Topics whose per-post engagement is >BOT_ENGAGEMENT_Z_SCORE stddevs above the
// population mean are likely artificially inflated and are suppressed.
export function passesEngagementAnomalyCheck(
  agg:           TopicAggregate,
  allAggregates: TopicAggregate[]
): boolean {
  const qualified = allAggregates.filter(a => a.postIds.length >= MIN_POST_COUNT);
  if (qualified.length < 5) return true; // insufficient baseline → skip check

  const perPostEngagements = qualified.map(
    a => (a.totalLikes + a.totalComments * 3 + a.totalShares * 2) / a.postIds.length
  );

  const mean = perPostEngagements.reduce((s, v) => s + v, 0) / perPostEngagements.length;
  const variance =
    perPostEngagements.reduce((s, v) => s + (v - mean) ** 2, 0) / perPostEngagements.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 0.001) return true; // effectively zero variance — don't divide by it

  const thisPerPost =
    (agg.totalLikes + agg.totalComments * 3 + agg.totalShares * 2) /
    Math.max(agg.postIds.length, 1);

  return (thisPerPost - mean) / stdDev < BOT_ENGAGEMENT_Z_SCORE;
}

// ─── Public filter pass ───────────────────────────────────────────────────────

export function applyQualityFilters(
  allAggregates: TopicAggregate[],
  scored:        ScoredTopic[]
): ScoredTopic[] {
  const aggByTag = new Map(allAggregates.map(a => [a.tag, a]));

  return scored.filter(topic => {
    if (isBlockedTag(topic.tag)) return false;

    const agg = aggByTag.get(topic.tag);
    if (!agg) return false;

    if (!passesMinimumThresholds(agg))          return false;
    if (!passesAuthorConcentrationCheck(agg))    return false;
    if (!passesFlaggedContentCheck(agg))         return false;
    if (!passesEngagementAnomalyCheck(agg, allAggregates)) return false;

    return true;
  });
}
