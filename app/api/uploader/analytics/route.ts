import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

function periodStart(period: string): Date | null {
  const map: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  const days = map[period];
  return days ? new Date(Date.now() - days * 86_400_000) : null;
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== "UPLOADER" && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = req.nextUrl.searchParams.get("period") ?? "30d";
  const rangeStart = periodStart(period);
  const days = period === "1d" ? 1 : period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;

  const [allShorts, periodShorts] = await Promise.all([
    prisma.short.findMany({
      where: { userId: authUser.id },
      select: {
        id: true, title: true, status: true,
        views: true, likes: true, shares: true,
        thumbnailUrl: true, createdAt: true, publishedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.short.findMany({
      where: {
        userId: authUser.id,
        ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
      },
      select: {
        id: true, title: true, status: true,
        views: true, likes: true, shares: true,
        thumbnailUrl: true, createdAt: true, publishedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // All-time KPIs
  const totalViews  = allShorts.reduce((s, x) => s + x.views,  0);
  const totalLikes  = allShorts.reduce((s, x) => s + x.likes,  0);
  const totalShares = allShorts.reduce((s, x) => s + x.shares, 0);
  const avgViews    = allShorts.length > 0 ? Math.round(totalViews / allShorts.length) : 0;
  const published   = allShorts.filter(s => s.status === "published").length;
  const drafts      = allShorts.filter(s => s.status === "draft").length;
  const inReview    = allShorts.filter(s => s.status === "in_review").length;
  const approved    = allShorts.filter(s => s.status === "approved").length;
  const rejected    = allShorts.filter(s => s.status === "rejected").length;
  const decisioned  = published + rejected;
  const approvalRate = decisioned > 0 ? Math.round((published / decisioned) * 1000) / 10 : 0;

  // Period KPIs
  const periodViews  = periodShorts.reduce((s, x) => s + x.views,  0);
  const periodLikes  = periodShorts.reduce((s, x) => s + x.likes,  0);
  const periodShares = periodShorts.reduce((s, x) => s + x.shares, 0);

  // Status breakdown
  const statusBreakdown = [
    { status: "Published", count: published, color: "#2563eb" },
    { status: "Approved",  count: approved,  color: "#16a34a" },
    { status: "In Review", count: inReview,  color: "#d97706" },
    { status: "Draft",     count: drafts,    color: "#525252" },
    { status: "Rejected",  count: rejected,  color: "#F44444" },
  ];

  // Daily time series
  const seriesDays = Math.min(days, 90);
  const today = new Date();
  const dateLabels = Array.from({ length: seriesDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (seriesDays - 1 - i));
    return dayLabel(d);
  });
  const dayMap = new Map<string, { created: number; views: number }>();
  for (const s of periodShorts) {
    const label = dayLabel(new Date(s.createdAt));
    const prev = dayMap.get(label) ?? { created: 0, views: 0 };
    dayMap.set(label, { created: prev.created + 1, views: prev.views + s.views });
  }
  const dailySeries = dateLabels.map(date => ({
    date,
    created: dayMap.get(date)?.created ?? 0,
    views:   dayMap.get(date)?.views   ?? 0,
  }));

  // Top shorts by views
  const topShorts = [...allShorts]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
    .map(s => ({
      id:           s.id,
      title:        s.title,
      status:       s.status,
      views:        s.views,
      likes:        s.likes,
      shares:       s.shares,
      thumbnailUrl: blobStorageService.resolveMediaUrl(s.thumbnailUrl),
      createdAt:    s.createdAt.toISOString(),
    }));

  // Reach funnel
  const reachFunnel = [
    { label: "Total shorts",  value: allShorts.length },
    { label: "Submitted",     value: allShorts.filter(s => s.status !== "draft").length },
    { label: "Published",     value: published },
    { label: "Total views",   value: totalViews },
    { label: "Total likes",   value: totalLikes },
    { label: "Total shares",  value: totalShares },
  ];

  return NextResponse.json({
    kpis: {
      total:         allShorts.length,
      published,
      drafts,
      inReview,
      approved,
      rejected,
      totalViews,
      totalLikes,
      totalShares,
      avgViews,
      approvalRate,
      periodCount:   periodShorts.length,
      periodViews,
      periodLikes,
      periodShares,
    },
    statusBreakdown,
    dailySeries,
    topShorts,
    reachFunnel,
  });
}