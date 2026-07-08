import { CandidateShort } from "./candidates";

export interface ShortsFilterOptions {
  userId: number | null;
  blockedIds: Set<number>;
  mutedIds: Set<number>;
  seenIds: Set<number>;
  maxAgeHours?: number;
}

// ── Pre-scoring filter ────────────────────────────────────────────────────────
// Hard exclusions applied before scoring to avoid wasting compute.
// Mirrors the Posts filters.ts pattern for CandidateShort.

export function applyPreScoringShortFilters(
  candidates: CandidateShort[],
  opts: ShortsFilterOptions,
): CandidateShort[] {
  const now = Date.now();
  const seen = new Set<number>();

  return candidates.filter(s => {
    // Dedup across pools
    if (seen.has(s.id)) return false;
    seen.add(s.id);

    // Hard-exclude own shorts
    if (opts.userId !== null && s.userId === opts.userId) return false;

    // Block and mute
    if (opts.blockedIds.has(s.userId)) return false;
    if (opts.mutedIds.has(s.userId))   return false;

    // Age cap (optional — Local pool uses a shorter window)
    if (opts.maxAgeHours !== undefined) {
      const ref = s.publishedAt ?? s.createdAt;
      const ageHours = (now - ref.getTime()) / 3_600_000;
      if (ageHours > opts.maxAgeHours) return false;
    }

    return true;
  });
}