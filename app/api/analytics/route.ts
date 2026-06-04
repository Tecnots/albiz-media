import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authUser.id;
  const { searchParams } = new URL(request.url);

  const daysParam = searchParams.get("days");
  const days      = daysParam && daysParam !== "all" ? parseInt(daysParam) : 30;
  const isAllTime = !daysParam || daysParam === "all";

  // tz = user's UTC offset in minutes (e.g. +330 for IST, -300 for EST)
  const tzOffsetMin = parseInt(searchParams.get("tz") || "0");
  const tzOffsetMs  = tzOffsetMin * 60 * 1000;

  const nowMs    = Date.now();
  const DAY_MS   = 24 * 60 * 60 * 1000;
  const rangeMs  = isAllTime ? nowMs : days * DAY_MS;
  const rangeStart = new Date(nowMs - rangeMs);
  const rangeDays  = days;

  // Convert a UTC timestamp to the user's local "day index" (days since epoch in local time)
  const localDayIdx = (utcMs: number) => Math.floor((utcMs + tzOffsetMs) / DAY_MS);
  // Convert a local day index back to the UTC start of that local day
  const localDayToUtcMs = (idx: number) => idx * DAY_MS - tzOffsetMs;

  // All posts — use createdAt (DateTime) for reliable date comparisons;
  // the date field is a human-readable string ("Jun 2nd 2026") that new Date() cannot parse
  const allPosts = await prisma.post.findMany({
    where: { userId },
    select: {
      id: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
      date: true,
      title: true,
      image: true,
      type: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const parseNum = (v: string | null | undefined): number => {
    if (!v) return 0;
    const c = v.replace(/,/g, "").trim().toLowerCase();
    if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
    if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
    return parseInt(c) || 0;
  };

  // Current period posts
  const posts = allPosts.filter(p => p.createdAt >= rangeStart);

  // Previous period posts (same duration, immediately before rangeStart)
  const prevStart = new Date(rangeStart.getTime() - rangeMs);
  const prevPosts = allPosts.filter(p => p.createdAt >= prevStart && p.createdAt < rangeStart);

  const sumField = (arr: typeof allPosts, field: "views" | "likes" | "comments" | "shares") =>
    arr.reduce((s, p) => s + parseNum(p[field]), 0);

  // totalViews / prevViews computed from real PostImpression events below

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return parseFloat(((curr - prev) / prev * 100).toFixed(1));
  };

  // Follower / following counts
  const followers = await prisma.userFollow.count({ where: { followingId: userId } });
  const following = await prisma.userFollow.count({ where: { followerId: userId } });

  // Follower gains: current vs previous period
  const [currFollowerGain, prevFollowerGain] = await Promise.all([
    prisma.userFollow.count({
      where: { followingId: userId, createdAt: { gte: rangeStart } },
    }),
    prisma.userFollow.count({
      where: { followingId: userId, createdAt: { gte: prevStart, lt: rangeStart } },
    }),
  ]);

  const savedPosts = await prisma.savedPost.count({ where: { userId } });

  const stories = await prisma.story.findMany({
    where: { userId, status: "published" },
    select: { views: true, likes: true },
  });
  const totalStoryViews = stories.reduce((s, st) => s + st.views, 0);
  const totalStoryLikes = stories.reduce((s, st) => s + st.likes, 0);

  // ── Real engagement events (actual timestamps, not post publish date) ─────────
  const [
    commentEvents, likeEvents, shareEvents, viewEvents,
    prevCommentEvents, prevLikeEvents, prevShareEvents, prevViewEvents,
  ] = await Promise.all([
    // Current period
    prisma.postComment.findMany({
      where: { post: { userId }, createdAt: { gte: rangeStart } },
      select: { createdAt: true, userId: true },
    }),
    prisma.postLike.findMany({
      where: { post: { userId }, createdAt: { gte: rangeStart } },
      select: { createdAt: true, userId: true },
    }),
    prisma.postShareEvent.findMany({
      where: { post: { userId }, createdAt: { gte: rangeStart } },
      select: { createdAt: true },
    }),
    // Views — PostImpression.seenAt = first real view timestamp per (user, post) pair
    prisma.postImpression.findMany({
      where: { post: { userId }, seenAt: { gte: rangeStart } },
      select: { seenAt: true, userId: true },
    }),
    // Previous period
    prisma.postComment.findMany({
      where: { post: { userId }, createdAt: { gte: prevStart, lt: rangeStart } },
      select: { createdAt: true },
    }),
    prisma.postLike.findMany({
      where: { post: { userId }, createdAt: { gte: prevStart, lt: rangeStart } },
      select: { createdAt: true },
    }),
    prisma.postShareEvent.findMany({
      where: { post: { userId }, createdAt: { gte: prevStart, lt: rangeStart } },
      select: { createdAt: true },
    }),
    prisma.postImpression.findMany({
      where: { post: { userId }, seenAt: { gte: prevStart, lt: rangeStart } },
      select: { seenAt: true },
    }),
  ]);

  const totalComments = commentEvents.length;
  const totalLikes    = likeEvents.length;
  const totalShares   = shareEvents.length;
  const totalViews    = viewEvents.length;

  const prevComments = prevCommentEvents.length;
  const prevLikes    = prevLikeEvents.length;
  const prevViews    = prevViewEvents.length;

  // ── User-type breakdown ───────────────────────────────────────────────────────
  const breakdownIds = Array.from(new Set([
    ...(viewEvents    as any[]).map((e: any) => e.userId).filter(Boolean),
    ...(likeEvents    as any[]).map((e: any) => e.userId).filter(Boolean),
    ...(commentEvents as any[]).map((e: any) => e.userId).filter(Boolean),
  ])) as number[];

  const [breakdownUsers, followerRoles] = await Promise.all([
    breakdownIds.length > 0
      ? prisma.user.findMany({ where: { id: { in: breakdownIds } }, select: { id: true, role: true } })
      : Promise.resolve([] as { id: number; role: string }[]),
    prisma.userFollow.findMany({
      where: { followingId: userId },
      select: { follower: { select: { role: true } } },
    }),
  ]);

  const roleMap = new Map((breakdownUsers as any[]).map((u: any) => [u.id, u.role as string]));
  const isCircleUid = (uid: number) => roleMap.get(uid) === "CIRCLE";

  const viewsCircle    = (viewEvents    as any[]).filter((e: any) => isCircleUid(e.userId)).length;
  const viewsNormal    = (viewEvents    as any[]).filter((e: any) => !isCircleUid(e.userId)).length;
  const likesCircle    = (likeEvents    as any[]).filter((e: any) => isCircleUid(e.userId)).length;
  const likesNormal    = (likeEvents    as any[]).filter((e: any) => !isCircleUid(e.userId)).length;
  const commentsCircle = (commentEvents as any[]).filter((e: any) => isCircleUid(e.userId)).length;
  const commentsNormal = (commentEvents as any[]).filter((e: any) => !isCircleUid(e.userId)).length;

  const followersCircle = (followerRoles as any[]).filter((f: any) => f.follower?.role === "CIRCLE").length;
  const followersNormal = (followerRoles as any[]).filter((f: any) => f.follower?.role !== "CIRCLE").length;

  const circleEngRate = parseFloat(((likesCircle + commentsCircle) / (viewsCircle || 1) * 100).toFixed(1));
  const normalEngRate = parseFloat(((likesNormal + commentsNormal) / (viewsNormal || 1) * 100).toFixed(1));

  // ── Time-series bucketing (anchored to local calendar days) ──────────────────
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Format a UTC timestamp as a local date string
  const fmtLocalDay = (utcMs: number) => {
    const d = new Date(utcMs + tzOffsetMs);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };
  const fmtLocalMonth = (utcMs: number) => {
    const d = new Date(utcMs + tzOffsetMs);
    return `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  };

  let bucketDays: number;   // days per bucket
  let bucketCount: number;
  let fmtBucket: (utcMs: number) => string;

  if (rangeDays <= 30) {
    bucketDays  = 1;
    bucketCount = isAllTime ? 30 : rangeDays;
    fmtBucket   = fmtLocalDay;
  } else if (rangeDays <= 90) {
    bucketDays  = 7;
    bucketCount = Math.ceil(rangeDays / 7);
    fmtBucket   = fmtLocalDay;
  } else {
    bucketDays  = 30;
    bucketCount = Math.ceil(rangeDays / 30);
    fmtBucket   = fmtLocalMonth;
  }
  bucketCount = Math.min(bucketCount, 60);

  // "Today" in user's local time = current local day index
  const todayLocalIdx = localDayIdx(nowMs);

  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    // Each bucket covers exactly `bucketDays` local calendar days
    // +1 so the last bucket (i = bucketCount-1) ends at tomorrow-local-start,
    // meaning it covers ALL of today including evening hours
    const endLocalIdx   = todayLocalIdx + 1 - (bucketCount - 1 - i) * bucketDays;
    const startLocalIdx = endLocalIdx - bucketDays;

    // Convert local day boundaries back to UTC for DB comparisons
    const bucketStartUtc = localDayToUtcMs(startLocalIdx);
    const bucketEndUtc   = localDayToUtcMs(endLocalIdx);

    const bucketStart = new Date(bucketStartUtc);
    const bucketEnd   = new Date(bucketEndUtc);

    // All metrics use real event timestamps — no more post publish date grouping
    const bucketViews    = viewEvents.filter(e => e.seenAt >= bucketStart && e.seenAt < bucketEnd);
    const bucketLikes    = likeEvents.filter(e => e.createdAt >= bucketStart && e.createdAt < bucketEnd);
    const bucketComments = commentEvents.filter(e => e.createdAt >= bucketStart && e.createdAt < bucketEnd);
    const bucketShares   = shareEvents.filter(e => e.createdAt >= bucketStart && e.createdAt < bucketEnd);

    // Convert UTC event timestamps → user's local hour (0–23)
    const toLocalHour = (utcMs: number) =>
      Math.floor(((utcMs + tzOffsetMs) % DAY_MS) / (60 * 60 * 1000));

    return {
      date:         fmtBucket(bucketStartUtc),
      views:        bucketViews.length,
      likes:        bucketLikes.length,
      comments:     bucketComments.length,
      shares:       bucketShares.length,
      viewHours:    bucketViews.map(e => toLocalHour(e.seenAt.getTime())),
      likeHours:    bucketLikes.map(e => toLocalHour(e.createdAt.getTime())),
      commentHours: bucketComments.map(e => toLocalHour(e.createdAt.getTime())),
      shareHours:   bucketShares.map(e => toLocalHour(e.createdAt.getTime())),
    };
  });

  // Sparklines from time series (last 12 buckets, no Math.random)
  const padTo12 = (arr: number[]) =>
    arr.length >= 12 ? arr.slice(-12) : [...Array(12 - arr.length).fill(0), ...arr];

  const sparkViews = padTo12(timeSeries.slice(-12).map(d => d.views));
  const sparkLikes = padTo12(timeSeries.slice(-12).map(d => d.likes));

  // Engagement rate
  const currEngRate = parseFloat(((totalLikes + totalComments) / (totalViews || 1) * 100).toFixed(2));
  const prevEngRate = parseFloat(((prevLikes + prevComments) / (prevViews || 1) * 100).toFixed(2));

  const sparkEng = padTo12(
    timeSeries.slice(-12).map(d =>
      parseFloat(((d.likes + d.comments) / (d.views || 1) * 100).toFixed(1))
    )
  );

  // Follower sparkline: cumulative gain up to each bucket (approximation)
  const sparkFollowers = padTo12(
    timeSeries.slice(-12).map((_, i, arr) => Math.round((currFollowerGain / (arr.length || 1)) * (i + 1)))
  );

  // Stats with real change percentages
  const stats = [
    {
      label: "Total views",
      value: totalViews.toLocaleString(),
      change: calcChange(totalViews, prevViews),
      up: totalViews >= prevViews,
      sparkline: sparkViews,
      breakdown: [
        { label: "Circle", value: viewsCircle },
        { label: "Normal", value: viewsNormal },
        { label: "Guest",  value: 0 },
      ],
    },
    {
      label: "Total likes",
      value: totalLikes.toLocaleString(),
      change: calcChange(totalLikes, prevLikes),
      up: totalLikes >= prevLikes,
      sparkline: sparkLikes,
      breakdown: [
        { label: "Circle", value: likesCircle },
        { label: "Normal", value: likesNormal },
        { label: "Guest",  value: 0 },
      ],
    },
    {
      label: "Followers",
      value: followers.toLocaleString(),
      change: calcChange(currFollowerGain, prevFollowerGain),
      up: currFollowerGain >= prevFollowerGain,
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
      up: currEngRate >= prevEngRate,
      sparkline: sparkEng,
      breakdown: [
        { label: "Circle", value: `${circleEngRate}%` },
        { label: "Normal", value: `${normalEngRate}%` },
      ],
    },
  ];

  // Engagement breakdown (real percentages)
  const engTotal = totalLikes + totalComments + totalShares || 1;
  const likePct = Math.round((totalLikes / engTotal) * 100);
  const commentPct = Math.round((totalComments / engTotal) * 100);
  const sharePct = 100 - likePct - commentPct;

  const engagementBreakdown = [
    { label: "Likes", value: totalLikes, pct: likePct, color: "#F44444" },
    { label: "Comments", value: totalComments, pct: commentPct, color: "#525252" },
    { label: "Shares", value: totalShares, pct: sharePct, color: "#22c55e" },
  ];

  // Follower growth — single query, grouped in memory
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [recentGains] = await Promise.all([
    prisma.userFollow.findMany({
      where: { followingId: userId, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
  ]);

  const followerGrowth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const gained = recentGains.filter(
      f => f.createdAt >= monthStart && f.createdAt <= monthEnd
    ).length;

    return {
      date: MONTHS[d.getMonth()],
      gained,
      lost: 0,
    };
  });

  // Top posts
  const topPosts = posts
    .map(p => ({
      id: p.id,
      title: p.title || "Post",
      type: p.type,
      image: p.image,
      views: parseNum(p.views),
      likes: parseNum(p.likes),
      comments: parseNum(p.comments),
      shares: parseNum(p.shares),
      date: p.createdAt.toISOString(),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Reach metrics
  const avgPerPost = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;
  const reach = {
    totalImpressions: totalViews,
    avgImpressionsPerPost: avgPerPost,
    engagementRate: currEngRate,
    impressionsChange: calcChange(totalViews, prevViews),
    engagementRateChange: calcChange(currEngRate, prevEngRate),
    avgPerPostChange: calcChange(avgPerPost, prevPosts.length > 0 ? Math.round(prevViews / prevPosts.length) : 0),
  };

  // Quick snapshot
  const snapshot = [
    { label: "Total views", value: totalViews.toLocaleString() },
    { label: "Total likes", value: totalLikes.toLocaleString() },
    { label: "Followers", value: followers.toLocaleString() },
    { label: "Following", value: following.toLocaleString() },
    { label: "Posts", value: posts.length.toString() },
    { label: "Story views", value: totalStoryViews.toLocaleString() },
  ];

  return NextResponse.json({
    stats,
    timeSeries,
    topPosts,
    snapshot,
    engagementBreakdown,
    followerGrowth,
    reach,
    // backward-compat: views series as { date, value }
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
