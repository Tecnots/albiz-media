import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scorePost } from "@/app/lib/analytics-scoring";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

// ?days=7|30|90|all  &tz=<offsetMinutes>
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const daysParam   = searchParams.get("days");
    const isAllTime   = !daysParam || daysParam === "all";
    const days        = isAllTime ? 3650 : parseInt(daysParam!);
    const tzOffsetMin = parseInt(searchParams.get("tz") || "0");
    const DAY_MS      = 24 * 60 * 60 * 1000;
    const nowMs       = Date.now();
    const rangeStart  = new Date(nowMs - days * DAY_MS);
    const prevStart   = new Date(nowMs - 2 * days * DAY_MS);

    const [
      impByPost, likeByPost, commentByPost, shareByPost,
      flaggedCount, totalPosts,
      periodPosts, postsInPrevPeriod,
      circleUsers,
    ] = await Promise.all([
      prisma.postImpression.groupBy({ by: ["postId"], where: { seenAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postLike.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postComment.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postShareEvent.groupBy({ by: ["postId"], where: { createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.post.count({ where: { flagged: true } }),
      prisma.post.count(),
      prisma.post.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: {
          id: true, type: true, tags: true, createdAt: true,
          user: { select: { id: true, name: true, handle: true, avatar: true } },
        },
      }),
      prisma.post.count({ where: { createdAt: { gte: prevStart, lt: rangeStart } } }),
      prisma.user.findMany({
        where:  { role: "CIRCLE" },
        select: { id: true, name: true, handle: true, avatar: true },
      }),
    ]);

    const toMap = (rows: { postId: number; _count: { _all: number } }[]) =>
      new Map(rows.map(r => [r.postId, r._count._all]));
    const impMap     = toMap(impByPost as any);
    const likeMap    = toMap(likeByPost as any);
    const commentMap = toMap(commentByPost as any);
    const shareMap   = toMap(shareByPost as any);

    // Only load signal events for top posts (by impression count) to prevent loading
    // millions of dwell/scroll rows platform-wide across large date ranges.
    const SIGNAL_CAP = 300;
    const topSignalPostIds = [...impMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SIGNAL_CAP)
      .map(([id]) => id);

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

    // ── Platform aggregates ──
    const totalImpressions  = (impByPost as any[]).reduce((s: number, r: any) => s + r._count._all, 0);
    const totalLikes        = (likeByPost as any[]).reduce((s: number, r: any) => s + r._count._all, 0);
    const totalComments     = (commentByPost as any[]).reduce((s: number, r: any) => s + r._count._all, 0);
    const totalShares       = (shareByPost as any[]).reduce((s: number, r: any) => s + r._count._all, 0);
    const totalEngagements  = totalLikes + totalComments + totalShares;
    const avgEngagementRate = totalImpressions > 0
      ? parseFloat(((totalEngagements / totalImpressions) * 100).toFixed(1))
      : 0;

    const dwellEvents = signalEvents.filter((e: { action: string; }) => e.action === "dwell");
    const avgDwell    = dwellEvents.length > 0
      ? Math.round(dwellEvents.reduce((s: any, e: { value: any; }) => s + (e.value ?? 0), 0) / dwellEvents.length)
      : 0;

    const postsInPeriod       = periodPosts.length;
    const postsInPeriodChange = postsInPrevPeriod > 0
      ? Math.round(((postsInPeriod - postsInPrevPeriod) / postsInPrevPeriod) * 100)
      : 0;

    const periodPostIdSet           = new Set(periodPosts.map((p: { id: any; }) => p.id));
    const periodPostsWithImpressions = [...impMap.keys()].filter(id => periodPostIdSet.has(id)).length;
    const postsWithZeroViews         = postsInPeriod - periodPostsWithImpressions;
    const avgViewsPerPost            = (impByPost as any[]).length > 0
      ? Math.round(totalImpressions / (impByPost as any[]).length)
      : 0;

    // ── Fetch metadata for ALL posts viewed in period (used for authors + topPosts) ──
    const allImpPostIds = [...impMap.keys()];
    const allPostMeta   = allImpPostIds.length > 0
      ? await prisma.post.findMany({
          where:  { id: { in: allImpPostIds } },
          select: {
            id: true, title: true, type: true, image: true,
            user: { select: { id: true, name: true, handle: true, avatar: true, role: true } },
          },
        })
      : [];
    const metaMap = new Map<number, any>((allPostMeta as any[]).map(p => [p.id, p]));

    // ── Top authors — from ALL posts viewed in period (not just period posts) ──
    const authorStats = new Map<number, {
      name: string; handle: string; avatar: string | null; role: string;
      posts: number; impressions: number; scores: number[];
    }>();
    for (const p of (allPostMeta as any[])) {
      if (!p.user) continue;
      const uid = (p.user as any).id;
      const ex  = authorStats.get(uid) ?? {
        name:   (p.user as any).name   ?? "",
        handle: (p.user as any).handle ?? "",
        avatar: (p.user as any).avatar ?? null,
        role:   String((p.user as any).role ?? "NORMAL"),
        posts: 0, impressions: 0, scores: [] as number[],
      };
      ex.posts++;
      const imps = impMap.get(p.id) ?? 0;
      ex.impressions += imps;
      const sc = scorePost({
        impressions:  imps,
        likes:        likeMap.get(p.id)    ?? 0,
        comments:     commentMap.get(p.id) ?? 0,
        shares:       shareMap.get(p.id)   ?? 0,
        dwellValues:  dwellByPost.get(p.id)  ?? [],
        scrollPast:   scrollByPost.get(p.id) ?? 0,
        followAuthor: followByPost.get(p.id) ?? 0,
      });
      ex.scores.push(sc.xScore);
      authorStats.set(uid, ex);
    }
    const topAuthors = [...authorStats.values()]
      .filter(a => a.role !== "CIRCLE")
      .map(a => ({
        name: a.name, handle: a.handle, avatar: blobStorageService.resolveMediaUrl(a.avatar), role: a.role,
        posts: a.posts, impressions: a.impressions,
        avgScore: a.scores.length > 0
          ? Math.round(a.scores.reduce((s, v) => s + v, 0) / a.scores.length)
          : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    // ── Tag breakdown (period posts) ──
    const tagCounts = new Map<string, number>();
    for (const p of periodPosts) {
      for (const tag of p.tags ?? []) {
        if (tag) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const tagBreakdown = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));

    // ── Top Circle members — by views on their posts in period (same metric as topAuthors) ──
    const calcAvgScore = (scores: number[]) =>
      scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

    const topCircleMembers = (circleUsers as any[]).map(u => {
      const stats = authorStats.get(u.id);
      return {
        id:          u.id,
        name:        u.name        ?? "",
        handle:      u.handle      ?? "",
        avatar:      blobStorageService.resolveMediaUrl(u.avatar ?? null),
        posts:       stats?.posts       ?? 0,
        impressions: stats?.impressions ?? 0,
        avgScore:    stats ? calcAvgScore(stats.scores) : 0,
      };
    }).sort((a, b) => b.impressions - a.impressions);

    // ── Type breakdown with performance (period posts) ──
    const typePerf = new Map<string, { count: number; impressions: number; engagements: number }>();
    for (const p of periodPosts) {
      const type = String(p.type);
      const ex   = typePerf.get(type) ?? { count: 0, impressions: 0, engagements: 0 };
      ex.count++;
      const imps = impMap.get(p.id) ?? 0;
      ex.impressions  += imps;
      ex.engagements  += (likeMap.get(p.id) ?? 0) + (commentMap.get(p.id) ?? 0) + (shareMap.get(p.id) ?? 0);
      typePerf.set(type, ex);
    }
    const typeBreakdown = [...typePerf.entries()]
      .map(([type, s]) => ({
        type,
        count:       s.count,
        impressions: s.impressions,
        engRate:     s.impressions > 0
          ? parseFloat(((s.engagements / s.impressions) * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Top posts by Albiz score ──
    const ranked = [...impMap.entries()].map(([postId, imps]) => {
      const score = scorePost({
        impressions:  imps,
        likes:        likeMap.get(postId)    ?? 0,
        comments:     commentMap.get(postId) ?? 0,
        shares:       shareMap.get(postId)   ?? 0,
        dwellValues:  dwellByPost.get(postId)  ?? [],
        scrollPast:   scrollByPost.get(postId) ?? 0,
        followAuthor: followByPost.get(postId) ?? 0,
      });
      return { postId, imps, xScore: score.xScore, engagementRate: score.engagementRate, avgDwell: score.avgDwell };
    })
      .filter(p => p.imps > 0)
      .sort((a, b) => b.xScore - a.xScore)
      .slice(0, 20);

    const topPosts = ranked
      .map(r => {
        const m: any = metaMap.get(r.postId);
        return {
          id:             r.postId,
          title:          m?.title || "Untitled",
          type:           String(m?.type ?? "POST"),
          image:          blobStorageService.resolveMediaUrl(m?.image ?? null),
          author:         m?.user?.name ?? "Unknown",
          authorHandle:   m?.user?.handle ?? "",
          authorAvatar:   blobStorageService.resolveMediaUrl(m?.user?.avatar ?? null),
          impressions:    r.imps,
          engagementRate: r.engagementRate,
          avgDwell:       r.avgDwell,
          xScore:         r.xScore,
        };
      })
      .filter(p => metaMap.has(p.id));

    // ── Publish volume chart ──
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const localDayKey = (d: Date) => {
      const local = new Date(d.getTime() + tzOffsetMin * 60 * 1000);
      return `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
    };
    const volByDay = new Map<string, number>();
    for (const r of periodPosts) {
      const k = localDayKey(r.createdAt);
      volByDay.set(k, (volByDay.get(k) ?? 0) + 1);
    }
    const bucketCount   = Math.min(days, 30);
    const publishVolume = Array.from({ length: bucketCount }, (_, i) => {
      const utc   = new Date(nowMs - (bucketCount - 1 - i) * DAY_MS);
      const local = new Date(utc.getTime() + tzOffsetMin * 60 * 1000);
      const k     = `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
      return { date: `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`, count: volByDay.get(k) ?? 0 };
    });

    return NextResponse.json({
      totalPosts,
      postsInPeriod,
      postsInPeriodChange,
      postsWithZeroViews,
      avgViewsPerPost,
      totalImpressions,
      totalLikes,
      totalComments,
      totalShares,
      avgEngagementRate,
      avgDwell,
      flaggedCount,
      flaggedRate: totalPosts > 0 ? parseFloat(((flaggedCount / totalPosts) * 100).toFixed(1)) : 0,
      typeBreakdown,
      tagBreakdown,
      topAuthors,
      topCircleMembers,
      totalCircleMembers: circleUsers.length,
      publishVolume,
      topPosts,
    });
  } catch (err) {
    console.error("[admin/analytics/content] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
