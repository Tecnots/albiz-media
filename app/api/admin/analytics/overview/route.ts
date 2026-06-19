import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcChange } from "@/app/lib/analytics-scoring";

// Platform-wide KPI overview. No auth check — admin layout guards the UI.
// ?days=7|30|90|all  &tz=<offsetMinutes>
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam   = searchParams.get("days");
    const days = (!daysParam || daysParam === "all") ? 365 : parseInt(daysParam!);
    const tzOffsetMin = parseInt(searchParams.get("tz") || "0");

    const DAY_MS     = 24 * 60 * 60 * 1000;
    const nowMs      = Date.now();
    const rangeStart = new Date(nowMs - days * DAY_MS);
    const prevStart  = new Date(nowMs - days * 2 * DAY_MS);
    const h24Ago     = new Date(nowMs - DAY_MS);
    const h1Ago      = new Date(nowMs - 60 * 60 * 1000);
    const d7Ago      = new Date(nowMs - 7 * DAY_MS);

    // ── Phase 1: scalar counts via transaction ──────────────────────────────────
    const [
      totalUsers, totalPosts,
      activeUsers24h, activeUsers7d, circleMembers,
      newSignups, prevNewSignups, signupsLastHour,
      newPosts, prevNewPosts,
      impressions, prevImpressions,
      likes, comments, shares,
      prevLikes, prevComments, prevShares,
      followThroughCount,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.post.count(),
      prisma.user.count({ where: { lastSeenAt: { gte: h24Ago } } }),
      prisma.user.count({ where: { lastSeenAt: { gte: d7Ago } } }),
      prisma.user.count({ where: { role: "CIRCLE" } }),
      prisma.user.count({ where: { emailVerified: { gte: rangeStart } } }),
      prisma.user.count({ where: { emailVerified: { gte: prevStart, lt: rangeStart } } }),
      prisma.user.count({ where: { emailVerified: { gte: h1Ago } } }),
      prisma.post.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.post.count({ where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postImpression.count({ where: { seenAt: { gte: rangeStart } } }),
      prisma.postImpression.count({ where: { seenAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postLike.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.postComment.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.postShareEvent.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.postLike.count({ where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postComment.count({ where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postShareEvent.count({ where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.postEngagement.count({ where: { action: "follow_author", createdAt: { gte: rangeStart } } }),
    ]);

    const totalEngagements     = likes + comments + shares;
    const prevTotalEngagements = prevLikes + prevComments + prevShares;
    const engagementRate       = impressions > 0
      ? parseFloat(((totalEngagements / impressions) * 100).toFixed(1)) : 0;

    // ── Phase 2: row-level data for day-buckets (pure Prisma ORM, no raw SQL) ──
    // Select only the minimal fields needed so fetches are fast.
    const [
      impRows, signupDates, likeRows, commentRows, shareRows, postDates,
      prevImpRows, prevSignupDates, prevLikeRows, prevCommentRows, prevShareRows, prevPostDates,
      rawActivity,
      roleTotalRows, roleNewRows, roleActiveRows,
    ] = await Promise.all([
      // current period
      prisma.postImpression.findMany({ where: { seenAt: { gte: rangeStart } },              select: { seenAt: true, postId: true } }),
      prisma.user.findMany({           where: { emailVerified: { gte: rangeStart } },        select: { emailVerified: true } }),
      prisma.postLike.findMany({        where: { createdAt: { gte: rangeStart } },           select: { createdAt: true } }),
      prisma.postComment.findMany({     where: { createdAt: { gte: rangeStart } },           select: { createdAt: true } }),
      prisma.postShareEvent.findMany({  where: { createdAt: { gte: rangeStart } },           select: { createdAt: true } }),
      prisma.post.findMany({            where: { createdAt: { gte: rangeStart } },           select: { createdAt: true } }),
      // previous period
      prisma.postImpression.findMany({ where: { seenAt: { gte: prevStart, lt: rangeStart } },             select: { seenAt: true } }),
      prisma.user.findMany({           where: { emailVerified: { gte: prevStart, lt: rangeStart } },      select: { emailVerified: true } }),
      prisma.postLike.findMany({        where: { createdAt: { gte: prevStart, lt: rangeStart } },         select: { createdAt: true } }),
      prisma.postComment.findMany({     where: { createdAt: { gte: prevStart, lt: rangeStart } },         select: { createdAt: true } }),
      prisma.postShareEvent.findMany({  where: { createdAt: { gte: prevStart, lt: rangeStart } },         select: { createdAt: true } }),
      prisma.post.findMany({            where: { createdAt: { gte: prevStart, lt: rangeStart } },         select: { createdAt: true } }),
      // activity feed
      (prisma as any).activityLog
        .findMany({ take: 15, orderBy: { createdAt: "desc" } })
        .catch(() => []),
      // role breakdown
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], where: { emailVerified: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], where: { lastSeenAt: { gte: d7Ago } }, _count: { _all: true } }),
    ]);

    // ── Phase 3: top post metadata ─────────────────────────────────────────────
    // Count impressions per post, pick top 3, then fetch their metadata.
    const postImpCount = new Map<number, number>();
    for (const r of impRows) {
      postImpCount.set(r.postId, (postImpCount.get(r.postId) ?? 0) + 1);
    }
    const topPostEntries = [...postImpCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const topPostsMeta = topPostEntries.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: topPostEntries.map(([id]) => id) } },
          select: {
            id: true, title: true, image: true, type: true,
            user: { select: { name: true, handle: true, avatar: true } },
          },
        })
      : [];
    const metaById = new Map(topPostsMeta.map(p => [p.id, p]));

    const topPosts = topPostEntries.map(([postId, count]) => {
      const m = metaById.get(postId);
      return {
        id:           postId,
        title:        m?.title         ?? "Untitled",
        image:        m?.image         ?? null,
        type:         m?.type          ?? "POST",
        authorName:   m?.user?.name    ?? "Unknown",
        authorHandle: m?.user?.handle  ?? "",
        authorAvatar: m?.user?.avatar  ?? null,
        impressions:  count,
      };
    });

    // ── Build time-series buckets (JS grouping, no raw SQL) ────────────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // UTC day key for a stored timestamp. We apply the tz offset to shift the
    // stored UTC time into local time, then read the UTC fields as if they were local.
    const utcDayKey = (date: Date): string => {
      const local = new Date(date.getTime() + tzOffsetMin * 60 * 1000);
      return `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
    };

    const makeMap = (dates: Date[]): Map<string, number> => {
      const m = new Map<string, number>();
      for (const d of dates) {
        const k = utcDayKey(d);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    };

    const impDayMap  = makeMap(impRows.map(r => r.seenAt));
    const signDayMap = makeMap(signupDates.filter(r => r.emailVerified).map(r => r.emailVerified!));
    const engDayMap  = makeMap([
      ...likeRows.map(r => r.createdAt),
      ...commentRows.map(r => r.createdAt),
      ...shareRows.map(r => r.createdAt),
    ]);
    const postDayMap = makeMap(postDates.map(r => r.createdAt));

    const prevImpDayMap  = makeMap(prevImpRows.map(r => r.seenAt));
    const prevSignDayMap = makeMap(prevSignupDates.filter(r => r.emailVerified).map(r => r.emailVerified!));
    const prevEngDayMap  = makeMap([
      ...prevLikeRows.map(r => r.createdAt),
      ...prevCommentRows.map(r => r.createdAt),
      ...prevShareRows.map(r => r.createdAt),
    ]);
    const prevPostDayMap = makeMap(prevPostDates.map(r => r.createdAt));

    const bucketCount = Math.min(days, 90);

    const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
      // Build the UTC date for this bucket, then shift to local for key + label.
      const utc   = new Date(nowMs - (bucketCount - 1 - i) * DAY_MS);
      const local = new Date(utc.getTime() + tzOffsetMin * 60 * 1000);
      const k     = `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
      return {
        date:        `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`,
        impressions: impDayMap.get(k)  ?? 0,
        signups:     signDayMap.get(k) ?? 0,
        engagements: engDayMap.get(k)  ?? 0,
        posts:       postDayMap.get(k) ?? 0,
      };
    });

    const prevTimeSeries = Array.from({ length: bucketCount }, (_, i) => {
      const utc   = new Date(prevStart.getTime() + i * DAY_MS);
      const local = new Date(utc.getTime() + tzOffsetMin * 60 * 1000);
      const k     = `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
      return {
        impressions: prevImpDayMap.get(k)  ?? 0,
        signups:     prevSignDayMap.get(k) ?? 0,
        engagements: prevEngDayMap.get(k)  ?? 0,
        posts:       prevPostDayMap.get(k) ?? 0,
      };
    });

    // ── Format activity feed ───────────────────────────────────────────────────
    const recentActivity = (rawActivity as any[]).map((e: any) => ({
      id:        e.id,
      eventType: e.eventType,
      userName:  e.userName  ?? "Unknown",
      handle:    e.handle    ?? "",
      avatar:    e.avatar    ?? null,
      meta:      e.meta      ?? null,
      createdAt: (e.createdAt as Date).toISOString(),
    }));

    // ── Role breakdown ─────────────────────────────────────────────────────────
    const roleTotalMap  = new Map((roleTotalRows  as any[]).map((r: any) => [String(r.role), r._count._all as number]));
    const roleNewMap    = new Map((roleNewRows    as any[]).map((r: any) => [String(r.role), r._count._all as number]));
    const roleActiveMap = new Map((roleActiveRows as any[]).map((r: any) => [String(r.role), r._count._all as number]));

    const ROLE_ORDER = ["NORMAL", "CIRCLE", "AUTHOR", "EDITOR", "ADMIN"] as const;
    const roleBreakdown = ROLE_ORDER.map(role => ({
      role,
      total:       roleTotalMap.get(role)  ?? 0,
      newInPeriod: roleNewMap.get(role)    ?? 0,
      active7d:    roleActiveMap.get(role) ?? 0,
    }));

    return NextResponse.json({
      stats: {
        totalUsers, totalPosts,
        activeUsers24h, activeUsers7d, circleMembers,
        newSignups,      newSignupsChange:      calcChange(newSignups, prevNewSignups),
        signupsLastHour,
        newPosts,        newPostsChange:        calcChange(newPosts, prevNewPosts),
        impressions,     impressionsChange:     calcChange(impressions, prevImpressions),
        totalEngagements, engagementsChange:    calcChange(totalEngagements, prevTotalEngagements),
        engagementRate,
      },
      funnel: {
        impressions,
        engaged:  totalEngagements,
        followed: followThroughCount,
      },
      timeSeries,
      prevTimeSeries,
      topPosts,
      recentActivity,
      roleBreakdown,
    });
  } catch (err) {
    console.error("[admin/analytics/overview]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
