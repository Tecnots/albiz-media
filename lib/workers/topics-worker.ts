import { prisma }           from "@/lib/prisma";
import { runTopicsPipeline } from "@/app/lib/algorithm/topics/pipeline";
import { TOPICS_RECOMPUTE_INTERVAL_MS } from "@/app/lib/algorithm/topics/signals";

// ─── Guard: is a recompute actually due? ─────────────────────────────────────

export async function isTopicsRecomputeDue(): Promise<boolean> {
  const latest = await prisma.trendingTopicScore.findFirst({
    where:   { scope: "GLOBAL" },
    orderBy: { computedAt: "desc" },
    select:  { computedAt: true },
  });

  if (!latest) return true;

  const ageMs = Date.now() - latest.computedAt.getTime();
  return ageMs >= TOPICS_RECOMPUTE_INTERVAL_MS;
}

// ─── Main recompute job ───────────────────────────────────────────────────────

export async function recomputeTopicScores(): Promise<void> {
  const nowMs = Date.now();

  // Run the full pipeline: collect → aggregate → score → filter → rank
  const results = await runTopicsPipeline({ nowMs });

  if (results.length === 0) return;

  // Flatten all scopes into upsert rows
  const rows = results.flatMap(({ scope, topics }) =>
    topics.map(t => ({
      tag:             t.tag,
      scope,
      score:           t.score,
      velocity:        t.breakdown.velocity,
      freshness:       t.breakdown.freshness,
      participation:   t.breakdown.participation,
      popularity:      t.breakdown.popularity,
      geo:             t.breakdown.geo,
      postCount:       t.postCount,
      authorCount:     t.authorCount,
      engagementTotal: t.engagementTotal,
      computedAt:      new Date(nowMs),
    }))
  );

  if (rows.length === 0) return;

  // Upsert all rows — createMany + skipDuplicates can't update; use individual
  // upserts batched inside a single transaction to keep atomicity.
  await prisma.$transaction(
    rows.map(row =>
      prisma.trendingTopicScore.upsert({
        where:  { tag_scope: { tag: row.tag, scope: row.scope } },
        create: row,
        update: {
          score:           row.score,
          velocity:        row.velocity,
          freshness:       row.freshness,
          participation:   row.participation,
          popularity:      row.popularity,
          geo:             row.geo,
          postCount:       row.postCount,
          authorCount:     row.authorCount,
          engagementTotal: row.engagementTotal,
          computedAt:      row.computedAt,
        },
      })
    )
  );

  // Prune stale rows that were not produced in this run.
  // A topic missing from the current output means it has aged out or been filtered.
  const keptKeys = new Set(rows.map(r => `${r.scope}::${r.tag}`));

  const allExisting = await prisma.trendingTopicScore.findMany({
    select: { id: true, scope: true, tag: true },
  });

  const staleIds = allExisting
    .filter(r => !keptKeys.has(`${r.scope}::${r.tag}`))
    .map(r => r.id);

  if (staleIds.length > 0) {
    await prisma.trendingTopicScore.deleteMany({ where: { id: { in: staleIds } } });
  }
}

// ─── Route handler helper ─────────────────────────────────────────────────────
// Called by the cron route (app/api/cron/route.ts) or triggered manually.

export async function runTopicsWorker(): Promise<{ ran: boolean; topicsWritten: number }> {
  const due = await isTopicsRecomputeDue();
  if (!due) return { ran: false, topicsWritten: 0 };

  await recomputeTopicScores();

  const count = await prisma.trendingTopicScore.count();
  return { ran: true, topicsWritten: count };
}
