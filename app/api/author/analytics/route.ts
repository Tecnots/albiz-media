import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

function periodStart(period: string): Date | null {
  const now = Date.now();
  const map: Record<string, number> = {
    "1d":   1,
    "7d":   7,
    "30d":  30,
    "90d":  90,
    "365d": 365,
  };
  const days = map[period];
  if (!days) return null; // "all"
  return new Date(now - days * 86_400_000);
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function filledDaySeries(rangeStart: Date | null, days: number) {
  const count = rangeStart ? Math.min(days, 90) : 90;
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (count - 1 - i));
    return dayLabel(d);
  });
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== "AUTHOR" && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") ?? "30d";
  const rangeStart = periodStart(period);
  const days = period === "1d" ? 1 : period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;

  const whereBase = {
    userId: authUser.id,
    ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
  };

  // All-time counts for KPIs
  const [allPosts, periodPosts] = await Promise.all([
    prisma.post.findMany({
      where: { userId: authUser.id },
      select: { id: true, status: true, views: true, likes: true, comments: true, createdAt: true },
    }),
    prisma.post.findMany({
      where: whereBase,
      select: {
        id: true, title: true, status: true, views: true, likes: true,
        comments: true, shares: true, createdAt: true, image: true,
      },
    }),
  ]);

  // KPIs from all posts
  const totalViews    = allPosts.reduce((s, p) => s + (parseInt(p.views)    || 0), 0);
  const totalLikes    = allPosts.reduce((s, p) => s + (parseInt(p.likes)    || 0), 0);
  const totalComments = allPosts.reduce((s, p) => s + (parseInt(p.comments) || 0), 0);

  const statusCount = (s: string) => allPosts.filter(p => p.status === s).length;
  const published  = statusCount("published");
  const drafts     = statusCount("draft");
  const submitted  = statusCount("submitted");
  const inReview   = statusCount("in_review");
  const rejected   = statusCount("rejected");
  const decisioned = published + rejected;
  const approvalRate = decisioned > 0 ? Math.round((published / decisioned) * 1000) / 10 : 0;

  // Status breakdown for all posts
  const statusBreakdown = [
    { status: "Published",  count: published,  color: "#22c55e" },
    { status: "Draft",      count: drafts,      color: "#737373" },
    { status: "Submitted",  count: submitted,   color: "#3b82f6" },
    { status: "In Review",  count: inReview,    color: "#d97706" },
    { status: "Rejected",   count: rejected,    color: "#F44444" },
  ];

  // Daily time series — articles created per day in period
  const dateLabels = filledDaySeries(rangeStart, days);
  const dayMap = new Map<string, number>();
  for (const p of periodPosts) {
    const label = dayLabel(new Date(p.createdAt));
    dayMap.set(label, (dayMap.get(label) ?? 0) + 1);
  }
  const dailySeries = dateLabels.map(date => ({
    date,
    articles: dayMap.get(date) ?? 0,
  }));

  // Top 5 articles by views (all-time)
  const topArticles = [...allPosts]
    .sort((a, b) => (parseInt(b.views) || 0) - (parseInt(a.views) || 0))
    .slice(0, 8)
    .map(p => ({
      id:       p.id,
      title:    (p as any).title ?? "Untitled",
      status:   p.status,
      views:    parseInt(p.views)    || 0,
      likes:    parseInt(p.likes)    || 0,
      comments: parseInt(p.comments) || 0,
    }));

  // Period stats
  const periodViews    = periodPosts.reduce((s, p) => s + (parseInt(p.views)    || 0), 0);
  const periodLikes    = periodPosts.reduce((s, p) => s + (parseInt(p.likes)    || 0), 0);
  const periodComments = periodPosts.reduce((s, p) => s + (parseInt(p.comments) || 0), 0);

  return NextResponse.json({
    kpis: {
      total:       allPosts.length,
      published,
      drafts,
      submitted,
      inReview,
      rejected,
      totalViews,
      totalLikes,
      totalComments,
      approvalRate,
      periodArticles: periodPosts.length,
      periodViews,
      periodLikes,
      periodComments,
    },
    statusBreakdown,
    dailySeries,
    topArticles,
  });
}