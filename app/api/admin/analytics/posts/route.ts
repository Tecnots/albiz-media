import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scorePost } from "@/app/lib/analytics-scoring";

export async function GET(request: NextRequest) {
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

    const posts = await prisma.post.findMany({
      where: postWhere,
      select: {
        id: true, title: true, type: true, image: true, createdAt: true,
        user: { select: { name: true, handle: true, avatar: true } },
      },
    });

    const postIds = posts.map(p => p.id);
    if (postIds.length === 0) {
      return NextResponse.json({ posts: [], total: 0, page, pages: 0 });
    }

    const [impByPost, likeByPost, commentByPost, shareByPost, signalEvents] = await Promise.all([
      prisma.postImpression.groupBy({ by: ["postId"], where: { postId: { in: postIds }, seenAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postLike.groupBy({ by: ["postId"], where: { postId: { in: postIds }, createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postComment.groupBy({ by: ["postId"], where: { postId: { in: postIds }, createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postShareEvent.groupBy({ by: ["postId"], where: { postId: { in: postIds }, createdAt: { gte: rangeStart } }, _count: { _all: true } }),
      prisma.postEngagement.findMany({
        where: { postId: { in: postIds }, createdAt: { gte: rangeStart }, action: { in: ["dwell", "scroll_past"] } },
        select: { postId: true, action: true, value: true },
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
    for (const e of signalEvents) {
      if (e.action === "dwell") {
        const arr = dwellByPost.get(e.postId) ?? [];
        arr.push(e.value ?? 0);
        dwellByPost.set(e.postId, arr);
      } else if (e.action === "scroll_past") {
        scrollByPost.set(e.postId, (scrollByPost.get(e.postId) ?? 0) + 1);
      }
    }

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const scored = posts.map(p => {
      const imps     = impMap.get(p.id) ?? 0;
      const likes    = likeMap.get(p.id) ?? 0;
      const comments = commentMap.get(p.id) ?? 0;
      const shares   = shareMap.get(p.id) ?? 0;
      const sc       = scorePost({
        impressions: imps, likes, comments, shares,
        dwellValues: dwellByPost.get(p.id) ?? [],
        scrollPast:  scrollByPost.get(p.id) ?? 0,
        followAuthor: 0,
      });
      const d = p.createdAt;
      return {
        id: p.id,
        title: p.title || "Untitled",
        type: String(p.type),
        image: p.image ?? null,
        author: p.user?.name ?? "Unknown",
        authorHandle: p.user?.handle ?? "",
        createdAt: p.createdAt.toISOString(),
        dateLabel: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
        impressions: imps, likes, comments, shares,
        engagementRate: sc.engagementRate,
        avgDwell: sc.avgDwell,
        xScore: sc.xScore,
      };
    });

    const sortFns: Record<string, (a: typeof scored[0], b: typeof scored[0]) => number> = {
      score:       (a, b) => b.xScore - a.xScore,
      impressions: (a, b) => b.impressions - a.impressions,
      likes:       (a, b) => b.likes - a.likes,
      comments:    (a, b) => b.comments - a.comments,
      date:        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    };
    scored.sort(sortFns[sort] ?? sortFns.score);

    const total     = scored.length;
    const pages     = Math.ceil(total / limit);
    const paginated = scored.slice((page - 1) * limit, page * limit);

    return NextResponse.json({ posts: paginated, total, page, pages });
  } catch (err) {
    console.error("[admin/analytics/posts] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
