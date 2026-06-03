import { CandidatePost } from "./candidates";

export interface FilterOptions {
  seenPostIds: Set<number>;
  blockedUserIds: Set<number>;
  mutedUserIds: Set<number>;
  currentUserId: number;
  maxAgeHours?: number; // omit = no age filter
}

// Pre-scoring pipeline filters — mirrors X's home mixer filter stages
export function applyPreScoringFilters(
  candidates: CandidatePost[],
  opts: FilterOptions
): CandidatePost[] {
  const { seenPostIds, blockedUserIds, mutedUserIds, currentUserId, maxAgeHours } = opts;
  const nowMs = Date.now();

  const seen = new Set<number>();
  const result: CandidatePost[] = [];

  for (const post of candidates) {
    // Dedup by post ID
    if (seen.has(post.id)) continue;
    seen.add(post.id);

    // Already seen by this user
    if (seenPostIds.has(post.id)) continue;

    // Self-posts never appear in ranked feed
    if (post.userId === currentUserId) continue;

    // Blocked authors
    if (blockedUserIds.has(post.userId)) continue;

    // Muted authors
    if (mutedUserIds.has(post.userId)) continue;

    // Age filter (only for trending mode)
    if (maxAgeHours !== undefined) {
      const ageHours = (nowMs - new Date(post.createdAt).getTime()) / 3_600_000;
      if (ageHours > maxAgeHours) continue;
    }

    result.push(post);
  }

  return result;
}
