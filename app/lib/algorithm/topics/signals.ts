export { ACTION_WEIGHTS } from "@/app/lib/algorithm/signals";

// Three overlapping velocity windows — each compares a recent slice to an equally-sized prior slice.
// Shorter windows weight more heavily so a spike in the last hour dominates a 6-hour trend.
export const VELOCITY_WINDOWS = [
  { recentHours: 1,  priorHours: 2,  weight: 0.50 },
  { recentHours: 3,  priorHours: 6,  weight: 0.30 },
  { recentHours: 6,  priorHours: 24, weight: 0.20 },
] as const;

// How far back to collect candidate posts (hours)
export const TOPIC_COLLECTION_WINDOW_HOURS = 48;

// Weighted geometric-mean exponents — must sum to 1.0
// Velocity is the dominant signal; geo contributes least but still separates regional spikes
export const TOPIC_SIGNAL_WEIGHTS = {
  velocity:      0.40,
  freshness:     0.20,
  participation: 0.15,
  popularity:    0.15,
  geo:           0.10,
} as const;

// Freshness: exponential decay half-lives
export const TOPIC_MEDIAN_AGE_HALF_LIFE_HOURS = 24; // median post age within the topic
export const TOPIC_RECENCY_HALF_LIFE_HOURS    = 2;  // most recent post in the topic

// Quality filter thresholds
export const MIN_POST_COUNT          = 3;    // fewer posts → noise, not conversation
export const MIN_UNIQUE_AUTHORS      = 2;    // single-author tag = self-promotion
export const MAX_SINGLE_AUTHOR_RATIO = 0.60; // >60% from one author = coordinated
export const MAX_FLAGGED_RATIO       = 0.50; // >50% flagged posts → suppress
export const BOT_ENGAGEMENT_Z_SCORE  = 3.5;  // per-post engagement z-score threshold

// Minimum posts from a country in window to warrant computing regional topics for it
export const MIN_COUNTRY_POSTS_FOR_REGIONAL = 10;

// Output caps
export const MAX_GLOBAL_TOPICS   = 10;
export const MAX_REGIONAL_TOPICS = 10;

// Worker: how often to recompute (10 min matches the post-level trending worker)
export const TOPICS_RECOMPUTE_INTERVAL_MS = 10 * 60 * 1000;
