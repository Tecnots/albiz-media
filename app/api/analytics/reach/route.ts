import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { scorePost, calcChange } from "@/app/lib/analytics-scoring";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = authUser.id;
  const { searchParams } = new URL(request.url);

  const daysParam    = searchParams.get("days");
  const days         = daysParam && daysParam !== "all" ? parseInt(daysParam) : 30;
  const tzOffsetMin  = parseInt(searchParams.get("tz") || "0");
  const tzOffsetMs   = tzOffsetMin * 60 * 1000;
  const isAllTime    = !daysParam || daysParam === "all";

  const DAY_MS     = 24 * 60 * 60 * 1000;
  const nowMs      = Date.now();
  const rangeStart = new Date(nowMs - (isAllTime ? nowMs : days * DAY_MS));
  const prevStart  = new Date(rangeStart.getTime() - (isAllTime ? 0 : days * DAY_MS));

  // ── Raw event queries (parallel) ─────────────────────────────────────────────
  const [impressions, prevImpressions, engagements, allFollowers, posts] = await Promise.all([
    prisma.postImpression.findMany({
      where: { post: { userId }, seenAt: { gte: rangeStart } },
      select: { userId: true, postId: true, seenAt: true, position: true },
    }),
    prisma.postImpression.findMany({
      where: { post: { userId }, seenAt: { gte: prevStart, lt: rangeStart } },
      select: { seenAt: true },
    }),
    prisma.postEngagement.findMany({
      where: { post: { userId }, createdAt: { gte: rangeStart } },
      select: { action: true, value: true, createdAt: true, postId: true },
    }),
    prisma.userFollow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }),
    prisma.post.findMany({
      where: { userId },
      select: { id: true, title: true, type: true, image: true },
    }),
  ]);

  const followerIds = new Set(allFollowers.map(f => f.followerId));
  const totalFollowers = followerIds.size;

  // ── Summary ───────────────────────────────────────────────────────────────────
  const totalImpressions  = impressions.length;
  const prevTotalImp      = prevImpressions.length;
  const uniqueAccounts    = new Set(impressions.map(i => i.userId)).size;
  const uniquePosts       = new Set(impressions.map(i => i.postId)).size;
  const avgPerPost = uniquePosts > 0 ? Math.round(totalImpressions / uniquePosts) : 0;
  // Cap reach rate at 100% — exceeding it means viral spread beyond followers (shown separately)
  const reachRate = totalFollowers > 0
    ? Math.min(parseFloat(((uniqueAccounts / totalFollowers) * 100).toFixed(1)), 100)
    : 0;
  const viralMultiplier = totalFollowers > 0 && uniqueAccounts > totalFollowers
    ? parseFloat((uniqueAccounts / totalFollowers).toFixed(1))
    : null;

  // ── Distribution ─────────────────────────────────────────────────────────────
  const followerImpressions    = impressions.filter(i => followerIds.has(i.userId)).length;
  const nonFollowerImpressions = totalImpressions - followerImpressions;
  const followerReachPct       = totalImpressions > 0
    ? Math.round((followerImpressions / totalImpressions) * 100)
    : 0;
  const nonFollowerReachPct    = 100 - followerReachPct;

  const positionsWithData = impressions.filter(i => i.position !== null);
  const avgPosition = positionsWithData.length > 0
    ? parseFloat((positionsWithData.reduce((s, i) => s + (i.position ?? 0), 0) / positionsWithData.length).toFixed(1))
    : null;

  // ── Quality signals ───────────────────────────────────────────────────────────
  const dwellEvents      = engagements.filter(e => e.action === "dwell");
  const scrollPastEvents = engagements.filter(e => e.action === "scroll_past");
  const followEvents     = engagements.filter(e => e.action === "follow_author");

  const avgDwellSeconds = dwellEvents.length > 0
    ? parseFloat((dwellEvents.reduce((s, e) => s + (e.value ?? 0), 0) / dwellEvents.length).toFixed(1))
    : 0;

  const scrollPastRate = totalImpressions > 0
    ? parseFloat(((scrollPastEvents.length / totalImpressions) * 100).toFixed(1))
    : 0;

  const followThroughRate = totalImpressions > 0
    ? parseFloat(((followEvents.length / totalImpressions) * 100).toFixed(1))
    : 0;

  // Engagement events (distinct from impression-based)
  const [likeEvents, commentEvents, shareEvents] = await Promise.all([
    prisma.postLike.findMany({ where: { post: { userId }, createdAt: { gte: rangeStart } }, select: { postId: true } }),
    prisma.postComment.findMany({ where: { post: { userId }, createdAt: { gte: rangeStart } }, select: { postId: true } }),
    prisma.postShareEvent.findMany({ where: { post: { userId }, createdAt: { gte: rangeStart } }, select: { postId: true } }),
  ]);

  const totalEngagements = likeEvents.length + commentEvents.length + shareEvents.length;
  const engagementRate   = totalImpressions > 0
    ? parseFloat(((totalEngagements / totalImpressions) * 100).toFixed(1))
    : 0;

  // ── Albiz score per post ─────────────────────────────────────────────────────
  const postScores = posts.map(p => {
    const postImps     = impressions.filter(i => i.postId === p.id).length;
    const postLikes    = likeEvents.filter(e => e.postId === p.id).length;
    const postComments = commentEvents.filter(e => e.postId === p.id).length;
    const postShares   = shareEvents.filter(e => e.postId === p.id).length;
    const postDwell    = engagements.filter(e => e.postId === p.id && e.action === "dwell");
    const postScroll   = engagements.filter(e => e.postId === p.id && e.action === "scroll_past").length;
    const postFollow   = engagements.filter(e => e.postId === p.id && e.action === "follow_author").length;

    const score = scorePost({
      impressions:  postImps,
      likes:        postLikes,
      comments:     postComments,
      shares:       postShares,
      dwellValues:  postDwell.map(e => e.value ?? 0),
      scrollPast:   postScroll,
      followAuthor: postFollow,
    });

    return {
      id:             p.id,
      title:          p.title || "Post",
      type:           p.type,
      image:          p.image,
      impressions:    postImps,
      likes:          postLikes,
      comments:       postComments,
      shares:         postShares,
      avgDwell:       score.avgDwell,
      scrollPastRate: score.scrollPastRate,
      followThrough:  score.followThrough,
      xScore:         score.xScore,
    };
  })
    .filter(p => p.impressions > 0)
    .sort((a, b) => b.xScore - a.xScore);

  // ── Feed position distribution ────────────────────────────────────────────────
  const withPos = impressions.filter(i => i.position !== null);
  const positionBuckets = [
    { label: "1–3",  range: [1, 3]   },
    { label: "4–6",  range: [4, 6]   },
    { label: "7–10", range: [7, 10]  },
    { label: "10+",  range: [11, 999] },
  ].map(b => ({
    label: b.label,
    count: withPos.filter(i => (i.position ?? 0) >= b.range[0] && (i.position ?? 0) <= b.range[1]).length,
  }));

  // ── Impressions time series (local calendar day buckets) ──────────────────────
  const MONTHS     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const localDayIdx    = (utcMs: number) => Math.floor((utcMs + tzOffsetMs) / DAY_MS);
  const localDayToUtcMs = (idx: number) => idx * DAY_MS - tzOffsetMs;
  const todayLocalIdx  = localDayIdx(nowMs);
  const bucketCount    = Math.min(days, 30);

  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    const endIdx   = todayLocalIdx + 1 - (bucketCount - 1 - i);
    const startIdx = endIdx - 1;
    const bs       = new Date(localDayToUtcMs(startIdx));
    const be       = new Date(localDayToUtcMs(endIdx));
    const ld       = new Date(localDayToUtcMs(startIdx) + tzOffsetMs);
    return {
      date:        `${MONTHS[ld.getUTCMonth()]} ${ld.getUTCDate()}`,
      impressions: impressions.filter(e => e.seenAt >= bs && e.seenAt < be).length,
    };
  });

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
      positionsTracked: positionsWithData.length,
    },
    qualitySignals: {
      avgDwellSeconds,
      scrollPastRate,
      followThroughRate,
      engagementRate,
      dwellEvents:      dwellEvents.length,
      scrollPastEvents: scrollPastEvents.length,
      followEvents:     followEvents.length,
    },
    timeSeries,
    postScores,
    positionBuckets,
  });
}
