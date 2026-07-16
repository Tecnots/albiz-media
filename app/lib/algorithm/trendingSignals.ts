import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/cache";
import { ACTION_WEIGHTS } from "./signals";

// Trending-only signals — velocity/spike detection, regional engagement
// clustering, and global (non-personalized) social proof. These are
// deliberately separate from computeXScore's existing factors: they answer
// "is this spiking right now, and where" rather than "is this a good match
// for this viewer", and they're computed once per batch (not per item), fed
// into computeScore() via a precomputed Map<postId, TrendingFeatures>.

export interface TrendingFeatures {
  recentEventCount: number; // likes+comments+shares+clicks in the recent window
  priorEventCount: number;  // same window, one period earlier — the actual growth-rate comparison
  viewsDelta: number;       // Post.viewsCount delta since the last precompute run
  topCountryLift: number;   // 1.0 = no regional clustering; higher = a country is over-represented
  socialProofRaw: number;   // comments×3 + shares×2 + likes×1 in the recent window (global, not per-viewer)
}

const EMPTY_FEATURES: TrendingFeatures = { recentEventCount: 0, priorEventCount: 0, viewsDelta: 0, topCountryLift: 1.0, socialProofRaw: 0 };

// ── multipliers consumed by computeScore() ──────────────────────────────────

// Real spike detection: compares a recent window's event count against the
// prior comparable window, not just how recent the post is (that's already
// timeDecayFactor's job, reused as-is). log1p keeps a genuine multi-x spike
// meaningful without letting a near-zero baseline (e.g. 1 → 5 events)
// produce an outsized ratio.
export function velocityMultiplier(f: TrendingFeatures): number {
  const spikeRatio = f.recentEventCount / Math.max(f.priorEventCount, 1);
  const eventVelocity = Math.log1p(spikeRatio);
  const viewVelocity = Math.log1p(Math.max(f.viewsDelta, 0)) * 0.05;
  return 1.0 + Math.min(1.5, eventVelocity * 0.5 + viewVelocity);
}

// Regional viral-spike boost — viewer-independent (does not use countryFactor,
// which is relative to the CURRENT VIEWER's country and would leak
// personalization into a supposedly global ranking).
export function geoClusterMultiplier(f: TrendingFeatures): number {
  return 1.0 + Math.min(1.0, Math.max(f.topCountryLift - 1, 0) * 0.3);
}

// Global, log-scaled popularity from raw weighted counts (not the
// personalized blendedEngagementSignals computeXScore otherwise uses).
export function globalSocialProofMultiplier(f: TrendingFeatures): number {
  return 1.0 + Math.min(0.5, Math.log10(Math.max(f.socialProofRaw + 1, 1)) * 0.15);
}

// ── feature extraction (batched — one query per signal, not per item) ──────

interface WindowCounts { postId: number; recent: number; prior: number; }

async function windowedLikeCounts(ids: number[], windowMinutes: number): Promise<WindowCounts[]> {
  if (ids.length === 0) return [];
  return prisma.$queryRaw<WindowCounts[]>`
    SELECT "postId",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes}))::int AS recent,
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes * 2}) AND "createdAt" < NOW() - make_interval(mins => ${windowMinutes}))::int AS prior
    FROM "PostLike"
    WHERE "postId" = ANY(${ids}::int[])
    GROUP BY "postId"
  `.catch(() => []);
}

async function windowedCommentCounts(ids: number[], windowMinutes: number): Promise<WindowCounts[]> {
  if (ids.length === 0) return [];
  return prisma.$queryRaw<WindowCounts[]>`
    SELECT "postId",
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes}))::int AS recent,
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes * 2}) AND "createdAt" < NOW() - make_interval(mins => ${windowMinutes}))::int AS prior
    FROM "PostComment"
    WHERE "postId" = ANY(${ids}::int[])
    GROUP BY "postId"
  `.catch(() => []);
}

async function windowedShareCounts(ids: number[], windowMinutes: number): Promise<WindowCounts[]> {
  if (ids.length === 0) return [];
  return prisma.$queryRaw<WindowCounts[]>`
    SELECT "postId",
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes}))::int AS recent,
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes * 2}) AND "createdAt" < NOW() - make_interval(mins => ${windowMinutes}))::int AS prior
    FROM "PostShareEvent"
    WHERE "postId" = ANY(${ids}::int[])
    GROUP BY "postId"
  `.catch(() => []);
}

// "Clicks" reuse the existing profile_click/photo_expand PostEngagement
// actions instead of inventing a new event type — there is no dedicated
// click table, and these are already real timestamped rows.
async function windowedClickCounts(ids: number[], windowMinutes: number): Promise<WindowCounts[]> {
  if (ids.length === 0) return [];
  return prisma.$queryRaw<WindowCounts[]>`
    SELECT "postId",
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes}))::int AS recent,
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= NOW() - make_interval(mins => ${windowMinutes * 2}) AND "createdAt" < NOW() - make_interval(mins => ${windowMinutes}))::int AS prior
    FROM "PostEngagement"
    WHERE "postId" = ANY(${ids}::int[]) AND action IN ('profile_click', 'photo_expand')
    GROUP BY "postId"
  `.catch(() => []);
}

interface CountryCount { postId: number; countryCode: string; count: bigint; }

async function windowedCountryCounts(ids: number[], windowMinutes: number): Promise<CountryCount[]> {
  if (ids.length === 0) return [];
  // Engagement events carry no geo themselves — the only way to know where an
  // engager is from is joining back to User.countryCode.
  return prisma.$queryRaw<CountryCount[]>`
    SELECT u."countryCode" AS "countryCode", e."postId", COUNT(*) AS count
    FROM (
      SELECT "postId", "userId" FROM "PostLike" WHERE "postId" = ANY(${ids}::int[]) AND "createdAt" >= NOW() - make_interval(mins => ${windowMinutes})
      UNION ALL
      SELECT "postId", "userId" FROM "PostComment" WHERE "postId" = ANY(${ids}::int[]) AND "createdAt" >= NOW() - make_interval(mins => ${windowMinutes})
      UNION ALL
      SELECT "postId", "userId" FROM "PostShareEvent" WHERE "postId" = ANY(${ids}::int[]) AND "userId" IS NOT NULL AND "createdAt" >= NOW() - make_interval(mins => ${windowMinutes})
    ) e
    JOIN "User" u ON u.id = e."userId" AND u."countryCode" IS NOT NULL
    GROUP BY e."postId", u."countryCode"
  `.catch(() => []);
}

// Each country's share of the whole platform's geo-taggable user base —
// the baseline "lift" is measured against. Refreshed daily (cheap, coarse
// data), reusing the same withCache pattern every other cached signal in
// this app uses.
async function getCountryBaseline(): Promise<Map<string, number>> {
  return withCache("trending:country-baseline", 24 * 60 * 60, async () => {
    const rows = await prisma.$queryRaw<{ countryCode: string; count: bigint }[]>`
      SELECT "countryCode", COUNT(*) AS count FROM "User"
      WHERE "countryCode" IS NOT NULL
      GROUP BY "countryCode"
    `.catch(() => []);
    const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
    const shares = new Map<string, number>();
    for (const r of rows) shares.set(r.countryCode, total > 0 ? Number(r.count) / total : 0);
    return shares;
  });
}

// Previous run's viewsCount per post, read from the last TrendingScore
// upsert (durable — no separate Redis/snapshot table needed).
async function getPreviousViewsSnapshot(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.trendingScore.findMany({
    where: { postId: { in: ids } },
    select: { postId: true, viewsSnapshot: true },
  }).catch(() => []);
  return new Map(rows.map((r) => [r.postId, r.viewsSnapshot]));
}

const MIN_COUNTRY_SAMPLE = 3; // ignore countries with too few engagers to avoid noisy lift spikes

export async function extractTrendingFeatures(
  candidateIds: number[],
  windowMinutes = 15
): Promise<Map<number, TrendingFeatures>> {
  if (candidateIds.length === 0) return new Map();

  const [likes, comments, shares, clicks, countryCounts, baseline, prevViews, posts] = await Promise.all([
    windowedLikeCounts(candidateIds, windowMinutes),
    windowedCommentCounts(candidateIds, windowMinutes),
    windowedShareCounts(candidateIds, windowMinutes),
    windowedClickCounts(candidateIds, windowMinutes),
    windowedCountryCounts(candidateIds, windowMinutes),
    getCountryBaseline(),
    getPreviousViewsSnapshot(candidateIds),
    prisma.post.findMany({ where: { id: { in: candidateIds } }, select: { id: true, viewsCount: true } }),
  ]);

  const features = new Map<number, TrendingFeatures>();
  for (const id of candidateIds) features.set(id, { ...EMPTY_FEATURES });

  // Event-count velocity: sum recent/prior across likes+comments+shares+clicks.
  for (const rows of [likes, comments, shares, clicks]) {
    for (const r of rows) {
      const f = features.get(r.postId);
      if (!f) continue;
      f.recentEventCount += r.recent;
      f.priorEventCount += r.prior;
    }
  }

  // Global social proof: weighted recent counts (comment×3, share×2, like×1).
  for (const r of likes)    { const f = features.get(r.postId); if (f) f.socialProofRaw += r.recent * ACTION_WEIGHTS.like; }
  for (const r of comments) { const f = features.get(r.postId); if (f) f.socialProofRaw += r.recent * ACTION_WEIGHTS.comment; }
  for (const r of shares)   { const f = features.get(r.postId); if (f) f.socialProofRaw += r.recent * ACTION_WEIGHTS.share; }

  // Views delta since last precompute cycle.
  const viewsByPost = new Map(posts.map((p) => [p.id, p.viewsCount]));
  for (const id of candidateIds) {
    const f = features.get(id);
    if (!f) continue;
    const current = viewsByPost.get(id) ?? 0;
    const previous = prevViews.get(id) ?? current; // first run: no delta, not a false spike
    f.viewsDelta = Math.max(current - previous, 0);
  }

  // Regional clustering: max country lift per post, ignoring low-sample countries.
  const totalsByPost = new Map<number, number>();
  for (const r of countryCounts) totalsByPost.set(r.postId, (totalsByPost.get(r.postId) ?? 0) + Number(r.count));
  for (const r of countryCounts) {
    const f = features.get(r.postId);
    if (!f) continue;
    const count = Number(r.count);
    if (count < MIN_COUNTRY_SAMPLE) continue;
    const postTotal = totalsByPost.get(r.postId) ?? count;
    const share = count / postTotal;
    const baselineShare = baseline.get(r.countryCode) ?? (1 / Math.max(baseline.size, 1));
    const lift = baselineShare > 0 ? share / baselineShare : 1.0;
    if (lift > f.topCountryLift) f.topCountryLift = lift;
  }

  return features;
}

// Current viewsCount snapshot, to persist on TrendingScore for next cycle's delta.
export async function getCurrentViewsSnapshot(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const posts = await prisma.post.findMany({ where: { id: { in: ids } }, select: { id: true, viewsCount: true } });
  return new Map(posts.map((p) => [p.id, p.viewsCount]));
}
