import { getRegion, isSameRegion } from "@/lib/regions";
import { COUNTRY_MATCH_BOOST, REGION_MATCH_BOOST } from "./signals";

export interface GeoCandidatePost {
  countryCode?: string | null;
  contentScope?: string | null;
}

// Hard-excludes geo-restricted content that the viewer is not eligible to see.
// LOCAL  → viewer must be in the exact same country as the author.
// REGIONAL → viewer must be in the same geographic region as the author.
// GLOBAL → always passes.
// If the post has no countryCode but a non-GLOBAL scope, it is excluded (shouldn't
// occur in practice since the posts API falls back non-identified authors to GLOBAL).
export function passesGeoFilter(
  post: GeoCandidatePost,
  userCountryCode: string | null | undefined
): boolean {
  if (post.contentScope === "LOCAL") {
    if (!post.countryCode || !userCountryCode) return false;
    return post.countryCode.toUpperCase() === userCountryCode.toUpperCase();
  }
  if (post.contentScope === "REGIONAL") {
    if (!post.countryCode || !userCountryCode) return false;
    return isSameRegion(post.countryCode, userCountryCode);
  }
  return true; // GLOBAL
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
    return COUNTRY_MATCH_BOOST * localModeMultiplier;
  }

  if (post.contentScope === "REGIONAL") {
    const postRegion = getRegion(postCC);
    const userRegion = getRegion(userCC);
    if (postRegion && userRegion && postRegion === userRegion) {
      return REGION_MATCH_BOOST * localModeMultiplier;
    }
  }

  return 1.0;
}
