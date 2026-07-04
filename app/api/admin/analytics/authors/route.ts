import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser || authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = (!daysParam || daysParam === "all") ? null : Math.min(parseInt(daysParam) || 30, 365);
  const rangeStart = days ? new Date(Date.now() - days * 86_400_000) : null;

  const authorWhere = { role: "AUTHOR" as const };
  const periodWhere = rangeStart ? { createdAt: { gte: rangeStart } } : {};

  const [allAuthors, periodPosts, allPosts] = await Promise.all([
    prisma.user.findMany({
      where: authorWhere,
      select: {
        id: true, name: true, handle: true, avatar: true,
        canPost: true, banned: true, createdAt: true,
      },
    }),
    prisma.post.findMany({
      where: { ...periodWhere, user: { role: "AUTHOR" } },
      select: { id: true, status: true, views: true, createdAt: true, userId: true },
    }),
    prisma.post.findMany({
      where: { user: { role: "AUTHOR" } },
      select: { id: true, status: true, views: true, userId: true },
    }),
  ]);

  const totalAuthors   = allAuthors.length;
  const canPostCount   = allAuthors.filter(a => a.canPost).length;
  const bannedCount    = allAuthors.filter(a => a.banned).length;
  const totalArticles  = allPosts.length;
  const totalViews     = allPosts.reduce((s, p) => s + (parseInt(p.views) || 0), 0);
  const published      = allPosts.filter(p => p.status === "published").length;
  const drafts         = allPosts.filter(p => p.status === "draft").length;
  const submitted      = allPosts.filter(p => p.status === "submitted").length;
  const inReview       = allPosts.filter(p => p.status === "in_review").length;
  const rejected       = allPosts.filter(p => p.status === "rejected").length;
  const decisioned     = published + rejected;
  const approvalRate   = decisioned > 0 ? Math.round((published / decisioned) * 1000) / 10 : 0;

  // Daily articles-created series (capped at 90 visible days)
  const seriesDays = days ? Math.min(days, 90) : 90;
  const today = new Date();
  const dateLabels = Array.from({ length: seriesDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (seriesDays - 1 - i));
    return dayLabel(d);
  });
  const dayMap = new Map<string, number>();
  for (const p of periodPosts) {
    const label = dayLabel(new Date(p.createdAt));
    dayMap.set(label, (dayMap.get(label) ?? 0) + 1);
  }
  const dailySeries = dateLabels.map(date => ({ date, articles: dayMap.get(date) ?? 0 }));

  // Per-author article counts (all-time)
  const articlesByAuthor = new Map<number, number>();
  const viewsByAuthor    = new Map<number, number>();
  for (const p of allPosts) {
    articlesByAuthor.set(p.userId, (articlesByAuthor.get(p.userId) ?? 0) + 1);
    viewsByAuthor.set(p.userId, (viewsByAuthor.get(p.userId) ?? 0) + (parseInt(p.views) || 0));
  }
  const topAuthors = [...allAuthors]
    .sort((a, b) => (articlesByAuthor.get(b.id) ?? 0) - (articlesByAuthor.get(a.id) ?? 0))
    .slice(0, 15)
    .map(a => ({
      id:           a.id,
      name:         a.name,
      handle:       a.handle,
      avatar:       a.avatar,
      canPost:      a.canPost,
      banned:       a.banned,
      articleCount: articlesByAuthor.get(a.id) ?? 0,
      totalViews:   viewsByAuthor.get(a.id) ?? 0,
    }));

  const statusBreakdown = [
    { status: "Published", count: published, color: "#22c55e" },
    { status: "Draft",     count: drafts,    color: "#737373" },
    { status: "Submitted", count: submitted, color: "#3b82f6" },
    { status: "In Review", count: inReview,  color: "#d97706" },
    { status: "Rejected",  count: rejected,  color: "#F44444" },
  ];

  return NextResponse.json({
    kpis: {
      totalAuthors, canPostCount, bannedCount, totalArticles, totalViews,
      published, drafts, submitted, inReview, rejected, approvalRate,
      periodArticles: periodPosts.length,
    },
    dailySeries,
    topAuthors,
    statusBreakdown,
  });
}
