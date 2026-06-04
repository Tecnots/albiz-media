// X-algorithm action weights — adapted from xai-org/x-algorithm public documentation
// Final Score = Σ (weight_i × P(action_i))
// Positive weights amplify; negative weights suppress.

export const ACTION_WEIGHTS: Record<string, number> = {
  // Positive signals
  like:           1.0,
  comment:        3.0,   // reply is the strongest positive engagement signal
  share:          2.0,
  dwell:          0.15,  // base weight — actual value scales with seconds read
  profile_click:  0.5,
  photo_expand:   0.2,
  follow_author:  5.0,   // following from a post is the strongest signal
  social_proof:   0.3,   // per followed user who engaged — up to 1.5 total
  // Negative signals — suppress content
  scroll_past:   -0.5,   // scrolled past without reading (< 2s on screen)
  not_interested: -3.0,
  mute_author:    -8.0,
  block_author:  -10.0,
};

// Dwell weight scales with seconds read (more time = stronger signal)
export function dwellWeight(seconds: number): number {
  // 5s=0.15, 15s=0.30, 30s=0.50, 60s=0.75, 120s=1.0 (cap)
  return Math.min(ACTION_WEIGHTS.dwell + (seconds / 120) * 0.85, 1.0);
}

// How long engagement history stays relevant (days)
export const ENGAGEMENT_HISTORY_WINDOW_DAYS = 30;

// Recency decay for engagement signals — 10% less weight per day
export const ENGAGEMENT_RECENCY_DECAY = 0.9;

// Freshness: posts older than this get no freshness boost
export const FRESHNESS_BOOST_HOURS = 6;

// Time-decay half-life in hours per mode
export const DECAY_HALF_LIFE_HOURS = 72;

// In-network / out-of-network candidate pool sizes
export const IN_NETWORK_POOL_SIZE = 200;
export const OUT_OF_NETWORK_POOL_SIZE = 200;
export const COLLABORATIVE_POOL_SIZE = 100;

// Target ratio of in-network posts in final ranked feed
export const IN_NETWORK_TARGET_RATIO = 0.5;

// Max posts per single author in the top N results
export const MAX_POSTS_PER_AUTHOR_TOP = 2;
export const DIVERSITY_TOP_N = 10;

// Max posts with the same primary tag cluster in top N
export const MAX_POSTS_PER_TAG_TOP = 3;
export const DIVERSITY_TAG_TOP_N = 20;

// Cold-start: user has fewer than this many engagement events
export const COLD_START_THRESHOLD = 10;

// Social proof: min number of followed users who engaged to trigger the boost
export const SOCIAL_PROOF_MIN_COUNT = 2;
export const SOCIAL_PROOF_MAX_BOOST = 1.5; // cap at 5 engagers × 0.3

// Trending injection: inject one trending post at this feed position (1-based)
export const TRENDING_INJECTION_POSITION = 5;
