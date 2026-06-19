import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scorePost } from "@/app/lib/analytics-scoring";

// Platform-wide algorithm signals + Albiz-score distribution.
// ?days=7|30|90|all  &tz=<offsetMinutes>
export async function GET(request: NextRequest) {
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
    const [impByPost, likeByPost, commentByPost, shareByPost, signalEvents, impWithPos] =
      await Promise.all([
        prisma.postImpression.groupBy({ by: ["postId"], where: { seenAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postLike.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postComment.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postShareEvent.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postEngagement.findMany({
          where: { createdAt: { gte: rangeStart }, action: { in: ["dwell", "scroll_past", "follow_author"] } },
          select: { postId: true, action: true, value: true },
        }),
        prisma.postImpression.findMany({
          where: { seenAt: { gte: rangeStart }, position: { not: null } },
          select: { position: true },
        }),
      ]);

    const toMap = (rows: { postId: number; _count: { _all: number } }[]) =>
      new Map(rows.map(r => [r.postId, r._count._all]));
    const impMap     = toMap(impByPost as any);
    const likeMap    = toMap(likeByPost as any);
    const commentMap = toMap(commentByPost as any);
    const shareMap   = toMap(shareByPost as any);

    const dwellByPost  = new Map<number, number[]>();
    const scrollByPost = new Map<number, number>();
    const followByPost = new Map<number, number>();
    let totalDwellSum = 0, totalDwellCount = 0, totalScroll = 0, totalFollow = 0;
    for (const e of signalEvents) {
      if (e.action === "dwell") {
        const arr = dwellByPost.get(e.postId) ?? [];
        arr.push(e.value ?? 0);
        dwellByPost.set(e.postId, arr);
        totalDwellSum += e.value ?? 0;
        totalDwellCount++;
      } else if (e.action === "scroll_past") {
        scrollByPost.set(e.postId, (scrollByPost.get(e.postId) ?? 0) + 1);
        totalScroll++;
      } else if (e.action === "follow_author") {
        followByPost.set(e.postId, (followByPost.get(e.postId) ?? 0) + 1);
        totalFollow++;
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

    // ── Phase 3: new time-series + distribution data + role queries ───────────
    const [
      likeRows, commentRows, shareRows, impRows,
      prevLikeCount, prevCommentCount, prevShareCount,
      dwellAllRows,
      likesByUser, commentsByUser, sharesByUser, impsByUser, allUsers,
    ] = await Promise.all([
      prisma.postLike.findMany({       where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
      prisma.postComment.findMany({    where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
      prisma.postShareEvent.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
      prisma.postImpression.findMany({ where: { seenAt:    { gte: rangeStart } }, select: { seenAt: true } }),
      prisma.postLike.count({          where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postComment.count({       where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postShareEvent.count({    where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postEngagement.findMany({ where: { action: "dwell", createdAt: { gte: rangeStart } }, select: { value: true } }),
      // consumer engagement per user (for role aggregation)
      prisma.postLike.groupBy({ by: ["userId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postComment.groupBy({ by: ["userId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postShareEvent.groupBy({ by: ["userId"], where: { createdAt: { gte: rangeStart }, userId: { not: null } }, _count: { _all: true } }),
      prisma.postImpression.groupBy({ by: ["userId"], where: { seenAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.user.findMany({ select: { id: true, role: true } }),
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

    // ── Day-by-day time series ──────────────────────────────────────────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const localDayKey = (d: Date): string => {
      const local = new Date(d.getTime() + tzOffsetMin * 60 * 1000);
      return `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
    };

    const likesDayMap    = new Map<string, number>();
    const commentsDayMap = new Map<string, number>();
    const sharesDayMap   = new Map<string, number>();
    const impsDayMap     = new Map<string, number>();
    for (const r of likeRows)    { const k = localDayKey(r.createdAt); likesDayMap.set(k,    (likesDayMap.get(k)    ?? 0) + 1); }
    for (const r of commentRows) { const k = localDayKey(r.createdAt); commentsDayMap.set(k, (commentsDayMap.get(k) ?? 0) + 1); }
    for (const r of shareRows)   { const k = localDayKey(r.createdAt); sharesDayMap.set(k,   (sharesDayMap.get(k)   ?? 0) + 1); }
    for (const r of impRows)     { const k = localDayKey(r.seenAt);    impsDayMap.set(k,     (impsDayMap.get(k)     ?? 0) + 1); }

    const bucketCount = Math.min(days, 30);
    const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
      const utc   = new Date(nowMs - (bucketCount - 1 - i) * DAY_MS);
      const local = new Date(utc.getTime() + tzOffsetMin * 60 * 1000);
      const k     = `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
      const l = likesDayMap.get(k)    ?? 0;
      const c = commentsDayMap.get(k) ?? 0;
      const s = sharesDayMap.get(k)   ?? 0;
      const imp = impsDayMap.get(k)   ?? 0;
      return {
        date:           `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`,
        likes:          l,
        comments:       c,
        shares:         s,
        total:          l + c + s,
        engagementRate: imp > 0 ? parseFloat(((l + c + s) / imp * 100).toFixed(2)) : 0,
      };
    });

    // ── Dwell time distribution ─────────────────────────────────────────────────
    const DWELL_BUCKETS = [
      { label: "< 5s",   min: 0,  max: 5 },
      { label: "5–15s",  min: 5,  max: 15 },
      { label: "15–30s", min: 15, max: 30 },
      { label: "30–60s", min: 30, max: 60 },
      { label: "60s+",   min: 60, max: Infinity },
    ];
    const dwellDistribution = DWELL_BUCKETS.map(b => ({
      label: b.label,
      count: dwellAllRows.filter(r => (r.value ?? 0) >= b.min && (r.value ?? 0) < b.max).length,
    }));

    // ── Hourly / day-of-week / 7×24 heatmap ──────────────────────────────────
    const allActionRows  = [...likeRows, ...commentRows, ...shareRows];
    const hourlyBuckets  = new Array(24).fill(0) as number[];
    const dayBuckets     = new Array(7).fill(0) as number[];
    const heatGrid       = new Array(7 * 24).fill(0) as number[];
    for (const r of allActionRows) {
      const local = new Date(r.createdAt.getTime() + tzOffsetMin * 60 * 1000);
      const h = local.getUTCHours();
      const d = local.getUTCDay();
      hourlyBuckets[h]++;
      dayBuckets[d]++;
      heatGrid[d * 24 + h]++;
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

    // ── Role engagement breakdown ──────────────────────────────────────────────
    const ROLE_ORDER = ["NORMAL", "CIRCLE", "AUTHOR", "EDITOR", "ADMIN"] as const;
    const userRoleMap = new Map<number, string>((allUsers as { id: number; role: string }[]).map(u => [u.id, String(u.role)]));

    type ConsumerStats = { likes: number; comments: number; shares: number; impressions: number };
    const roleConsumerMap: Record<string, ConsumerStats> = {};
    for (const role of ROLE_ORDER) roleConsumerMap[role] = { likes: 0, comments: 0, shares: 0, impressions: 0 };

    for (const r of likesByUser as { userId: number; _count: { _all: number } }[]) {
      const role = userRoleMap.get(r.userId) ?? "NORMAL";
      if (roleConsumerMap[role]) roleConsumerMap[role].likes += r._count._all;
    }
    for (const r of commentsByUser as { userId: number; _count: { _all: number } }[]) {
      const role = userRoleMap.get(r.userId) ?? "NORMAL";
      if (roleConsumerMap[role]) roleConsumerMap[role].comments += r._count._all;
    }
    for (const r of sharesByUser as { userId: number | null; _count: { _all: number } }[]) {
      if (!r.userId) continue;
      const role = userRoleMap.get(r.userId) ?? "NORMAL";
      if (roleConsumerMap[role]) roleConsumerMap[role].shares += r._count._all;
    }
    for (const r of impsByUser as { userId: number; _count: { _all: number } }[]) {
      const role = userRoleMap.get(r.userId) ?? "NORMAL";
      if (roleConsumerMap[role]) roleConsumerMap[role].impressions += r._count._all;
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

    type CreatorStats = { posts: number; impressions: number; likes: number; comments: number; shares: number };
    const roleCreatorMap: Record<string, CreatorStats> = {};
    for (const role of ROLE_ORDER) roleCreatorMap[role] = { posts: 0, impressions: 0, likes: 0, comments: 0, shares: 0 };

    for (const p of postTypeRows) {
      const authorRole = userRoleMap.get(p.userId) ?? "NORMAL";
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

    // ── Feed position distribution ─────────────────────────────────────────────
    const positionBuckets = [
      { label: "1–3",  range: [1, 3]     },
      { label: "4–6",  range: [4, 6]     },
      { label: "7–10", range: [7, 10]    },
      { label: "10+",  range: [11, 9999] },
    ].map(b => ({
      label: b.label,
      count: impWithPos.filter(i => (i.position ?? 0) >= b.range[0] && (i.position ?? 0) <= b.range[1]).length,
    }));

    return NextResponse.json({
      signals: {
        avgDwellSeconds:   totalDwellCount > 0 ? parseFloat((totalDwellSum / totalDwellCount).toFixed(1)) : 0,
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
