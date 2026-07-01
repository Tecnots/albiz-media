import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { scorePost, calcChange } from "@/app/lib/analytics-scoring";
import { blobStorageService } from "@/lib/blob-storage";

const MAX_DAYS = 365;

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = authUser.id;
  const { searchParams } = new URL(request.url);

  const daysParam   = searchParams.get("days");
  const days        = Math.min(daysParam && daysParam !== "all" ? Math.max(1, parseInt(daysParam) || 30) : 30, MAX_DAYS);
  const tzOffsetMin = Math.max(-720, Math.min(720, parseInt(searchParams.get("tz") || "0")));
  const tzOffsetMs  = tzOffsetMin * 60 * 1000;

  const DAY_MS     = 24 * 60 * 60 * 1000;
  const nowMs      = Date.now();
  const rangeStart = new Date(nowMs - (days === MAX_DAYS ? nowMs : days * DAY_MS));
  const prevStart  = new Date(rangeStart.getTime() - days * DAY_MS);

  // ── Impression totals — aggregation, no row scan ──────────────────────────────
  const [totalImpressions, prevTotalImp, totalFollowers] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM "PostImpression" pi
      JOIN "Post" p ON p.id = pi."postId"
      WHERE p."userId" = ${userId} AND pi."seenAt" >= ${rangeStart}
    `.then(r => Number(r[0].count)),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM "PostImpression" pi
      JOIN "Post" p ON p.id = pi."postId"
      WHERE p."userId" = ${userId} AND pi."seenAt" >= ${prevStart} AND pi."seenAt" < ${rangeStart}
    `.then(r => Number(r[0].count)),
    prisma.userFollow.count({ where: { followingId: userId } }),
  ]);

  // ── Unique accounts reached — SQL DISTINCT ────────────────────────────────────
  const uniqueAccountsRow = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT pi."userId") AS count
    FROM "PostImpression" pi
    JOIN "Post" p ON p.id = pi."postId"
    WHERE p."userId" = ${userId} AND pi."seenAt" >= ${rangeStart}
  `;
  const uniqueAccounts = Number(uniqueAccountsRow[0].count);

  // ── Follower vs non-follower reach via JOIN ────────────────────────────────────
  const followerReachRow = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM "PostImpression" pi
    JOIN "Post" p ON p.id = pi."postId"
    JOIN "UserFollow" uf ON uf."followerId" = pi."userId" AND uf."followingId" = ${userId}
    WHERE p."userId" = ${userId} AND pi."seenAt" >= ${rangeStart}
  `;
  const followerImpressions    = Number(followerReachRow[0].count);
  const nonFollowerImpressions = totalImpressions - followerImpressions;
  const followerReachPct       = totalImpressions > 0
    ? Math.round((followerImpressions / totalImpressions) * 100)
    : 0;
  const nonFollowerReachPct    = 100 - followerReachPct;

  // ── Unique posts ──────────────────────────────────────────────────────────────
  const uniquePostsRow = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT pi."postId") AS count
    FROM "PostImpression" pi
    JOIN "Post" p ON p.id = pi."postId"
    WHERE p."userId" = ${userId} AND pi."seenAt" >= ${rangeStart}
  `;
  const uniquePosts = Number(uniquePostsRow[0].count);
  const avgPerPost  = uniquePosts > 0 ? Math.round(totalImpressions / uniquePosts) : 0;

  // ── Reach / viral metrics ─────────────────────────────────────────────────────
  const reachRate = totalFollowers > 0
    ? Math.min(parseFloat(((uniqueAccounts / totalFollowers) * 100).toFixed(1)), 100)
    : 0;
  const viralMultiplier = totalFollowers > 0 && uniqueAccounts > totalFollowers
    ? parseFloat((uniqueAccounts / totalFollowers).toFixed(1))
    : null;

  // ── Average feed position via SQL ────────────────────────────────────────────
  const avgPositionRow = await prisma.$queryRaw<[{ avg: number | null }]>`
    SELECT AVG(pi.position::float) AS avg
    FROM "PostImpression" pi
    JOIN "Post" p ON p.id = pi."postId"
    WHERE p."userId" = ${userId}
      AND pi."seenAt" >= ${rangeStart}
      AND pi.position IS NOT NULL
  `;
  const avgPosition = avgPositionRow[0]?.avg
    ? parseFloat(Number(avgPositionRow[0].avg).toFixed(1))
    : null;

  const positionsTrackedRow = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM "PostImpression" pi
    JOIN "Post" p ON p.id = pi."postId"
    WHERE p."userId" = ${userId}
      AND pi."seenAt" >= ${rangeStart}
      AND pi.position IS NOT NULL
  `;
  const positionsTracked = Number(positionsTrackedRow[0].count);

  // ── Quality signals via SQL aggregation ───────────────────────────────────────
  const [dwellAgg, scrollCount, followCount, likeCount, commentCount, shareCount] = await Promise.all([
    prisma.$queryRaw<[{ avg_value: number | null; count: bigint }]>`
      SELECT AVG(pe.value) AS avg_value, COUNT(*) AS count
      FROM "PostEngagement" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE p."userId" = ${userId}
        AND pe.action = 'dwell'
        AND pe."createdAt" >= ${rangeStart}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM "PostEngagement" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE p."userId" = ${userId} AND pe.action = 'scroll_past' AND pe."createdAt" >= ${rangeStart}
    `.then(r => Number(r[0].count)),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM "PostEngagement" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE p."userId" = ${userId} AND pe.action = 'follow_author' AND pe."createdAt" >= ${rangeStart}
    `.then(r => Number(r[0].count)),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM "PostLike" pl
      JOIN "Post" p ON p.id = pl."postId"
      WHERE p."userId" = ${userId} AND pl."createdAt" >= ${rangeStart}
    `.then(r => Number(r[0].count)),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM "PostComment" pc
      JOIN "Post" p ON p.id = pc."postId"
      WHERE p."userId" = ${userId} AND pc."createdAt" >= ${rangeStart}
    `.then(r => Number(r[0].count)),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM "PostShareEvent" ps
      JOIN "Post" p ON p.id = ps."postId"
      WHERE p."userId" = ${userId} AND ps."createdAt" >= ${rangeStart}
    `.then(r => Number(r[0].count)),
  ]);

  const avgDwellSeconds  = parseFloat((Number(dwellAgg[0].avg_value ?? 0)).toFixed(1));
  const dwellEventCount  = Number(dwellAgg[0].count);
  const totalEngagements = likeCount + commentCount + shareCount;
  const engagementRate   = totalImpressions > 0
    ? parseFloat(((totalEngagements / totalImpressions) * 100).toFixed(1))
    : 0;
  const scrollPastRate    = totalImpressions > 0
    ? parseFloat(((scrollCount / totalImpressions) * 100).toFixed(1))
    : 0;
  const followThroughRate = totalImpressions > 0
    ? parseFloat(((followCount / totalImpressions) * 100).toFixed(1))
    : 0;

  // ── Per-post scores — SQL aggregation, top 50 posts by impressions ─────────────
  const postStatsRows = await prisma.$queryRaw<{
    id: number; title: string | null; type: string; image: string | null;
    impressions: bigint; likes: bigint; comments: bigint; shares: bigint;
    dwell_count: bigint; avg_dwell: number | null;
    scroll_past: bigint; follow_author: bigint;
  }[]>`
    SELECT
      p.id, p.title, p.type::text, p.image,
      COUNT(DISTINCT pi.id)                                         AS impressions,
      COUNT(DISTINCT pl.id)                                         AS likes,
      COUNT(DISTINCT pc.id)                                         AS comments,
      COUNT(DISTINCT ps.id)                                         AS shares,
      COUNT(DISTINCT pe_d.id)                                       AS dwell_count,
      AVG(pe_d.value)                                               AS avg_dwell,
      COUNT(DISTINCT pe_sp.id)                                      AS scroll_past,
      COUNT(DISTINCT pe_fa.id)                                      AS follow_author
    FROM "Post" p
    LEFT JOIN "PostImpression"  pi   ON pi."postId"  = p.id AND pi."seenAt"    >= ${rangeStart}
    LEFT JOIN "PostLike"        pl   ON pl."postId"  = p.id AND pl."createdAt" >= ${rangeStart}
    LEFT JOIN "PostComment"     pc   ON pc."postId"  = p.id AND pc."createdAt" >= ${rangeStart}
    LEFT JOIN "PostShareEvent"  ps   ON ps."postId"  = p.id AND ps."createdAt" >= ${rangeStart}
    LEFT JOIN "PostEngagement"  pe_d  ON pe_d."postId"  = p.id AND pe_d.action  = 'dwell'        AND pe_d."createdAt"  >= ${rangeStart}
    LEFT JOIN "PostEngagement"  pe_sp ON pe_sp."postId" = p.id AND pe_sp.action = 'scroll_past'  AND pe_sp."createdAt" >= ${rangeStart}
    LEFT JOIN "PostEngagement"  pe_fa ON pe_fa."postId" = p.id AND pe_fa.action = 'follow_author' AND pe_fa."createdAt" >= ${rangeStart}
    WHERE p."userId" = ${userId}
    GROUP BY p.id
    HAVING COUNT(DISTINCT pi.id) > 0
    ORDER BY impressions DESC
    LIMIT 50
  `;

  const postScores = postStatsRows.map(r => {
    const imps     = Number(r.impressions);
    const likes    = Number(r.likes);
    const comments = Number(r.comments);
    const shares   = Number(r.shares);
    const avgDwell = Number(r.avg_dwell ?? 0);
    const scrollPast = Number(r.scroll_past);
    const followAuthor = Number(r.follow_author);

    const score = scorePost({
      impressions:  imps,
      likes,
      comments,
      shares,
      dwellValues:  Array(Number(r.dwell_count)).fill(avgDwell),
      scrollPast,
      followAuthor,
    });

    return {
      id:             r.id,
      title:          r.title || "Post",
      type:           r.type,
      image:          blobStorageService.resolveMediaUrl(r.image),
      impressions:    imps,
      likes,
      comments,
      shares,
      avgDwell:       score.avgDwell,
      scrollPastRate: score.scrollPastRate,
      followThrough:  score.followThrough,
      xScore:         score.xScore,
    };
  }).sort((a, b) => b.xScore - a.xScore);

  // ── Impressions time series — SQL GROUP BY, bounded window ────────────────────
  const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const localDayIdx    = (utcMs: number) => Math.floor((utcMs + tzOffsetMs) / DAY_MS);
  const localDayToUtcMs = (idx: number) => idx * DAY_MS - tzOffsetMs;
  const todayLocalIdx  = localDayIdx(nowMs);
  const bucketCount    = Math.min(days, 30);
  const seriesStart    = new Date(nowMs - bucketCount * DAY_MS);

  const seriesByDay = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT
      TO_CHAR(
        DATE_TRUNC('day', pi."seenAt" AT TIME ZONE 'UTC'
          + (${tzOffsetMs / 1000}::numeric * INTERVAL '1 second')),
        'YYYY-MM-DD'
      ) AS day,
      COUNT(*) AS count
    FROM "PostImpression" pi
    JOIN "Post" p ON p.id = pi."postId"
    WHERE p."userId" = ${userId}
      AND pi."seenAt" >= ${seriesStart}
    GROUP BY day
    ORDER BY day
  `;

  const dayMap = new Map(seriesByDay.map(r => [r.day, Number(r.count)]));

  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    const endLocalIdx   = todayLocalIdx + 1 - (bucketCount - 1 - i);
    const startLocalIdx = endLocalIdx - 1;
    const utcMs = localDayToUtcMs(startLocalIdx);
    const d     = new Date(utcMs + tzOffsetMs);
    const key   = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return {
      date:        `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      impressions: dayMap.get(key) ?? 0,
    };
  });

  // ── Feed position distribution — SQL GROUP BY ──────────────────────────────────
  const posBuckets = await prisma.$queryRaw<{ bucket: string; count: bigint }[]>`
    SELECT
      CASE
        WHEN pi.position BETWEEN 1  AND 3  THEN '1–3'
        WHEN pi.position BETWEEN 4  AND 6  THEN '4–6'
        WHEN pi.position BETWEEN 7  AND 10 THEN '7–10'
        WHEN pi.position > 10               THEN '10+'
      END AS bucket,
      COUNT(*) AS count
    FROM "PostImpression" pi
    JOIN "Post" p ON p.id = pi."postId"
    WHERE p."userId" = ${userId}
      AND pi."seenAt" >= ${rangeStart}
      AND pi.position IS NOT NULL
    GROUP BY bucket
  `;

  const posOrder    = ["1–3", "4–6", "7–10", "10+"];
  const posMap      = new Map(posBuckets.map(r => [r.bucket, Number(r.count)]));
  const positionBuckets = posOrder.map(label => ({ label, count: posMap.get(label) ?? 0 }));

  return NextResponse.json({
    summary: {
      totalImpressions,
      uniqueAccounts,
      avgPerPost,
      reachRate,
      viralMultiplier,
      impressionsChange: calcChange(totalImpressions, prevTotalImp),
    },
    distribution: {
      followerReachPct,
      nonFollowerReachPct,
      avgPosition,
      positionsTracked,
    },
    qualitySignals: {
      avgDwellSeconds,
      scrollPastRate,
      followThroughRate,
      engagementRate,
      dwellEvents:      dwellEventCount,
      scrollPastEvents: scrollCount,
      followEvents:     followCount,
    },
    timeSeries,
    postScores,
    positionBuckets,
  });
}
