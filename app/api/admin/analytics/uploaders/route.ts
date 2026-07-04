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

  const periodWhere = rangeStart ? { createdAt: { gte: rangeStart } } : {};

  const [allUploaders, allShorts, periodShorts] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SHORTS_CREATOR" },
      select: { id: true, name: true, handle: true, avatar: true, canPost: true, banned: true },
    }),
    prisma.short.findMany({
      select: { id: true, userId: true, status: true, views: true, likes: true, shares: true, createdAt: true },
    }),
    prisma.short.findMany({
      where: periodWhere,
      select: { id: true, userId: true, status: true, views: true, likes: true, shares: true, createdAt: true },
    }),
  ]);

  const totalUploaders = allUploaders.length;
  const totalShorts    = allShorts.length;
  const totalViews     = allShorts.reduce((s, x) => s + x.views,  0);
  const totalLikes     = allShorts.reduce((s, x) => s + x.likes,  0);
  const totalShares    = allShorts.reduce((s, x) => s + x.shares, 0);
  const published      = allShorts.filter(s => s.status === "published").length;
  const approved       = allShorts.filter(s => s.status === "approved").length;
  const inReview       = allShorts.filter(s => s.status === "in_review").length;
  const drafts         = allShorts.filter(s => s.status === "draft").length;
  const rejected       = allShorts.filter(s => s.status === "rejected").length;
  const decisioned     = published + rejected;
  const approvalRate   = decisioned > 0 ? Math.round((published / decisioned) * 1000) / 10 : 0;
  const avgViews       = totalShorts > 0 ? Math.round(totalViews / totalShorts) : 0;

  // Daily uploads series
  const seriesDays = days ? Math.min(days, 90) : 90;
  const today = new Date();
  const dateLabels = Array.from({ length: seriesDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (seriesDays - 1 - i));
    return dayLabel(d);
  });
  const dayMap = new Map<string, { uploads: number; views: number }>();
  for (const s of periodShorts) {
    const label = dayLabel(new Date(s.createdAt));
    const prev = dayMap.get(label) ?? { uploads: 0, views: 0 };
    dayMap.set(label, { uploads: prev.uploads + 1, views: prev.views + s.views });
  }
  const dailySeries = dateLabels.map(date => ({
    date,
    uploads: dayMap.get(date)?.uploads ?? 0,
    views:   dayMap.get(date)?.views   ?? 0,
  }));

  // Per-uploader short counts
  const shortsByUploader = new Map<number, number>();
  const viewsByUploader  = new Map<number, number>();
  for (const s of allShorts) {
    shortsByUploader.set(s.userId, (shortsByUploader.get(s.userId) ?? 0) + 1);
    viewsByUploader.set(s.userId, (viewsByUploader.get(s.userId) ?? 0) + s.views);
  }
  const topUploaders = [...allUploaders]
    .sort((a, b) => (shortsByUploader.get(b.id) ?? 0) - (shortsByUploader.get(a.id) ?? 0))
    .slice(0, 10)
    .map(u => ({
      id:         u.id,
      name:       u.name,
      handle:     u.handle,
      avatar:     u.avatar,
      canPost:    u.canPost,
      banned:     u.banned,
      shortCount: shortsByUploader.get(u.id) ?? 0,
      totalViews: viewsByUploader.get(u.id) ?? 0,
    }));

  const statusBreakdown = [
    { status: "Published", count: published, color: "#2563eb" },
    { status: "Approved",  count: approved,  color: "#16a34a" },
    { status: "In Review", count: inReview,  color: "#d97706" },
    { status: "Draft",     count: drafts,    color: "#525252" },
    { status: "Rejected",  count: rejected,  color: "#F44444" },
  ];

  return NextResponse.json({
    kpis: {
      totalUploaders, totalShorts, totalViews, totalLikes, totalShares,
      avgViews, published, approved, inReview, drafts, rejected,
      approvalRate, periodUploads: periodShorts.length,
    },
    dailySeries,
    topUploaders,
    statusBreakdown,
  });
}
