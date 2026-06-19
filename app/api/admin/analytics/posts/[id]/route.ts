import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scorePost } from "@/app/lib/analytics-scoring";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });

    const tzOffsetMin = parseInt(new URL(request.url).searchParams.get("tz") ?? "0");

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true, title: true, type: true, image: true, description: true,
        createdAt: true, status: true, flagged: true, flagReason: true, tags: true,
        user:    { select: { name: true, handle: true, avatar: true, role: true } },
        section: { select: { name: true } },
      },
    });

    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const [impressions, likes, comments, shares, signalEvents] = await Promise.all([
      prisma.postImpression.count({ where: { postId } }),
      prisma.postLike.count({ where: { postId } }),
      prisma.postComment.count({ where: { postId } }),
      prisma.postShareEvent.count({ where: { postId } }),
      prisma.postEngagement.findMany({
        where: { postId, action: { in: ["dwell", "scroll_past", "follow_author"] } },
        select: { action: true, value: true, createdAt: true },
      }),
    ]);

    const dwellValues  = signalEvents.filter(e => e.action === "dwell").map(e => e.value ?? 0);
    const scrollPast   = signalEvents.filter(e => e.action === "scroll_past").length;
    const followAuthor = signalEvents.filter(e => e.action === "follow_author").length;

    const score = scorePost({ impressions, likes, comments, shares, dwellValues, scrollPast, followAuthor });

    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const impressionRows = await prisma.postImpression.findMany({
      where: { postId, seenAt: { gte: sinceDate } },
      select: { seenAt: true },
    });

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dayMap = new Map<string, number>();
    for (const r of impressionRows) {
      const local = new Date(r.seenAt.getTime() + tzOffsetMin * 60 * 1000);
      const k = `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
      dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
    }
    const timeSeries = Array.from({ length: 30 }, (_, i) => {
      const utc   = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
      const local = new Date(utc.getTime() + tzOffsetMin * 60 * 1000);
      const k     = `${local.getUTCFullYear()}-${local.getUTCMonth()}-${local.getUTCDate()}`;
      return { date: `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`, impressions: dayMap.get(k) ?? 0 };
    });

    const dwellDistribution = [
      { label: "< 5s",   count: dwellValues.filter(v => v < 5).length },
      { label: "5–15s",  count: dwellValues.filter(v => v >= 5  && v < 15).length },
      { label: "15–30s", count: dwellValues.filter(v => v >= 15 && v < 30).length },
      { label: "30–60s", count: dwellValues.filter(v => v >= 30 && v < 60).length },
      { label: "60s+",   count: dwellValues.filter(v => v >= 60).length },
    ];

    const d = post.createdAt;
    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title || "Untitled",
        type: String(post.type),
        image: post.image ?? null,
        description: post.description ?? null,
        createdAt: post.createdAt.toISOString(),
        dateLabel: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
        status: post.status,
        flagged: post.flagged,
        flagReason: post.flagReason ?? null,
        tags: post.tags ?? [],
        author: post.user?.name ?? "Unknown",
        authorHandle: post.user?.handle ?? "",
        authorAvatar: post.user?.avatar ?? null,
        authorRole: String(post.user?.role ?? "NORMAL"),
        section: post.section?.name ?? null,
      },
      stats: {
        impressions, likes, comments, shares,
        avgDwell: score.avgDwell,
        engagementRate: score.engagementRate,
        xScore: score.xScore,
        scrollPast, followAuthor,
      },
      timeSeries,
      dwellDistribution,
    });
  } catch (err) {
    console.error("[admin/analytics/posts/[id]] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
