import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scorePost } from "@/app/lib/analytics-scoring";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// ?days=7|30|90|all  &tz=<offsetMinutes>
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const daysParam   = searchParams.get("days");
    const days        = (!daysParam || daysParam === "all") ? 365 : parseInt(daysParam);
    const tzOffsetMin = parseInt(searchParams.get("tz") || "0");
    const DAY_MS      = 24 * 60 * 60 * 1000;
    const nowMs       = Date.now();
    const rangeStart  = new Date(nowMs - days * DAY_MS);
    const prevStart   = new Date(nowMs - days * 2 * DAY_MS);

    // ── Phase 1: per-post aggregates for scoring ────────────────────────────────
    const [impByPost, likeByPost, commentByPost, shareByPost] =
      await Promise.all([
        prisma.postImpression.groupBy({ by: ["postId"], where: { seenAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postLike.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postComment.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postShareEvent.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      ]);

    const toMap = (rows: { postId: number; _count: { _all: number } }[]) =>
      new Map(rows.map(r => [r.postId, r._count._all]));
    const impMap     = toMap(impByPost as any);
    const likeMap    = toMap(likeByPost as any);
    const commentMap = toMap(commentByPost as any);
    const shareMap   = toMap(shareByPost as any);

    // Cap signal events to top-300 posts by impression — prevents loading millions of dwell rows
    const SIGNAL_CAP = 300;
    const topSignalPostIds = [...impMap.keys()]
      .sort((a, b) => (impMap.get(b) ?? 0) - (impMap.get(a) ?? 0))
      .slice(0, SIGNAL_CAP);

    const signalEvents = topSignalPostIds.length > 0
      ? await prisma.postEngagement.findMany({
          where: {
            postId: { in: topSignalPostIds },
            createdAt: { gte: rangeStart },
            action: { in: ["dwell", "scroll_past", "follow_author"] },
          },
          select: { postId: true, action: true, value: true },
        })
      : [];

    const dwellByPost  = new Map<number, number[]>();
    const scrollByPost = new Map<number, number>();
    const followByPost = new Map<number, number>();
    for (const e of signalEvents) {
      if (e.action === "dwell") {
        const arr = dwellByPost.get(e.postId) ?? [];
        arr.push(e.value ?? 0);
        dwellByPost.set(e.postId, arr);
      } else if (e.action === "scroll_past") {
        scrollByPost.set(e.postId, (scrollByPost.get(e.postId) ?? 0) + 1);
      } else if (e.action === "follow_author") {
        followByPost.set(e.postId, (followByPost.get(e.postId) ?? 0) + 1);
      }
    }

    const totalImpressions = [...impMap.values()].reduce((a, b) => a + b, 0);
    const totalLikes    = [...likeMap.values()].reduce((a, b) => a + b, 0);
    const totalComments = [...commentMap.values()].reduce((a, b) => a + b, 0);
    const totalShares   = [...shareMap.values()].reduce((a, b) => a + b, 0);

    // ── Phase 2: Albiz score distribution ──────────────────────────────────────
    const scores: number[] = [];
    for (const [postId, imps] of impMap) {
      const s = scorePost({
        impressions:  imps,
        likes:        likeMap.get(postId) ?? 0,
        comments:     commentMap.get(postId) ?? 0,
        shares:       shareMap.get(postId) ?? 0,
        dwellValues:  dwellByPost.get(postId) ?? [],
        scrollPast:   scrollByPost.get(postId) ?? 0,
        followAuthor: followByPost.get(postId) ?? 0,
      });
      scores.push(s.xScore);
    }

    const SCORE_BUCKETS = [
      { label: "< 0",  min: -Infinity, max: 0 },
      { label: "0–1",  min: 0,  max: 1 },
      { label: "1–2",  min: 1,  max: 2 },
      { label: "2–4",  min: 2,  max: 4 },
      { label: "4–8",  min: 4,  max: 8 },
      { label: "8+",   min: 8,  max: Infinity },
    ];
    const scoreDistribution = SCORE_BUCKETS.map(b => ({
      label: b.label,
      count: scores.filter(s => s >= b.min && s < b.max).length,
    }));
    const avgScore = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;

    // ── Phase 3: aggregated time-series + distributions + role data via SQL ──────
    // All findMany calls replaced with GROUP BY queries returning O(days×metrics) rows
    // instead of O(millions of events). allUsers findMany replaced with SQL JOINs.
    interface DayRow { y: number; m: number; d: number; likes: bigint; comments: bigint; shares: bigint }
    interface ImpDayRow { y: number; m: number; d: number; cnt: bigint }
    interface HeatRow { dow: number; hr: number; cnt: bigint }
    interface BucketRow { bucket: string; cnt: bigint }
    interface RoleRow { role: string; cnt: bigint }

    interface DwellAvgRow { avg_dwell: number | null; total_dwell: bigint }
    interface SignalCountRow { action: string; cnt: bigint }

    const [
      engDayRows, impDayRows,
      prevLikeCount, prevCommentCount, prevShareCount,
      dwellBucketRows,
      posBucketRows,
      roleLikeRows, roleCommentRows, roleShareRows, roleImpRows,
      heatRows,
      dwellAvgRows, signalCountRows,
    ] = await Promise.all([
      // Engagement (likes/comments/shares) per day — combined query returning three columns
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               SUM(CASE WHEN src='like'    THEN 1 ELSE 0 END)::bigint AS likes,
               SUM(CASE WHEN src='comment' THEN 1 ELSE 0 END)::bigint AS comments,
               SUM(CASE WHEN src='share'   THEN 1 ELSE 0 END)::bigint AS shares
        FROM (
          SELECT "createdAt" AS ts, 'like'    AS src FROM "PostLike"       WHERE "createdAt" >= ${rangeStart}
          UNION ALL
          SELECT "createdAt",       'comment'        FROM "PostComment"    WHERE "createdAt" >= ${rangeStart}
          UNION ALL
          SELECT "createdAt",       'share'          FROM "PostShareEvent" WHERE "createdAt" >= ${rangeStart}
        ) eng GROUP BY 1, 2, 3`,
      // Impressions per day
      prisma.$queryRaw<ImpDayRow[]>`
        SELECT EXTRACT(YEAR  FROM "seenAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM "seenAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM "seenAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM "PostImpression" WHERE "seenAt" >= ${rangeStart}
        GROUP BY 1, 2, 3`,
      // Previous period scalar counts for comparison
      prisma.postLike.count({      where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postComment.count({   where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postShareEvent.count({ where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      // Dwell distribution bucketed in SQL — returns ≤5 rows instead of millions
      prisma.$queryRaw<BucketRow[]>`
        SELECT CASE
                 WHEN value <  5  THEN '< 5s'
                 WHEN value <  15 THEN '5–15s'
                 WHEN value <  30 THEN '15–30s'
                 WHEN value <  60 THEN '30–60s'
                 ELSE '60s+'
               END AS bucket,
               COUNT(*)::bigint AS cnt
        FROM "PostEngagement"
        WHERE action = 'dwell' AND "createdAt" >= ${rangeStart}
        GROUP BY 1`,
      // Feed position distribution bucketed in SQL — returns ≤4 rows
      prisma.$queryRaw<BucketRow[]>`
        SELECT CASE
                 WHEN position BETWEEN 1  AND 3    THEN '1–3'
                 WHEN position BETWEEN 4  AND 6    THEN '4–6'
                 WHEN position BETWEEN 7  AND 10   THEN '7–10'
                 ELSE '10+'
               END AS bucket,
               COUNT(*)::bigint AS cnt
        FROM "PostImpression"
        WHERE "seenAt" >= ${rangeStart} AND position IS NOT NULL
        GROUP BY 1`,
      // Consumer role breakdown via SQL JOIN — replaces allUsers findMany + 4 groupBy
      prisma.$queryRaw<RoleRow[]>`
        SELECT u.role, COUNT(*)::bigint AS cnt
        FROM "PostLike" l JOIN "User" u ON l."userId" = u.id
        WHERE l."createdAt" >= ${rangeStart} GROUP BY u.role`,
      prisma.$queryRaw<RoleRow[]>`
        SELECT u.role, COUNT(*)::bigint AS cnt
        FROM "PostComment" c JOIN "User" u ON c."userId" = u.id
        WHERE c."createdAt" >= ${rangeStart} GROUP BY u.role`,
      prisma.$queryRaw<RoleRow[]>`
        SELECT u.role, COUNT(*)::bigint AS cnt
        FROM "PostShareEvent" s JOIN "User" u ON s."userId" = u.id
        WHERE s."createdAt" >= ${rangeStart} AND s."userId" IS NOT NULL GROUP BY u.role`,
      prisma.$queryRaw<RoleRow[]>`
        SELECT u.role, COUNT(*)::bigint AS cnt
        FROM "PostImpression" i JOIN "User" u ON i."userId" = u.id
        WHERE i."seenAt" >= ${rangeStart} GROUP BY u.role`,
      // Heatmap: day-of-week × hour bucketed in SQL — returns ≤168 rows instead of millions
      prisma.$queryRaw<HeatRow[]>`
        SELECT EXTRACT(DOW  FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS dow,
               EXTRACT(HOUR FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS hr,
               COUNT(*)::bigint AS cnt
        FROM (
          SELECT "createdAt" AS ts FROM "PostLike"       WHERE "createdAt" >= ${rangeStart}
          UNION ALL
          SELECT "createdAt"       FROM "PostComment"    WHERE "createdAt" >= ${rangeStart}
          UNION ALL
          SELECT "createdAt"       FROM "PostShareEvent" WHERE "createdAt" >= ${rangeStart}
        ) eng GROUP BY 1, 2`,
      // Global dwell average from full dataset (not capped to top-300)
      prisma.$queryRaw<DwellAvgRow[]>`
        SELECT AVG(value)::float AS avg_dwell, COUNT(*)::bigint AS total_dwell
        FROM "PostEngagement" WHERE action = 'dwell' AND "createdAt" >= ${rangeStart}`,
      // Global scroll_past and follow_author counts
      prisma.$queryRaw<SignalCountRow[]>`
        SELECT action, COUNT(*)::bigint AS cnt FROM "PostEngagement"
        WHERE action IN ('scroll_past', 'follow_author') AND "createdAt" >= ${rangeStart}
        GROUP BY action`,
    ]);

    // ── Post type breakdown ────────────────────────────────────────────────────
    const allPostIds = [...impMap.keys()];
    const postTypeRows = allPostIds.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: allPostIds } },
          select: { id: true, type: true, userId: true },
        })
      : [];
    const postTypeMap = new Map(postTypeRows.map(p => [p.id, String(p.type)]));

    const typeImpMap: Record<string, number> = {};
    const typeEngMap: Record<string, number> = {};
    for (const [postId, imps] of impMap) {
      const t = postTypeMap.get(postId) ?? "POST";
      typeImpMap[t] = (typeImpMap[t] ?? 0) + imps;
      const eng = (likeMap.get(postId) ?? 0) + (commentMap.get(postId) ?? 0) + (shareMap.get(postId) ?? 0);
      typeEngMap[t] = (typeEngMap[t] ?? 0) + eng;
    }
    const typeBreakdown = Object.keys(typeImpMap).map(type => ({
      type,
      impressions:    typeImpMap[type],
      engagements:    typeEngMap[type] ?? 0,
      rate:           typeImpMap[type] > 0
        ? parseFloat(((typeEngMap[type] ?? 0) / typeImpMap[type] * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.impressions - a.impressions);

    // ── Day-by-day time series — built from SQL GROUP BY results ──────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // SQL month is 1-indexed; JS Date.getUTCMonth() is 0-indexed — subtract 1 for the key
    const likesDayMap    = new Map<string, number>();
    const commentsDayMap = new Map<string, number>();
    const sharesDayMap   = new Map<string, number>();
    for (const r of engDayRows) {
      const k = `${r.y}-${r.m - 1}-${r.d}`;
      likesDayMap.set(k,    (likesDayMap.get(k)    ?? 0) + Number(r.likes));
      commentsDayMap.set(k, (commentsDayMap.get(k) ?? 0) + Number(r.comments));
      sharesDayMap.set(k,   (sharesDayMap.get(k)   ?? 0) + Number(r.shares));
    }
    const impsDayMap = new Map<string, number>();
    for (const r of impDayRows) {
      const k = `${r.y}-${r.m - 1}-${r.d}`;
      impsDayMap.set(k, (impsDayMap.get(k) ?? 0) + Number(r.cnt));
    }

    const bucketCount = Math.min(days, 30);
    const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
      const utc   = new Date(nowMs - (bucketCount - 1 - i) * DAY_MS);
      const local = new Date(utc.getTime() + tzOffsetMin * 60 * 1000);
      const k     = `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
      const l   = likesDayMap.get(k)    ?? 0;
      const c   = commentsDayMap.get(k) ?? 0;
      const s   = sharesDayMap.get(k)   ?? 0;
      const imp = impsDayMap.get(k)     ?? 0;
      return {
        date:           `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`,
        likes:          l,
        comments:       c,
        shares:         s,
        total:          l + c + s,
        engagementRate: imp > 0 ? parseFloat(((l + c + s) / imp * 100).toFixed(2)) : 0,
      };
    });

    // ── Dwell time distribution — from SQL bucket rows ──────────────────────────
    const DWELL_ORDER = ["< 5s", "5–15s", "15–30s", "30–60s", "60s+"];
    const dwellBucketMap = new Map(dwellBucketRows.map(r => [r.bucket, Number(r.cnt)]));
    const dwellDistribution = DWELL_ORDER.map(label => ({
      label,
      count: dwellBucketMap.get(label) ?? 0,
    }));

    // ── Hourly / day-of-week / 7×24 heatmap — from SQL GROUP BY rows ──────────
    const hourlyBuckets = new Array(24).fill(0) as number[];
    const dayBuckets    = new Array(7).fill(0) as number[];
    const heatGrid      = new Array(7 * 24).fill(0) as number[];
    for (const r of heatRows) {
      const dow = Number(r.dow);
      const hr  = Number(r.hr);
      const cnt = Number(r.cnt);
      hourlyBuckets[hr] = (hourlyBuckets[hr] ?? 0) + cnt;
      dayBuckets[dow]   = (dayBuckets[dow]   ?? 0) + cnt;
      heatGrid[dow * 24 + hr] = (heatGrid[dow * 24 + hr] ?? 0) + cnt;
    }
    const hourlyEngagement = hourlyBuckets.map((count, hour) => ({ hour, count }));
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOfWeekEngagement = dayBuckets.map((count, day) => ({ day, label: DAY_LABELS[day], count }));
    const heatmapData = heatGrid.map((count, idx) => ({
      day:  Math.floor(idx / 24),
      hour: idx % 24,
      count,
    }));

    // ── Action comparison vs prior period ──────────────────────────────────────
    const pctChange = (curr: number, prev: number) =>
      prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : curr > 0 ? 100 : 0;

    const actionComparison = [
      { action: "Likes",    current: totalLikes,    prev: prevLikeCount,    change: pctChange(totalLikes, prevLikeCount) },
      { action: "Comments", current: totalComments, prev: prevCommentCount, change: pctChange(totalComments, prevCommentCount) },
      { action: "Shares",   current: totalShares,   prev: prevShareCount,   change: pctChange(totalShares, prevShareCount) },
    ];

    // ── Role engagement breakdown — from SQL JOIN rows ─────────────────────────
    const ROLE_ORDER = ["NORMAL", "CIRCLE", "AUTHOR", "EDITOR", "ADMIN"] as const;

    type ConsumerStats = { likes: number; comments: number; shares: number; impressions: number };
    const roleConsumerMap: Record<string, ConsumerStats> = {};
    for (const role of ROLE_ORDER) roleConsumerMap[role] = { likes: 0, comments: 0, shares: 0, impressions: 0 };

    for (const r of roleLikeRows) {
      const role = String(r.role);
      if (roleConsumerMap[role]) roleConsumerMap[role].likes += Number(r.cnt);
    }
    for (const r of roleCommentRows) {
      const role = String(r.role);
      if (roleConsumerMap[role]) roleConsumerMap[role].comments += Number(r.cnt);
    }
    for (const r of roleShareRows) {
      const role = String(r.role);
      if (roleConsumerMap[role]) roleConsumerMap[role].shares += Number(r.cnt);
    }
    for (const r of roleImpRows) {
      const role = String(r.role);
      if (roleConsumerMap[role]) roleConsumerMap[role].impressions += Number(r.cnt);
    }

    const roleEngagement = ROLE_ORDER.map(role => {
      const c = roleConsumerMap[role];
      const total = c.likes + c.comments + c.shares;
      return {
        role,
        likes: c.likes,
        comments: c.comments,
        shares: c.shares,
        total,
        viewedPosts: c.impressions,
        rate: c.impressions > 0 ? parseFloat((total / c.impressions * 100).toFixed(1)) : 0,
      };
    });

    // Fetch author roles only for the posts we have (avoids scanning all users)
    const authorIds = [...new Set(postTypeRows.map(p => p.userId))];
    const authorRoleRows = authorIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: authorIds } },
          select: { id: true, role: true },
        })
      : [];
    const authorRoleMap = new Map(authorRoleRows.map(u => [u.id, String(u.role)]));

    type CreatorStats = { posts: number; impressions: number; likes: number; comments: number; shares: number };
    const roleCreatorMap: Record<string, CreatorStats> = {};
    for (const role of ROLE_ORDER) roleCreatorMap[role] = { posts: 0, impressions: 0, likes: 0, comments: 0, shares: 0 };

    for (const p of postTypeRows) {
      const authorRole = authorRoleMap.get(p.userId) ?? "NORMAL";
      if (!roleCreatorMap[authorRole]) continue;
      roleCreatorMap[authorRole].posts++;
      roleCreatorMap[authorRole].impressions += impMap.get(p.id) ?? 0;
      roleCreatorMap[authorRole].likes       += likeMap.get(p.id)    ?? 0;
      roleCreatorMap[authorRole].comments    += commentMap.get(p.id) ?? 0;
      roleCreatorMap[authorRole].shares      += shareMap.get(p.id)   ?? 0;
    }

    const roleContentPerformance = ROLE_ORDER.map(role => {
      const a = roleCreatorMap[role];
      const totalEng = a.likes + a.comments + a.shares;
      return {
        role,
        posts: a.posts,
        impressions: a.impressions,
        avgImpressions: a.posts > 0 ? parseFloat((a.impressions / a.posts).toFixed(1)) : 0,
        totalEngagements: totalEng,
        rate: a.impressions > 0 ? parseFloat((totalEng / a.impressions * 100).toFixed(1)) : 0,
      };
    });

    // ── Feed position distribution — from SQL bucket rows ─────────────────────
    const POS_ORDER = ["1–3", "4–6", "7–10", "10+"];
    const posBucketMap = new Map(posBucketRows.map(r => [r.bucket, Number(r.cnt)]));
    const positionBuckets = POS_ORDER.map(label => ({
      label,
      count: posBucketMap.get(label) ?? 0,
    }));

    // ── Derive global signal scalars from SQL results ───────────────────────────
    const avgDwellSeconds = dwellAvgRows[0]?.avg_dwell != null
      ? parseFloat((dwellAvgRows[0].avg_dwell).toFixed(1)) : 0;
    const totalDwellCount = dwellAvgRows[0]?.total_dwell != null ? Number(dwellAvgRows[0].total_dwell) : 0;
    const scMap = new Map(signalCountRows.map(r => [r.action, Number(r.cnt)]));
    const totalScroll = scMap.get("scroll_past")   ?? 0;
    const totalFollow = scMap.get("follow_author") ?? 0;

    return NextResponse.json({
      signals: {
        avgDwellSeconds,
        engagementRate:    totalImpressions > 0
          ? parseFloat((((totalLikes + totalComments + totalShares) / totalImpressions) * 100).toFixed(1)) : 0,
        scrollPastRate:    totalImpressions > 0 ? parseFloat(((totalScroll / totalImpressions) * 100).toFixed(1)) : 0,
        followThroughRate: totalImpressions > 0 ? parseFloat(((totalFollow / totalImpressions) * 100).toFixed(1)) : 0,
        avgScore,
        scoredPosts: scores.length,
        totalLikes, totalComments, totalShares,
        totalScrollPast: totalScroll,
      },
      actionBreakdown: [
        { action: "Likes",       count: totalLikes },
        { action: "Comments",    count: totalComments },
        { action: "Shares",      count: totalShares },
        { action: "Dwell",       count: totalDwellCount },
        { action: "Scroll past", count: totalScroll },
        { action: "Follows",     count: totalFollow },
      ],
      scoreDistribution,
      positionBuckets,
      totalImpressions,
      timeSeries,
      dwellDistribution,
      hourlyEngagement,
      dayOfWeekEngagement,
      heatmapData,
      typeBreakdown,
      actionComparison,
      roleEngagement,
      roleContentPerformance,
    });
  } catch (err) {
    console.error("[admin/analytics/engagement] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
