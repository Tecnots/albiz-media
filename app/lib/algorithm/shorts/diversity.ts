import { ScoredShort } from "./scorer";
import {
  SHORTS_MAX_PER_CREATOR, SHORTS_DIVERSITY_TOP_N,
  SHORTS_MAX_PER_TAG, SHORTS_TAG_TOP_N,
  SHORTS_FOLLOWING_RATIO,
} from "./signals";

// ── Diversity adjustment ──────────────────────────────────────────────────────
// Mirrors the Posts diversity.ts pattern: demotes excess creator/tag clusters
// in the top-N slice so the feed doesn't get captured by a single creator.

export function applyShortsDiversity(shorts: ScoredShort[]): ScoredShort[] {
  const sorted = [...shorts].sort((a, b) => b.score - a.score);

  const creatorCount = new Map<number, number>();
  const tagCount     = new Map<string, number>();
  const result: ScoredShort[] = [];
  const deferred: ScoredShort[] = [];

  for (const item of sorted) {
    const { short } = item;
    const cCount  = creatorCount.get(short.userId) ?? 0;
    const inTop   = result.length < SHORTS_DIVERSITY_TOP_N;

    if (inTop && cCount >= SHORTS_MAX_PER_CREATOR) {
      deferred.push(item);
      continue;
    }

    const primaryTag = short.tags[0] ?? null;
    if (primaryTag && result.length < SHORTS_TAG_TOP_N) {
      const tCount = tagCount.get(primaryTag) ?? 0;
      if (tCount >= SHORTS_MAX_PER_TAG) {
        deferred.push(item);
        continue;
      }
      tagCount.set(primaryTag, tCount + 1);
    }

    creatorCount.set(short.userId, cCount + 1);
    result.push(item);
  }

  // Append deferred items after the top slice — they still appear, just later
  return [...result, ...deferred];
}

// ── Source interleaving ───────────────────────────────────────────────────────
// Ensures the feed is a mix of following + discovery content.
// SHORTS_FOLLOWING_RATIO target is 40% following, 60% discovery.

export function interleaveShortsBySource(shorts: ScoredShort[]): ScoredShort[] {
  const following  = shorts.filter(s => s.short.source === "following");
  const discovery  = shorts.filter(s => s.short.source !== "following");

  const result: ScoredShort[] = [];
  let fi = 0;
  let di = 0;

  while (fi < following.length || di < discovery.length) {
    const followingRatio = result.length === 0
      ? 0
      : result.filter(s => s.short.source === "following").length / result.length;

    if (followingRatio < SHORTS_FOLLOWING_RATIO && fi < following.length) {
      result.push(following[fi++]);
    } else if (di < discovery.length) {
      result.push(discovery[di++]);
    } else {
      result.push(following[fi++]);
    }
  }

  return result;
}

// ── Exploration jitter ────────────────────────────────────────────────────────
// Adds ±noise to scores on the first page only, widening the discovery surface.
// Consistent for a given short within a session (no full randomness per request).

export function applyExplorationJitter(
  shorts: ScoredShort[],
  isFirstPage: boolean,
): ScoredShort[] {
  if (!isFirstPage) return shorts;
  return shorts.map(item => {
    // Deterministic noise: use short ID mod to seed the jitter range
    const noise = 1.0 + ((item.short.id % 31) - 15) * 0.005; // ±7.5%
    return { ...item, score: item.score * noise };
  });
}