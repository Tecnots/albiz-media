import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { calcChange } from "@/app/lib/analytics-scoring";
import { blobStorageService } from "@/lib/blob-storage";

const MAX_DAYS = 365;

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authUser.id;
  const { searchParams } = new URL(request.url);

  const daysParam   = searchParams.get("days");
  const isAllTime   = !daysParam || daysParam === "all";
  const days        = isAllTime ? MAX_DAYS : Math.min(Math.max(1, parseInt(daysParam) || 30), MAX_DAYS);
  const tzOffsetMin = Math.max(-720, Math.min(720, parseInt(searchParams.get("tz") || "0")));
  const tzOffsetMs  = tzOffsetMin * 60 * 1000;

  const nowMs      = Date.now();
  const DAY_MS     = 24 * 60 * 60 * 1000;
  const rangeStart = new Date(nowMs - days * DAY_MS);
  const prevStart  = new Date(rangeStart.getTime() - days * DAY_MS);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ── Aggregate totals — no row loading ─────────────────────────────────────────
  const [totalViews, prevViews, totalLikes, prevLikes, totalComments, prevComments, totalShares] =
    await Promise.all([
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM "PostImpression" pi JOIN "Post" p ON p.id = pi."postId"
        WHERE p."userId" = ${userId} AND pi."seenAt" >= ${rangeStart}
      `.then((rows: [{ c: bigint }]) => Number(rows[0].c)),
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM "PostImpression" pi JOIN "Post" p ON p.id = pi."postId"
        WHERE p."userId" = ${userId} AND pi."seenAt" >= ${prevStart} AND pi."seenAt" < ${rangeStart}
      `.then((rows: [{ c: bigint }]) => Number(rows[0].c)),
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM "PostLike" pl JOIN "Post" p ON p.id = pl."postId"
        WHERE p."userId" = ${userId} AND pl."createdAt" >= ${rangeStart}
      `.then((rows: [{ c: bigint }]) => Number(rows[0].c)),
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM "PostLike" pl JOIN "Post" p ON p.id = pl."postId"
        WHERE p."userId" = ${userId} AND pl."createdAt" >= ${prevStart} AND pl."createdAt" < ${rangeStart}
      `.then((rows: [{ c: bigint }]) => Number(rows[0].c)),
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM "PostComment" pc JOIN "Post" p ON p.id = pc."postId"
        WHERE p."userId" = ${userId} AND pc."createdAt" >= ${rangeStart}
      `.then((rows: [{ c: bigint }]) => Number(rows[0].c)),
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM "PostComment" pc JOIN "Post" p ON p.id = pc."postId"
        WHERE p."userId" = ${userId} AND pc."createdAt" >= ${prevStart} AND pc."createdAt" < ${rangeStart}
      `.then((rows: [{ c: bigint }]) => Number(rows[0].c)),
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*) AS c FROM "PostShareEvent" ps JOIN "Post" p ON p.id = ps."postId"
        WHERE p."userId" = ${userId} AND ps."createdAt" >= ${rangeStart}
      `.then((rows: [{ c: bigint }]) => Number(rows[0].c)),
    ]);

  // ── Follower counts — aggregation ─────────────────────────────────────────────
  const [followers, following, currFollowerGain, prevFollowerGain] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followerId: userId } }),
    prisma.userFollow.count({ where: { followingId: userId, createdAt: { gte: rangeStart } } }),
    prisma.userFollow.count({ where: { followingId: userId, createdAt: { gte: prevStart, lt: rangeStart } } }),
  ]);

  const savedPosts = await prisma.savedPost.count({ where: { userId } });

  // ── Story totals — aggregate SUM, no row loading ──────────────────────────────
  const storyAgg = await prisma.story.aggregate({
    where: { userId, status: "published" },
    _sum: { views: true, likes: true },
  });
  const totalStoryViews = storyAgg._sum.views ?? 0;
  const totalStoryLikes = storyAgg._sum.likes ?? 0;

  // ── Circle / normal / guest breakdown — SQL JOIN + GROUP BY ───────────────────
  const [viewBreakdownRows, likeBreakdownRows, commentBreakdownRows, followerRoleRows] = await Promise.all([
    prisma.$queryRaw<{ user_type: string; count: bigint }[]>`
      SELECT
        CASE
          WHEN pi."userId" IS NULL  THEN 'guest'
          WHEN u.role = 'CIRCLE'    THEN 'circle'
          ELSE 'normal'
        END AS user_type,
        COUNT(*) AS count
      FROM "PostImpression" pi
      JOIN "Post" p ON p.id = pi."postId"
      LEFT JOIN "User" u ON u.id = pi."userId"
      WHERE p."userId" = ${userId} AND pi."seenAt" >= ${rangeStart}
      GROUP BY user_type
    `,
    prisma.$queryRaw<{ user_type: string; count: bigint }[]>`
      SELECT
        CASE
          WHEN u.role = 'CIRCLE' THEN 'circle'
          ELSE 'normal'
        END AS user_type,
        COUNT(*) AS count
      FROM "PostLike" pl
      JOIN "Post" p ON p.id = pl."postId"
      LEFT JOIN "User" u ON u.id = pl."userId"
      WHERE p."userId" = ${userId} AND pl."createdAt" >= ${rangeStart}
      GROUP BY user_type
    `,
    prisma.$queryRaw<{ user_type: string; count: bigint }[]>`
      SELECT
        CASE
          WHEN u.role = 'CIRCLE' THEN 'circle'
          ELSE 'normal'
        END AS user_type,
        COUNT(*) AS count
      FROM "PostComment" pc
      JOIN "Post" p ON p.id = pc."postId"
      LEFT JOIN "User" u ON u.id = pc."userId"
      WHERE p."userId" = ${userId} AND pc."createdAt" >= ${rangeStart}
      GROUP BY user_type
    `,
    prisma.$queryRaw<{ role_type: string; count: bigint }[]>`
      SELECT
        CASE WHEN u.role = 'CIRCLE' THEN 'circle' ELSE 'normal' END AS role_type,
        COUNT(*) AS count
      FROM "UserFollow" uf
      JOIN "User" u ON u.id = uf."followerId"
      WHERE uf."followingId" = ${userId}
      GROUP BY role_type
    `,
  ]);

  const viewMap     = new Map<string, number>(viewBreakdownRows.map(    (r: { user_type: string; count: bigint }) => [r.user_type, Number(r.count)] as [string, number]));
  const likeMap     = new Map<string, number>(likeBreakdownRows.map(    (r: { user_type: string; count: bigint }) => [r.user_type, Number(r.count)] as [string, number]));
  const commentMap  = new Map<string, number>(commentBreakdownRows.map( (r: { user_type: string; count: bigint }) => [r.user_type, Number(r.count)] as [string, number]));
  const followerMap = new Map<string, number>(followerRoleRows.map(     (r: { role_type: string; count: bigint }) => [r.role_type, Number(r.count)] as [string, number]));

  const viewsCircle    = viewMap.get("circle")    ?? 0;
  const viewsNormal    = viewMap.get("normal")    ?? 0;
  const viewsGuest     = viewMap.get("guest")     ?? 0;
  const likesCircle    = likeMap.get("circle")    ?? 0;
  const likesNormal    = likeMap.get("normal")    ?? 0;
  const likesGuest     = likeMap.get("guest")     ?? 0;
  const commentsCircle = commentMap.get("circle") ?? 0;
  const commentsNormal = commentMap.get("normal") ?? 0;
  const followersCircle = followerMap.get("circle") ?? 0;
  const followersNormal = followerMap.get("normal") ?? 0;

  const circleEngRate = parseFloat(((likesCircle + commentsCircle) / (viewsCircle || 1) * 100).toFixed(1));
  const normalEngRate = parseFloat(((likesNormal + commentsNormal) / (viewsNormal || 1) * 100).toFixed(1));

  const currEngRate = parseFloat(((totalLikes + totalComments) / (totalViews || 1) * 100).toFixed(2));
  const prevEngRate = parseFloat(((prevLikes + prevComments) / (prevViews || 1) * 100).toFixed(2));

  // ── Time-series — SQL GROUP BY day, bucketed in JS to weekly/monthly ──────────
  const rangeDays = days;
  let bucketDays: number;
  let bucketCount: number;

  if (rangeDays <= 30) {
    bucketDays  = 1;
    bucketCount = Math.min(rangeDays, 30);
  } else if (rangeDays <= 90) {
    bucketDays  = 7;
    bucketCount = Math.ceil(rangeDays / 7);
  } else {
    bucketDays  = 30;
    bucketCount = Math.ceil(rangeDays / 30);
  }
  bucketCount = Math.min(bucketCount, 60);

  const seriesStart = new Date(nowMs - bucketCount * bucketDays * DAY_MS);
  const tzSecs      = tzOffsetMs / 1000;

  const [viewsByDay, likesByDay, commentsByDay, sharesByDay] = await Promise.all([
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', pi."seenAt" AT TIME ZONE 'UTC'
        + (${tzSecs}::numeric * INTERVAL '1 second')), 'YYYY-MM-DD') AS day, COUNT(*) AS count
      FROM "PostImpression" pi JOIN "Post" p ON p.id = pi."postId"
      WHERE p."userId" = ${userId} AND pi."seenAt" >= ${seriesStart}
      GROUP BY day ORDER BY day
    `,
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', pl."createdAt" AT TIME ZONE 'UTC'
        + (${tzSecs}::numeric * INTERVAL '1 second')), 'YYYY-MM-DD') AS day, COUNT(*) AS count
      FROM "PostLike" pl JOIN "Post" p ON p.id = pl."postId"
      WHERE p."userId" = ${userId} AND pl."createdAt" >= ${seriesStart}
      GROUP BY day ORDER BY day
    `,
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', pc."createdAt" AT TIME ZONE 'UTC'
        + (${tzSecs}::numeric * INTERVAL '1 second')), 'YYYY-MM-DD') AS day, COUNT(*) AS count
      FROM "PostComment" pc JOIN "Post" p ON p.id = pc."postId"
      WHERE p."userId" = ${userId} AND pc."createdAt" >= ${seriesStart}
      GROUP BY day ORDER BY day
    `,
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', ps."createdAt" AT TIME ZONE 'UTC'
        + (${tzSecs}::numeric * INTERVAL '1 second')), 'YYYY-MM-DD') AS day, COUNT(*) AS count
      FROM "PostShareEvent" ps JOIN "Post" p ON p.id = ps."postId"
      WHERE p."userId" = ${userId} AND ps."createdAt" >= ${seriesStart}
      GROUP BY day ORDER BY day
    `,
  ]);

  const vMap = new Map<string, number>(viewsByDay.map(    (r: { day: string; count: bigint }) => [r.day, Number(r.count)] as [string, number]));
  const lMap = new Map<string, number>(likesByDay.map(    (r: { day: string; count: bigint }) => [r.day, Number(r.count)] as [string, number]));
  const cMap = new Map<string, number>(commentsByDay.map( (r: { day: string; count: bigint }) => [r.day, Number(r.count)] as [string, number]));
  const sMap = new Map<string, number>(sharesByDay.map(   (r: { day: string; count: bigint }) => [r.day, Number(r.count)] as [string, number]));

  const localDayIdx     = (utcMs: number) => Math.floor((utcMs + tzOffsetMs) / DAY_MS);
  const localDayToUtcMs = (idx: number)   => idx * DAY_MS - tzOffsetMs;
  const todayLocalIdx   = localDayIdx(nowMs);

  const fmtLocalDay = (utcMs: number) => {
    const d = new Date(utcMs + tzOffsetMs);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };
  const fmtLocalMonth = (utcMs: number) => {
    const d = new Date(utcMs + tzOffsetMs);
    return `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  };
  const fmtBucket = rangeDays > 90 ? fmtLocalMonth : fmtLocalDay;

  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    const endLocalIdx   = todayLocalIdx + 1 - (bucketCount - 1 - i) * bucketDays;
    const startLocalIdx = endLocalIdx - bucketDays;

    let views = 0, likes = 0, comments = 0, shares = 0;
    for (let d = startLocalIdx; d < endLocalIdx; d++) {
      const utcMs = localDayToUtcMs(d);
      const dt    = new Date(utcMs + tzOffsetMs);
      const key   = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
      views    += vMap.get(key) ?? 0;
      likes    += lMap.get(key) ?? 0;
      comments += cMap.get(key) ?? 0;
      shares   += sMap.get(key) ?? 0;
    }

    return {
      date: fmtBucket(localDayToUtcMs(startLocalIdx)),
      views, likes, comments, shares,
      // hour arrays require individual row loading — omitted for performance
      viewHours: [] as number[], likeHours: [] as number[],
      commentHours: [] as number[], shareHours: [] as number[],
    };
  });

  // ── Sparklines from time series ───────────────────────────────────────────────
  const padTo12 = (arr: number[]) =>
    arr.length >= 12 ? arr.slice(-12) : [...Array(12 - arr.length).fill(0), ...arr];

  const sparkViews     = padTo12(timeSeries.slice(-12).map(d => d.views));
  const sparkLikes     = padTo12(timeSeries.slice(-12).map(d => d.likes));
  const sparkEng       = padTo12(timeSeries.slice(-12).map(d =>
    parseFloat(((d.likes + d.comments) / (d.views || 1) * 100).toFixed(1))
  ));
  const sparkFollowers = padTo12(
    timeSeries.slice(-12).map((_, i, arr) => Math.round((currFollowerGain / (arr.length || 1)) * (i + 1)))
  );

  const stats = [
    {
      label: "Total views",
      value: totalViews.toLocaleString(),
      change: calcChange(totalViews, prevViews),
      up:    totalViews >= prevViews,
      sparkline: sparkViews,
      breakdown: [
        { label: "Circle", value: viewsCircle },
        { label: "Normal", value: viewsNormal },
        { label: "Guest",  value: viewsGuest  },
      ],
    },
    {
      label: "Total likes",
      value: totalLikes.toLocaleString(),
      change: calcChange(totalLikes, prevLikes),
      up:    totalLikes >= prevLikes,
      sparkline: sparkLikes,
      breakdown: [
        { label: "Circle", value: likesCircle },
        { label: "Normal", value: likesNormal },
        { label: "Guest",  value: likesGuest  },
      ],
    },
    {
      label: "Followers",
      value: followers.toLocaleString(),
      change: calcChange(currFollowerGain, prevFollowerGain),
      up:    currFollowerGain >= prevFollowerGain,
      sparkline: sparkFollowers,
      breakdown: [
        { label: "Circle", value: followersCircle },
        { label: "Normal", value: followersNormal },
      ],
    },
    {
      label: "Engagement",
      value: `${currEngRate.toFixed(1)}%`,
      change: calcChange(currEngRate, prevEngRate),
      up:    currEngRate >= prevEngRate,
      sparkline: sparkEng,
      breakdown: [
        { label: "Circle", value: `${circleEngRate}%` },
        { label: "Normal", value: `${normalEngRate}%` },
      ],
    },
  ];

  // ── Engagement breakdown ──────────────────────────────────────────────────────
  const engTotal = totalLikes + totalComments + totalShares || 1;
  const likePct    = Math.round((totalLikes    / engTotal) * 100);
  const commentPct = Math.round((totalComments / engTotal) * 100);
  const sharePct   = 100 - likePct - commentPct;

  const engagementBreakdown = [
    { label: "Likes",    value: totalLikes,    pct: likePct,    color: "#F44444" },
    { label: "Comments", value: totalComments, pct: commentPct, color: "#525252" },
    { label: "Shares",   value: totalShares,   pct: sharePct,   color: "#22c55e" },
  ];

  // ── Follower growth — SQL GROUP BY month, no row loading ─────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const gainedByMonth = await prisma.$queryRaw<{ month: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('month', "createdAt") AS month, COUNT(*) AS count
    FROM "UserFollow"
    WHERE "followingId" = ${userId} AND "createdAt" >= ${sixMonthsAgo}
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY month ASC
  `;

  const gainMap = new Map<string, number>(gainedByMonth.map((r: { month: Date; count: bigint }) => [r.month.toISOString().slice(0, 7), Number(r.count)] as [string, number]));

  const followerGrowth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key    = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const gained = gainMap.get(key) ?? 0;
    return { date: MONTHS[d.getMonth()], gained, lost: 0 };
  });

  // ── Top posts — SQL aggregation, top 10 by impressions in range ───────────────
  const topPostRows = await prisma.$queryRaw<{
    id: number; title: string | null; type: string; image: string | null;
    created_at: Date;
    views: bigint; likes: bigint; comments: bigint; shares: bigint;
  }[]>`
    SELECT
      p.id, p.title, p.type::text, p.image, p."createdAt" AS created_at,
      COUNT(DISTINCT pi.id) AS views,
      COUNT(DISTINCT pl.id) AS likes,
      COUNT(DISTINCT pc.id) AS comments,
      COUNT(DISTINCT ps.id) AS shares
    FROM "Post" p
    LEFT JOIN "PostImpression"  pi ON pi."postId" = p.id AND pi."seenAt"    >= ${rangeStart}
    LEFT JOIN "PostLike"        pl ON pl."postId" = p.id AND pl."createdAt" >= ${rangeStart}
    LEFT JOIN "PostComment"     pc ON pc."postId" = p.id AND pc."createdAt" >= ${rangeStart}
    LEFT JOIN "PostShareEvent"  ps ON ps."postId" = p.id AND ps."createdAt" >= ${rangeStart}
    WHERE p."userId" = ${userId}
    GROUP BY p.id
    HAVING COUNT(DISTINCT pi.id) > 0
    ORDER BY views DESC
    LIMIT 10
  `;

  type TopPostRow = { id: number; title: string | null; type: string; image: string | null; created_at: Date; views: bigint; likes: bigint; comments: bigint; shares: bigint };
  const topPosts = topPostRows.map((r: TopPostRow) => ({
    id:       r.id,
    title:    r.title || "Post",
    type:     r.type,
    image:    blobStorageService.resolveMediaUrl(r.image),
    views:    Number(r.views),
    likes:    Number(r.likes),
    comments: Number(r.comments),
    shares:   Number(r.shares),
    date:     r.created_at.toISOString(),
  }));

  // ── Snapshot ──────────────────────────────────────────────────────────────────
  const snapshot = [
    { label: "Total views",  value: totalViews.toLocaleString() },
    { label: "Total likes",  value: totalLikes.toLocaleString() },
    { label: "Followers",    value: followers.toLocaleString() },
    { label: "Following",    value: following.toLocaleString() },
    { label: "Posts",        value: topPostRows.length.toString() },
    { label: "Story views",  value: totalStoryViews.toLocaleString() },
  ];

  // ── Reach ─────────────────────────────────────────────────────────────────────
  const postsInRange = topPostRows.length;
  const avgPerPost   = postsInRange > 0 ? Math.round(totalViews / postsInRange) : 0;
  const prevPosts    = await prisma.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*) AS c FROM "Post" WHERE "userId" = ${userId}
      AND "createdAt" >= ${prevStart} AND "createdAt" < ${rangeStart}
  `.then((rows: [{ c: bigint }]) => Number(rows[0].c));
  const prevViewsForAvg = prevViews;
  const prevAvgPerPost  = prevPosts > 0 ? Math.round(prevViewsForAvg / prevPosts) : 0;

  const reach = {
    totalImpressions:       totalViews,
    avgImpressionsPerPost:  avgPerPost,
    engagementRate:         currEngRate,
    impressionsChange:      calcChange(totalViews, prevViews),
    engagementRateChange:   calcChange(currEngRate, prevEngRate),
    avgPerPostChange:       calcChange(avgPerPost, prevAvgPerPost),
  };

  return NextResponse.json({
    stats,
    timeSeries,
    topPosts,
    snapshot,
    engagementBreakdown,
    followerGrowth,
    reach,
    views: timeSeries.map(d => ({ date: d.date, value: d.views })),
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    followers,
    following,
    savedPosts,
    totalStoryViews,
    totalStoryLikes,
  });
}
