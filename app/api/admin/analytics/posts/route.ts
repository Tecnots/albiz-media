import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scorePost } from "@/app/lib/analytics-scoring";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const daysParam   = searchParams.get("days");
    const isAllTime   = !daysParam || daysParam === "all";
    const days        = isAllTime ? 3650 : parseInt(daysParam!);
    const search      = searchParams.get("search") ?? "";
    const sort        = searchParams.get("sort") ?? "score";
    const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit       = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10")));
    const DAY_MS      = 24 * 60 * 60 * 1000;
    const nowMs       = Date.now();
    const rangeStart  = new Date(nowMs - days * DAY_MS);

    const postWhere: any = { createdAt: { gte: rangeStart } };
    if (search) {
      postWhere.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { user: { handle: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const selectShape = {
      id: true, title: true, type: true, image: true, createdAt: true,
      user: { select: { name: true, handle: true, avatar: true } },
    } as const;

    const fetchStats = async (ids: number[]) => {
      const toMap = (rows: { postId: number; _count: { _all: number } }[]) =>
        new Map(rows.map(r => [r.postId, r._count._all]));
      const [impByPost, likeByPost, commentByPost, shareByPost, signalEvents] = await Promise.all([
        prisma.postImpression.groupBy({ by: ["postId"], where: { postId: { in: ids }, seenAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postLike.groupBy({ by: ["postId"], where: { postId: { in: ids }, createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postComment.groupBy({ by: ["postId"], where: { postId: { in: ids }, createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postShareEvent.groupBy({ by: ["postId"], where: { postId: { in: ids }, createdAt: { gte: rangeStart } }, _count: { _all: true } }),
        prisma.postEngagement.findMany({
          where: { postId: { in: ids }, createdAt: { gte: rangeStart }, action: { in: ["dwell", "scroll_past"] } },
          select: { postId: true, action: true, value: true },
        }),
      ]);
      const dwellByPost  = new Map<number, number[]>();
      const scrollByPost = new Map<number, number>();
      for (const e of signalEvents) {
        if (e.action === "dwell") {
          const arr = dwellByPost.get(e.postId) ?? [];
          arr.push(e.value ?? 0);
          dwellByPost.set(e.postId, arr);
        } else if (e.action === "scroll_past") {
          scrollByPost.set(e.postId, (scrollByPost.get(e.postId) ?? 0) + 1);
        }
      }
      return {
        impMap:     toMap(impByPost as any),
        likeMap:    toMap(likeByPost as any),
        commentMap: toMap(commentByPost as any),
        shareMap:   toMap(shareByPost as any),
        dwellByPost,
        scrollByPost,
      };
    };

    type Stats = Awaited<ReturnType<typeof fetchStats>>;
    const buildRow = (p: any, stats: Stats) => {
      const imps     = stats.impMap.get(p.id) ?? 0;
      const likes    = stats.likeMap.get(p.id) ?? 0;
      const comments = stats.commentMap.get(p.id) ?? 0;
      const shares   = stats.shareMap.get(p.id) ?? 0;
      const sc       = scorePost({
        impressions: imps, likes, comments, shares,
        dwellValues: stats.dwellByPost.get(p.id) ?? [],
        scrollPast:  stats.scrollByPost.get(p.id) ?? 0,
        followAuthor: 0,
      });
      const d = p.createdAt as Date;
      return {
        id: p.id,
        title: p.title || "Untitled",
        type: String(p.type),
        image: p.image ?? null,
        author: p.user?.name ?? "Unknown",
        authorHandle: p.user?.handle ?? "",
        createdAt: (p.createdAt as Date).toISOString(),
        dateLabel: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
        impressions: imps, likes, comments, shares,
        engagementRate: sc.engagementRate,
        avgDwell: sc.avgDwell,
        xScore: sc.xScore,
      };
    };

    // ── Date sort: true DB-level pagination — only loads one page of posts ──────
    if (sort === "date") {
      const [total, pagePosts] = await Promise.all([
        prisma.post.count({ where: postWhere }),
        prisma.post.findMany({
          where:   postWhere,
          orderBy: { createdAt: "desc" },
          skip:    (page - 1) * limit,
          take:    limit,
          select:  selectShape,
        }),
      ]);
      if (total === 0) return NextResponse.json({ posts: [], total: 0, page, pages: 0 });
      const stats = await fetchStats(pagePosts.map(p => p.id));
      return NextResponse.json({
        posts: pagePosts.map(p => buildRow(p, stats)),
        total, page, pages: Math.ceil(total / limit),
      });
    }

    // ── Score/engagement sorts ─────────────────────────────────────────────────
    // With search: bounded by query. Without search: cap candidates to prevent full scan.
    const CANDIDATE_CAP = 500;
    const [total, candidatePosts] = await Promise.all([
      prisma.post.count({ where: postWhere }),
      prisma.post.findMany({
        where:   postWhere,
        orderBy: { createdAt: "desc" },
        take:    search ? undefined : CANDIDATE_CAP,
        select:  selectShape,
      }),
    ]);

    if (total === 0) return NextResponse.json({ posts: [], total: 0, page, pages: 0 });

    const stats  = await fetchStats(candidatePosts.map(p => p.id));
    const scored = candidatePosts.map(p => buildRow(p, stats));

    const sortFns: Record<string, (a: typeof scored[0], b: typeof scored[0]) => number> = {
      score:       (a, b) => b.xScore - a.xScore,
      impressions: (a, b) => b.impressions - a.impressions,
      likes:       (a, b) => b.likes - a.likes,
      comments:    (a, b) => b.comments - a.comments,
    };
    scored.sort(sortFns[sort] ?? sortFns.score);

    const pages     = Math.ceil(total / limit);
    const paginated = scored.slice((page - 1) * limit, page * limit);

    return NextResponse.json({ posts: paginated, total, page, pages });
  } catch (err) {
    console.error("[admin/analytics/posts] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}