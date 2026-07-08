// Every feed mode the app exposes. Defined here (not in the route) so
// app/lib/algorithm/* never has to import from app/api/* — the dependency
// direction stays route → algorithm, never the reverse.
export type FeedMode = "for-you" | "trending" | "following" | "news" | "ai" | "technology" | "local";

// Single source of truth for every ranking-behavior difference across feed
// modes — replaces the old per-route FEED_CONFIGS. computeScore() (see
// computeScore.ts) is the only function that reads this; nothing else
// should branch on `mode` for scoring purposes.
export interface ScoringModeConfig {
  // Which of computeXScore's two internal branches to invoke (it only ever
  // branches on this one thing — whether to apply the following-graph
  // relationshipFactor). Every other behavior difference lives here, not there.
  computeXScoreMode: "for-you" | "trending";
  halfLifeHours: number;
  maxAgeHours?: number;
  // false ⇒ computeScore feeds computeXScore a neutral context (no following
  // graph, no interest tags, no engagement/seen history, no viewer geo) —
  // the only mode this applies to today is "trending".
  usePersonalization: boolean;
  // Adds the velocity / geo-cluster / global-social-proof multipliers on top
  // of computeXScore's output. Only meaningful (and only true) for "trending".
  useTrendingSignals: boolean;
  // "following"'s extra post-hoc multiplier, evaluated inside computeScore now.
  applyPersonalAffinity: boolean;
  pool: {
    onlyInNetwork?: boolean;
    useCollaborativePool?: boolean;
    useLocalPool?: boolean;
    localMode?: boolean;
    tagFilter?: string[];
  };
  skipDiversity?: boolean;
  trendingInjection?: boolean;
}

export const SCORING_MODES: Record<FeedMode, ScoringModeConfig> = {
  "for-you": {
    computeXScoreMode: "for-you",
    halfLifeHours: 72,
    usePersonalization: true,
    useTrendingSignals: false,
    applyPersonalAffinity: false,
    pool: { useCollaborativePool: true, useLocalPool: true },
    trendingInjection: true,
  },
  trending: {
    computeXScoreMode: "trending",
    halfLifeHours: 72,
    maxAgeHours: 72,
    usePersonalization: false,
    useTrendingSignals: true,
    applyPersonalAffinity: false,
    pool: {},
  },
  following: {
    computeXScoreMode: "trending",
    halfLifeHours: 24,
    usePersonalization: true,
    useTrendingSignals: false,
    applyPersonalAffinity: true,
    pool: { onlyInNetwork: true },
    skipDiversity: true,
  },
  news: {
    computeXScoreMode: "for-you",
    halfLifeHours: 48,
    usePersonalization: true,
    useTrendingSignals: false,
    applyPersonalAffinity: false,
    pool: { tagFilter: ["News"] },
  },
  ai: {
    computeXScoreMode: "for-you",
    halfLifeHours: 72,
    usePersonalization: true,
    useTrendingSignals: false,
    applyPersonalAffinity: false,
    pool: { tagFilter: ["AI", "Machine Learning", "Deep Learning", "AI & ML"] },
  },
  technology: {
    computeXScoreMode: "for-you",
    halfLifeHours: 72,
    usePersonalization: true,
    useTrendingSignals: false,
    applyPersonalAffinity: false,
    pool: { tagFilter: ["Technology", "Tech", "Software", "Hardware"] },
  },
  local: {
    computeXScoreMode: "for-you",
    halfLifeHours: 72,
    usePersonalization: true,
    useTrendingSignals: false,
    applyPersonalAffinity: false,
    pool: { useLocalPool: true, localMode: true },
  },
};
