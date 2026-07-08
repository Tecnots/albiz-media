import { prisma } from "@/lib/prisma";
import { getRankingCandidates } from "@/app/lib/algorithm/candidates";
import { extractTrendingFeatures, getCurrentViewsSnapshot } from "@/app/lib/algorithm/trendingSignals";
import { computeScore, RankingContext } from "@/app/lib/algorithm/computeScore";
import { applyDiversityAdjustment } from "@/app/lib/algorithm/diversity";
import { SCORING_MODES } from "@/app/lib/algorithm/scoringModes";
import { UserContext } from "@/app/lib/algorithm/scorer";

// The dedup-gate interval /api/cron checks before enqueueing this job —
// keeps trending "real-time" on a 5-15 min cadence without a dedicated cron entry.
export const TRENDING_RECOMPUTE_INTERVAL_MS = 10 * 60 * 1000;

// Below this score, a candidate isn't worth keeping in the results table —
// this is the pipeline's "decay filter" stage.
const MIN_TRENDING_SCORE = 0.5;

export async function isTrendingRecomputeDue(): Promise<boolean> {
  const latest = await prisma.trendingScore.findFirst({
    orderBy: { computedAt: "desc" },
    select: { computedAt: true },
  });
  if (!latest) return true;
  return Date.now() - latest.computedAt.getTime() >= TRENDING_RECOMPUTE_INTERVAL_MS;
}

// The exact 7-stage pipeline: collect (24-72h) → aggregate events → compute
// signals → score → decay filter → rank → diversity. computeScore() here is
// the same function a live feed request calls — this job just runs it in
// batch, over a neutral (non-personalized) context, on a schedule.
export async function recomputeTrendingScores(): Promise<{ scored: number; kept: number }> {
  const cfg = SCORING_MODES.trending;

  // 1. Collect — reuses the exact same candidate-generation pipeline Home uses.
  const candidates = await getRankingCandidates(cfg, 0, [], [], new Set(), null);
  if (candidates.length === 0) return { scored: 0, kept: 0 };

  const candidateIds = candidates.map((c) => c.id);

  // 2. Aggregate events — batched, not per-item.
  const trendingFeatures = await extractTrendingFeatures(candidateIds, 15);

  const neutralUserContext: UserContext = {
    followingIds: new Set(),
    userTags: [],
    engagementHistory: new Map(),
    authorHistory: new Map(),
    totalEngagements: 0,
    userCountryCode: null,
  };
  const authorUserIds = [...new Set(candidates.map((c) => c.userId))];
  const authorUsers = await prisma.user.findMany({
    where: { id: { in: authorUserIds }, banned: false, deactivatedAt: null },
    select: { id: true, verified: true, isPremium: true, role: true, followers: true },
  });
  (neutralUserContext as any).userMap = new Map(authorUsers.map((u) => [u.id, u]));

  const context: RankingContext = { userContext: neutralUserContext, trendingFeatures };

  // 3. Compute signals + score — the same computeScore() a live request calls.
  const scored = candidates.map((post) => computeScore(post, context, "trending"));

  // 4. Decay filter.
  const filtered = scored.filter((s) => s.score >= MIN_TRENDING_SCORE);

  // 5. Rank.
  filtered.sort((a, b) => b.score - a.score);

  // 6. Diversity — reused as-is, mode-agnostic.
  const diverse = applyDiversityAdjustment(filtered);

  // 7. Upsert results into TrendingScore.
  const viewsSnapshot = await getCurrentViewsSnapshot(diverse.map((s) => s.post.id));

  await Promise.all(
    diverse.map((s) => {
      const f = trendingFeatures.get(s.post.id);
      return prisma.trendingScore.upsert({
        where: { postId: s.post.id },
        create: {
          postId: s.post.id,
          score: s.score,
          velocity: f?.recentEventCount ?? 0,
          geoCluster: f?.topCountryLift ?? 1.0,
          socialProof: f?.socialProofRaw ?? 0,
          viewsSnapshot: viewsSnapshot.get(s.post.id) ?? 0,
        },
        update: {
          score: s.score,
          velocity: f?.recentEventCount ?? 0,
          geoCluster: f?.topCountryLift ?? 1.0,
          socialProof: f?.socialProofRaw ?? 0,
          viewsSnapshot: viewsSnapshot.get(s.post.id) ?? 0,
          computedAt: new Date(),
        },
      });
    })
  );

  // Drop stale rows for posts that fell out of the trending set entirely.
  const keptIds = diverse.map((s) => s.post.id);
  await prisma.trendingScore.deleteMany({
    where: { postId: { notIn: keptIds.length > 0 ? keptIds : [-1] } },
  }).catch(() => {});

  console.log(`[TRENDING] recomputed: ${scored.length} scored, ${diverse.length} kept`);
  return { scored: scored.length, kept: diverse.length };
}
