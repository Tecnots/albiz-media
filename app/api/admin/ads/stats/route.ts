import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { fmtCompact, fmtCtr, fmtMoney, dec, AD_SETTINGS_KEY, DEFAULT_AD_SETTINGS } from "@/app/lib/ads";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "all";

    const settingsRow = await prisma.adminSetting.findUnique({ where: { key: AD_SETTINGS_KEY } });
    const settings = { ...DEFAULT_AD_SETTINGS, ...(settingsRow?.value as object | undefined) };

    const campaigns = await prisma.adCampaign.findMany({
      select: { spent: true, status: true },
    });
    const totalSpent = campaigns.reduce((s, c) => s + dec(c.spent), 0);
    const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

    // Date cutoff for range filter
    const rangeDays: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
    const cutoff = rangeDays[range]
      ? new Date(Date.now() - rangeDays[range] * 86_400_000)
      : null;

    const eventWhere = cutoff ? { createdAt: { gte: cutoff } } : {};

    // Overall event totals (range-filtered)
    const totals = await prisma.adEvent.groupBy({
      by: ["type"],
      where: eventWhere,
      _count: { _all: true },
    });
    let totalImpressions = 0;
    let totalClicks = 0;
    for (const t of totals) {
      if (t.type === "IMPRESSION") totalImpressions = t._count._all;
      else if (t.type === "CLICK") totalClicks = t._count._all;
    }
    const blendedCpc = totalClicks > 0 ? totalSpent / totalClicks : settings.defaultCpc;

    // Per-placement aggregation (range-filtered)
    const dateFilter = cutoff
      ? Prisma.sql`"createdAt" >= ${cutoff}`
      : Prisma.sql`1=1`;

    const placementRows = await prisma.$queryRaw<
      { placement: string; impressions: bigint; clicks: bigint }[]
    >`
      SELECT placement,
             COUNT(*) FILTER (WHERE type = 'IMPRESSION') AS impressions,
             COUNT(*) FILTER (WHERE type = 'CLICK') AS clicks
      FROM "AdEvent"
      WHERE ${dateFilter}
      GROUP BY placement
      ORDER BY placement
    `;
    const placementPerformance = placementRows.map((r) => {
      const impressions = Number(r.impressions);
      const clicks = Number(r.clicks);
      return {
        placement: r.placement,
        impressions: fmtCompact(impressions),
        clicks: fmtCompact(clicks),
        ctr: fmtCtr(impressions, clicks),
        revenue: fmtMoney(clicks * blendedCpc),
      };
    });

    // Time-series (granularity-aware)
    const granularity = searchParams.get("granularity") ?? "month"; // "day" | "week" | "month"
    const truncFn =
      granularity === "day"  ? Prisma.sql`date_trunc('day',  "createdAt")` :
      granularity === "week" ? Prisma.sql`date_trunc('week', "createdAt")` :
                               Prisma.sql`date_trunc('month',"createdAt")`;

    const monthlyRows = await prisma.$queryRaw<
      { m: Date; clicks: bigint; impressions: bigint }[]
    >`
      SELECT ${truncFn} AS m,
             COUNT(*) FILTER (WHERE type = 'CLICK') AS clicks,
             COUNT(*) FILTER (WHERE type = 'IMPRESSION') AS impressions
      FROM "AdEvent"
      WHERE ${dateFilter}
      GROUP BY m
      ORDER BY m
    `;

    const fmtDate = (d: Date) =>
      granularity === "month"
        ? d.toLocaleDateString("en-US", { month: "short" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const revenueOverTime = monthlyRows.map((r) => ({
      date: fmtDate(new Date(r.m)),
      value: Math.round(Number(r.clicks) * blendedCpc),
    }));
    const monthlyImpr  = monthlyRows.map((r) => Number(r.impressions));
    const monthlyClicks = monthlyRows.map((r) => Number(r.clicks));
    const revSpark = revenueOverTime.map((r) => r.value);

    // Period-over-period comparison — only meaningful when a range is selected
    let revenueChange = 0;
    let impressionChange = 0;
    let ctrChange = 0;

    if (cutoff) {
      const prevCutoff = new Date(cutoff.getTime() - (Date.now() - cutoff.getTime()));
      const prevEventWhere = { createdAt: { gte: prevCutoff, lt: cutoff } };

      const prevTotals = await prisma.adEvent.groupBy({
        by: ["type"],
        where: prevEventWhere,
        _count: { _all: true },
      }).catch(() => [] as { type: string; _count: { _all: number } }[]);

      let prevImpressions = 0;
      let prevClicks = 0;
      for (const t of prevTotals) {
        if (t.type === "IMPRESSION") prevImpressions = t._count._all;
        else if (t.type === "CLICK") prevClicks = t._count._all;
      }

      const pctChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 100);
      };

      // Use range-filtered click revenue (clicks × blendedCpc) for both sides
      const currRevenue = totalClicks * blendedCpc;
      const prevRevenue = prevClicks * blendedCpc;
      const currCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
      const prevCtr = prevImpressions > 0 ? prevClicks / prevImpressions : 0;

      revenueChange    = pctChange(currRevenue, prevRevenue);
      impressionChange = pctChange(totalImpressions, prevImpressions);
      ctrChange        = pctChange(currCtr, prevCtr);
    }

    const stats = [
      {
        label: "Total Revenue",
        value: fmtMoney(totalSpent),
        change: revenueChange,
        up: revenueChange >= 0,
        sparkline: revSpark.length ? revSpark : [0],
      },
      {
        label: "Active Campaigns",
        value: String(activeCampaigns),
        change: 0,
        up: true,
        sparkline: [activeCampaigns],
      },
      {
        label: "Avg. CTR",
        value: fmtCtr(totalImpressions, totalClicks),
        change: ctrChange,
        up: ctrChange >= 0,
        sparkline: monthlyClicks.length ? monthlyClicks : [0],
      },
      {
        label: "Total Impressions",
        value: fmtCompact(totalImpressions),
        change: impressionChange,
        up: impressionChange >= 0,
        sparkline: monthlyImpr.length ? monthlyImpr : [0],
      },
    ];

    return NextResponse.json({ stats, revenueOverTime, placementPerformance });
  } catch (error) {
    console.error("[ADMIN_ADS_STATS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
