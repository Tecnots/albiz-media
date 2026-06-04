import { getRegion } from "@/lib/regions";

export interface GeoCandidatePost {
  countryCode?: string | null;
  contentScope?: string | null;
}

// Hard-excludes LOCAL-scoped content that isn't from the user's country.
// Returns false if the post should be removed from the candidate pool entirely.
export function passesGeoFilter(
  post: GeoCandidatePost,
  userCountryCode: string | null | undefined
): boolean {
  if (post.contentScope === "LOCAL") {
    if (!post.countryCode || !userCountryCode) return true; // no country data — let through
    return post.countryCode.toUpperCase() === userCountryCode.toUpperCase();
  }
  return true;
}

// Multiplicative factor added to the X-score for geographic relevance.
// Same-country content floats up; regional content gets a smaller lift;
// global content is neutral.
export function countryFactor(
  post: GeoCandidatePost,
  userCountryCode: string | null | undefined,
  localModeMultiplier = 1.0  // doubled in "local" feed mode
): number {
  if (!post.countryCode || !userCountryCode) return 1.0;

  const postCC = post.countryCode.toUpperCase();
  const userCC = userCountryCode.toUpperCase();

  if (postCC === userCC) {
    // Same country — strong local boost
    return 3.0 * localModeMultiplier;
  }

  if (post.contentScope === "REGIONAL") {
    const postRegion = getRegion(postCC);
    const userRegion = getRegion(userCC);
    if (postRegion && userRegion && postRegion === userRegion) {
      return 1.5 * localModeMultiplier;
    }
  }

  return 1.0;
}
