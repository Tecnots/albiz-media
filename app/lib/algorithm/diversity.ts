import { ScoredPost } from "./scorer";
import {
  MAX_POSTS_PER_AUTHOR_TOP,
  DIVERSITY_TOP_N,
  MAX_POSTS_PER_TAG_TOP,
  DIVERSITY_TAG_TOP_N,
  IN_NETWORK_TARGET_RATIO,
} from "./signals";

// Post-ranking diversity adjustment — mirrors X's diversity stage
// Prevents one author or topic cluster from dominating the top of the feed
export function applyDiversityAdjustment(rankedPosts: ScoredPost[]): ScoredPost[] {
  const authorCounts = new Map<number, number>();
  const tagCounts = new Map<string, number>();
  const result: ScoredPost[] = [];
  const deferred: ScoredPost[] = [];

  for (let i = 0; i < rankedPosts.length; i++) {
    const sp = rankedPosts[i];
    const { post } = sp;
    const authorCount = authorCounts.get(post.userId) ?? 0;
    const primaryTag = post.tags[0] ?? "__none__";
    const tagCount = tagCounts.get(primaryTag) ?? 0;

    const isTopN = result.length < DIVERSITY_TOP_N;
    const isTagTopN = result.length < DIVERSITY_TAG_TOP_N;

    const tooManyFromAuthor = isTopN && authorCount >= MAX_POSTS_PER_AUTHOR_TOP;
    const tooManyFromTag    = isTagTopN && tagCount >= MAX_POSTS_PER_TAG_TOP;

    if (tooManyFromAuthor || tooManyFromTag) {
      deferred.push(sp);
      continue;
    }

    authorCounts.set(post.userId, authorCount + 1);
    tagCounts.set(primaryTag, tagCount + 1);
    result.push(sp);
  }

  // Append deferred posts at the end (still ranked by score within deferred)
  return [...result, ...deferred];
}

// Interleave in-network and out-of-network posts to hit the target ratio
export function interleaveBySource(scored: ScoredPost[]): ScoredPost[] {
  const inNetwork    = scored.filter(s => s.post.source === "in-network");
  // "local" posts belong in the out-of-network interleave slot — they were dropped before this fix
  const outOfNetwork = scored.filter(s => s.post.source === "out-of-network" || s.post.source === "local");

  if (inNetwork.length === 0) return outOfNetwork;
  if (outOfNetwork.length === 0) return inNetwork;

  // Target: for every inNetwork post, how many outOfNetwork?
  const ratio = (1 - IN_NETWORK_TARGET_RATIO) / IN_NETWORK_TARGET_RATIO;
  const result: ScoredPost[] = [];
  let inIdx = 0;
  let outIdx = 0;

  while (inIdx < inNetwork.length || outIdx < outOfNetwork.length) {
    // Add one in-network post
    if (inIdx < inNetwork.length) {
      result.push(inNetwork[inIdx++]);
    }
    // Add ratio out-of-network posts per in-network
    const outCount = Math.round(ratio);
    for (let k = 0; k < outCount && outIdx < outOfNetwork.length; k++) {
      result.push(outOfNetwork[outIdx++]);
    }
  }

  return result;
}
