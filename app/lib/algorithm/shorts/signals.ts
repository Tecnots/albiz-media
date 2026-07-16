// Shorts Ranking Engine — signal weights and configuration.
//
// Architecture is designed to support Phase 2 video-behavior signals
// (completion rate, skip rate, loop count) without any structural changes.
// Set the Phase 2 weights to non-zero values once ShortWatchEvent has coverage.

// ── Phase 1 engagement weights ────────────────────────────────────────────────
export const SHORTS_ENGAGEMENT_WEIGHTS = {
  like:         1.0,
  share:        2.0,
  comment:      1.5,
  follow_after: 5.0,
};

// ── Phase 2 video-behavior weights (zero until watch data is reliable) ─────────
export const SHORTS_VIDEO_WEIGHTS = {
  watch_completion:  0.0,  // → ~3.0 once avg watchPct is reliable
  fast_skip_penalty: 0.0,  // → ~-2.0; penalizes skip < 2s
  loop_bonus:        0.0,  // → ~0.5 per loop, capped at 3 loops
  save_bonus:        0.0,  // → ~1.5 when save tracking is wired up
};

// ── Freshness ─────────────────────────────────────────────────────────────────
// Shorts consume faster than articles — 48h half-life vs Posts' 72h
export const SHORTS_DECAY_HALF_LIFE_HOURS = 48;
export const SHORTS_FRESHNESS_BOOST_HOURS = 12;
export const SHORTS_FRESHNESS_BOOST_SCALE = 2.2;

// ── Graph signals ─────────────────────────────────────────────────────────────
export const SHORTS_FOLLOWING_BONUS = 2.8;

// ── Cold-start creator promotion ──────────────────────────────────────────────
export const COLD_START_CREATOR_THRESHOLD = 10;
export const COLD_START_CREATOR_BOOST     = 1.4;

// ── Candidate pool sizes ──────────────────────────────────────────────────────
export const SHORTS_FOLLOWING_POOL = 150;
export const SHORTS_INTEREST_POOL  = 150;
export const SHORTS_COLLAB_POOL    = 80;
export const SHORTS_LOCAL_POOL     = 80;

// ── Diversity ─────────────────────────────────────────────────────────────────
export const SHORTS_MAX_PER_CREATOR = 2;
export const SHORTS_DIVERSITY_TOP_N = 10;
export const SHORTS_MAX_PER_TAG     = 3;
export const SHORTS_TAG_TOP_N       = 20;

// 40% following, 60% discovery — more discovery-forward than Posts
export const SHORTS_FOLLOWING_RATIO = 0.4;

// ── Seen penalty ──────────────────────────────────────────────────────────────
// Recent watch history soft-penalizes instead of hard-excluding (completion = rewatchable)
export const SHORTS_SEEN_PENALTY = 0.12;
export const SHORTS_SEEN_WINDOW_HOURS = 24;

// ── Creator affinity ──────────────────────────────────────────────────────────
// Cross-content: Post engagement for the same creator blended at lower weight
export const SHORTS_CROSS_CONTENT_AFFINITY_WEIGHT = 0.35;
export const SHORTS_AFFINITY_MAX_CONTRIBUTION     = 2.0;

// ── Cursor ───────────────────────────────────────────────────────────────────
export const SHORTS_MAX_CURSOR_OFFSET = 500;
export const SHORTS_CURSOR_TTL_S      = 7200;