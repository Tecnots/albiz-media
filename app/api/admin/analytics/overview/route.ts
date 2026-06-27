import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcChange } from "@/app/lib/analytics-scoring";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// Row type returned by the day-bucket SQL queries
interface DayRow { y: number; m: number; d: number; cnt: bigint }

// Convert SQL day-bucket rows to a Map<key, count>.
// SQL EXTRACT(MONTH) is 1-indexed; JS getUTCMonth() is 0-indexed — we subtract 1 to match.
function dayRowsToMap(rows: DayRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.y}-${r.m - 1}-${r.d}`;
    map.set(k, (map.get(k) ?? 0) + Number(r.cnt));
  }
  return map;
}

// ?days=7|30|90|all  &tz=<offsetMinutes>
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    // ── Phase 2: aggregated day-buckets via SQL (replaces 12 findMany calls) ────
    // Each query returns at most ~90 rows (one per day) instead of millions of raw events.
    const [
      impDayRows, signDayRows, engDayRows, postDayRows,
      prevImpDayRows, prevSignDayRows, prevEngDayRows, prevPostDayRows,
      topPostsRaw,
      rawActivity,
      roleTotalRows, roleNewRows, roleActiveRows,
    ] = await Promise.all([
      // Current period ─────────────────────────────────────────────────────────
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM "seenAt"  + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM "seenAt"  + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM "seenAt"  + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM "PostImpression" WHERE "seenAt" >= ${rangeStart}
        GROUP BY 1, 2, 3`,
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM "emailVerified" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM "emailVerified" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM "emailVerified" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM "User" WHERE "emailVerified" >= ${rangeStart}
        GROUP BY 1, 2, 3`,
      // Likes + comments + shares combined into one engagement series
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM (
          SELECT "createdAt" AS ts FROM "PostLike"       WHERE "createdAt" >= ${rangeStart}
          UNION ALL
          SELECT "createdAt"       FROM "PostComment"    WHERE "createdAt" >= ${rangeStart}
          UNION ALL
          SELECT "createdAt"       FROM "PostShareEvent" WHERE "createdAt" >= ${rangeStart}
        ) eng GROUP BY 1, 2, 3`,
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM "createdAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM "createdAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM "createdAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM "Post" WHERE "createdAt" >= ${rangeStart}
        GROUP BY 1, 2, 3`,
      // Previous period ────────────────────────────────────────────────────────
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM "seenAt"  + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM "seenAt"  + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM "seenAt"  + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM "PostImpression" WHERE "seenAt" >= ${prevStart} AND "seenAt" < ${rangeStart}
        GROUP BY 1, 2, 3`,
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM "emailVerified" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM "emailVerified" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM "emailVerified" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM "User" WHERE "emailVerified" >= ${prevStart} AND "emailVerified" < ${rangeStart}
        GROUP BY 1, 2, 3`,
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM ts + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM (
          SELECT "createdAt" AS ts FROM "PostLike"       WHERE "createdAt" >= ${prevStart} AND "createdAt" < ${rangeStart}
          UNION ALL
          SELECT "createdAt"       FROM "PostComment"    WHERE "createdAt" >= ${prevStart} AND "createdAt" < ${rangeStart}
          UNION ALL
          SELECT "createdAt"       FROM "PostShareEvent" WHERE "createdAt" >= ${prevStart} AND "createdAt" < ${rangeStart}
        ) eng GROUP BY 1, 2, 3`,
      prisma.$queryRaw<DayRow[]>`
        SELECT EXTRACT(YEAR  FROM "createdAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS y,
               EXTRACT(MONTH FROM "createdAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS m,
               EXTRACT(DAY   FROM "createdAt" + (${tzOffsetMin} * INTERVAL '1 minute'))::int AS d,
               COUNT(*)::bigint AS cnt
        FROM "Post" WHERE "createdAt" >= ${prevStart} AND "createdAt" < ${rangeStart}
        GROUP BY 1, 2, 3`,
      // Top 3 posts by impression count in period (replaces JS iteration of raw impRows)
      prisma.$queryRaw<{ postId: number; cnt: bigint }[]>`
        SELECT "postId", COUNT(*)::bigint AS cnt
        FROM "PostImpression" WHERE "seenAt" >= ${rangeStart}
        GROUP BY "postId" ORDER BY cnt DESC LIMIT 3`,
      // Activity feed
      (prisma as any).activityLog
        .findMany({ take: 15, orderBy: { createdAt: "desc" } })
        .catch(() => []),
      // Role breakdown
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], where: { emailVerified: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["role"], where: { lastSeenAt: { gte: d7Ago } }, _count: { _all: true } }),
    ]);

    // ── Phase 3: top post metadata ─────────────────────────────────────────────
    const topPostEntries = (topPostsRaw as { postId: number; cnt: bigint }[])
      .map(r => [r.postId, Number(r.cnt)] as [number, number]);

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

    // ── Build time-series from aggregated SQL maps ─────────────────────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const impDayMap      = dayRowsToMap(impDayRows);
    const signDayMap     = dayRowsToMap(signDayRows);
    const engDayMap      = dayRowsToMap(engDayRows);
    const postDayMap     = dayRowsToMap(postDayRows);
    const prevImpDayMap  = dayRowsToMap(prevImpDayRows);
    const prevSignDayMap = dayRowsToMap(prevSignDayRows);
    const prevEngDayMap  = dayRowsToMap(prevEngDayRows);
    const prevPostDayMap = dayRowsToMap(prevPostDayRows);

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
