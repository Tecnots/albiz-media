// Shared Albiz-score (X/Twitter-style) post scoring.
// Single source of truth used by both the user-facing reach analytics
// (app/api/analytics/reach) and the admin platform analytics
// (app/api/admin/analytics/*). Keep the weights here — do not duplicate.

export const ALBIZ_WEIGHTS = {
  like: 0.5,
  comment: 1.0,
  share: 2.0,
  dwell30: 2.5,
  dwell15: 1.5,
  dwell5: 0.5,
  scrollPast: -0.5,
  followAuthor: 5.0,
} as const;

export interface PostSignals {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  /** Dwell durations in seconds, one entry per dwell event. */
  dwellValues: number[];
  scrollPast: number;
  followAuthor: number;
}

export interface PostScoreResult {
  /** Sum of weighted signals before normalising by reach. */
  rawScore: number;
  /** rawScore / impressions, rounded to 2dp. The headline "Albiz score". */
  xScore: number;
  /** Mean dwell in seconds, rounded to 1dp. */
  avgDwell: number;
  /** scroll_past events as % of impressions, 1dp. */
  scrollPastRate: number;
  /** follow_author events as % of impressions, 1dp. */
  followThrough: number;
  /** (likes + comments + shares) / impressions as %, 1dp. */
  engagementRate: number;
}

/** Weighted dwell contribution: longer dwell counts for more. */
export function dwellScore(dwellValues: number[]): number {
  const W = ALBIZ_WEIGHTS;
  let score = 0;
  for (const v of dwellValues) {
    if (v >= 30) score += W.dwell30;
    else if (v >= 15) score += W.dwell15;
    else if (v >= 5) score += W.dwell5;
  }
  return score;
}

/** Unnormalised weighted score for a single post. */
export function albizRawScore(s: PostSignals): number {
  const W = ALBIZ_WEIGHTS;
  return (
    s.likes * W.like +
    s.comments * W.comment +
    s.shares * W.share +
    dwellScore(s.dwellValues) +
    s.followAuthor * W.followAuthor +
    s.scrollPast * W.scrollPast
  );
}

/** Full per-post score breakdown, normalised by impressions. */
export function scorePost(s: PostSignals): PostScoreResult {
  const imps = s.impressions;
  const rawScore = albizRawScore(s);
  const avgDwell =
    s.dwellValues.length > 0
      ? s.dwellValues.reduce((a, b) => a + b, 0) / s.dwellValues.length
      : 0;
  const totalEng = s.likes + s.comments + s.shares;

  return {
    rawScore,
    xScore: imps > 0 ? parseFloat((rawScore / imps).toFixed(2)) : 0,
    avgDwell: parseFloat(avgDwell.toFixed(1)),
    scrollPastRate: imps > 0 ? parseFloat(((s.scrollPast / imps) * 100).toFixed(1)) : 0,
    followThrough: imps > 0 ? parseFloat(((s.followAuthor / imps) * 100).toFixed(1)) : 0,
    engagementRate: imps > 0 ? parseFloat(((totalEng / imps) * 100).toFixed(1)) : 0,
  };
}

/** Percent-change helper shared across analytics routes. */
export function calcChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
}
