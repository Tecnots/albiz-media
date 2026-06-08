// Standalone verification of the ad ranking engine — no DB, deterministic.
// Run: npx ts-node -r tsconfig-paths/register --compiler-options "{\"module\":\"CommonJS\"}" scripts/verify-ads-algorithm.ts
import { scoreAd, pickCreative, type AdViewerContext, type AdCampaignForScoring } from "@/app/lib/ads-algorithm";
import { DEFAULT_AD_ALGORITHM } from "@/app/lib/ads";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.error(`  FAIL ${name}`); }
}

const now = Date.now();
const baseCreative = { id: 1, weight: 1, impressions: 100, clicks: 3 };

function campaign(over: Partial<AdCampaignForScoring> = {}): AdCampaignForScoring {
  return {
    id: 1, cpc: 1, createdAt: new Date(now), priority: 0, promoteTargetId: null,
    targetCountries: [], targetTags: [], targetAudience: "all",
    pacing: "even", dailyBudget: null, frequencyCap: 0, advertiserName: "Acme",
    ...over,
  };
}

function viewer(over: Partial<AdViewerContext> = {}): AdViewerContext {
  return {
    userId: 7, countryCode: "US", userTags: ["tech"], followingIds: new Set([42]),
    isMember: true, recentImpressions: new Map(), spentToday: new Map(), dayFraction: 0.5,
    ...over,
  };
}

const W = DEFAULT_AD_ALGORITHM;

// ── Eligibility gates ──────────────────────────────────────────────────────
check("guests-only ad is ineligible for a member",
  !scoreAd(campaign({ targetAudience: "guests" }), baseCreative, viewer({ isMember: true }), W, 5, now).eligible);

check("members-only ad is ineligible for a guest",
  !scoreAd(campaign({ targetAudience: "members" }), baseCreative, viewer({ userId: null, isMember: false }), W, 5, now).eligible);

check("country-targeted ad excludes non-matching viewer",
  !scoreAd(campaign({ targetCountries: ["IN"] }), baseCreative, viewer({ countryCode: "US" }), W, 5, now).eligible);

check("country-targeted ad includes matching viewer",
  scoreAd(campaign({ targetCountries: ["US"] }), baseCreative, viewer({ countryCode: "US" }), W, 5, now).eligible);

check("frequency cap blocks after cap reached",
  !scoreAd(campaign({ id: 9, frequencyCap: 2 }), baseCreative, viewer({ recentImpressions: new Map([[9, 2]]) }), W, 5, now).eligible);

check("frequency cap allows under cap",
  scoreAd(campaign({ id: 9, frequencyCap: 2 }), baseCreative, viewer({ recentImpressions: new Map([[9, 1]]) }), W, 5, now).eligible);

check("daily budget hard-stop blocks an over-spent campaign",
  !scoreAd(campaign({ id: 5, pacing: "even", dailyBudget: 100 }), baseCreative, viewer({ spentToday: new Map([[5, 100]]) }), W, 5, now).eligible);

check("minRelevance floor drops an off-target ad",
  !scoreAd(campaign({ targetTags: ["finance"] }), baseCreative, viewer({ userTags: ["sports"] }), { ...W, minRelevance: 0.5 }, 5, now).eligible);

// ── Ranking behavior ───────────────────────────────────────────────────────
const highBid = scoreAd(campaign({ id: 1, cpc: 5 }), baseCreative, viewer(), W, 5, now).score;
const lowBid = scoreAd(campaign({ id: 2, cpc: 1 }), baseCreative, viewer(), W, 5, now).score;
check("higher bid scores higher (bid weight)", highBid > lowBid);

const onTarget = scoreAd(campaign({ targetTags: ["tech"] }), baseCreative, viewer({ userTags: ["tech"] }), W, 5, now);
const offTarget = scoreAd(campaign({ targetTags: ["tech"] }), baseCreative, viewer({ userTags: ["cooking"] }), W, 5, now);
check("interest match scores higher than mismatch", onTarget.score > offTarget.score);
check("interest match produces a relevance reason", onTarget.reason.includes("tech"));

const fresh = scoreAd(campaign({ createdAt: new Date(now) }), baseCreative, viewer(), W, 5, now).score;
const stale = scoreAd(campaign({ createdAt: new Date(now - 30 * 24 * 3600_000) }), baseCreative, viewer(), W, 5, now).score;
check("fresher campaign scores higher (recency weight)", fresh > stale);

const boosted = scoreAd(campaign({ priority: 5 }), baseCreative, viewer(), W, 5, now).score;
const normal = scoreAd(campaign({ priority: 0 }), baseCreative, viewer(), W, 5, now).score;
check("priority boost raises score", boosted > normal);

const pacedAhead = scoreAd(campaign({ id: 3, pacing: "even", dailyBudget: 100 }), baseCreative, viewer({ spentToday: new Map([[3, 90]]), dayFraction: 0.2 }), W, 5, now).score;
const pacedOnTrack = scoreAd(campaign({ id: 4, pacing: "even", dailyBudget: 100 }), baseCreative, viewer({ spentToday: new Map([[4, 20]]), dayFraction: 0.2 }), W, 5, now).score;
check("campaign ahead of pace is throttled below on-track", pacedAhead < pacedOnTrack);

const followerHit = scoreAd(campaign({ targetAudience: "followers", promoteTargetId: 42 }), baseCreative, viewer({ followingIds: new Set([42]) }), W, 5, now);
check("follower-targeted ad reasons 'someone you follow'", followerHit.reason === "From someone you follow");

// ── A/B rotation ───────────────────────────────────────────────────────────
const creatives = [
  { id: 1, weight: 1, impressions: 1000, clicks: 5 },   // 0.5% CTR
  { id: 2, weight: 1, impressions: 1000, clicks: 80 },  // 8% CTR
];
let winsForB = 0;
for (let i = 0; i < 1000; i++) {
  const r = (i + 0.5) / 1000; // deterministic sweep of the 0..1 space
  if (pickCreative(creatives, 0.5, r)?.id === 2) winsForB++;
}
check("higher-CTR creative wins rotation more often", winsForB > 500);
check("single creative always returned", pickCreative([baseCreative], 0.5, 0.99)?.id === 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
