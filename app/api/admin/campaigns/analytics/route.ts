import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const d = new URL(req.url).searchParams.get("days");
  const cutoff = d && d !== "all" ? new Date(Date.now() - Number(d) * 86_400_000) : null;
  const where = cutoff ? { createdAt: { gte: cutoff } } : {};

  const [recipientGroups, campaignAgg, topBroadcasts, audienceGroups] = await Promise.all([
    // Recipient-level status breakdown
    prisma.emailCampaignRecipient.groupBy({
      by: ["status"],
      where: cutoff ? { createdAt: { gte: cutoff } } : {},
      _count: { _all: true },
    }),
    // Campaign-level aggregation
    prisma.emailCampaign.aggregate({
      where,
      _sum: { recipientCount: true, deliveredCount: true, failedCount: true },
      _count: { _all: true },
    }),
    // Top broadcasts by delivery
    prisma.emailCampaign.findMany({
      where: { ...where, status: "sent", recipientCount: { gt: 0 } },
      orderBy: { deliveredCount: "desc" },
      take: 10,
      select: {
        id: true, name: true, audienceType: true,
        recipientCount: true, deliveredCount: true, failedCount: true,
        sentAt: true, metadata: true,
      },
    }),
    // Audience type distribution
    prisma.emailCampaign.groupBy({
      by: ["audienceType"],
      where,
      _count: { _all: true },
      _sum: { recipientCount: true },
    }),
  ]);

  const byRecip: Record<string, number> = {};
  for (const g of recipientGroups) byRecip[g.status] = g._count._all;
  const sent = byRecip.sent ?? 0;
  const failed = byRecip.failed ?? 0;
  const totalProcessed = sent + failed + (byRecip.pending ?? 0) + (byRecip.skipped ?? 0);

  // Delivery trend — granularity adapts to range
  const trendDays = d && d !== "all" ? Math.min(Number(d), 365) : 30;
  const trendCutoff = new Date(Date.now() - trendDays * 86_400_000);
  const gran = trendDays <= 7 ? "day" : trendDays <= 90 ? "week" : "month";
  const truncFn =
    gran === "day"  ? Prisma.sql`date_trunc('day',  "createdAt")` :
    gran === "week" ? Prisma.sql`date_trunc('week', "createdAt")` :
                     Prisma.sql`date_trunc('month', "createdAt")`;

  const deliveryTrend = await prisma.$queryRaw<
    { date: string; delivered: bigint; failed: bigint }[]
  >`
    SELECT ${truncFn}::date::text AS date,
           COUNT(*) FILTER (WHERE status = 'sent')   AS delivered,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed
    FROM "EmailCampaignRecipient"
    WHERE "createdAt" >= ${trendCutoff}
    GROUP BY 1 ORDER BY 1
  `;

  // Broadcast volume trend
  const volumeTrend = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT ${truncFn}::date::text AS date, COUNT(*) AS count
    FROM "EmailCampaign"
    WHERE "createdAt" >= ${trendCutoff}
    GROUP BY 1 ORDER BY 1
  `;

  return NextResponse.json({
    delivery: {
      totalSent: sent,
      totalFailed: failed,
      totalProcessed,
      deliveryRate: totalProcessed > 0 ? Math.round((sent / totalProcessed) * 100) : 0,
      totalRecipients: campaignAgg._sum.recipientCount ?? 0,
    },
    deliveryTrend: deliveryTrend.map(t => ({
      date: t.date,
      delivered: Number(t.delivered),
      failed: Number(t.failed),
    })),
    volumeTrend: volumeTrend.map(v => ({ date: v.date, value: Number(v.count) })),
    topBroadcasts: topBroadcasts.map(b => ({
      ...b,
      deliveryRate: b.recipientCount > 0
        ? Math.round((b.deliveredCount / b.recipientCount) * 100) : 0,
      channels: ((b.metadata as Record<string, unknown> | null)?.channels as string[]) ?? ["email"],
    })),
    audienceDistribution: audienceGroups.map(g => ({
      audienceType: g.audienceType,
      broadcasts: g._count._all,
      totalRecipients: g._sum.recipientCount ?? 0,
    })),
  });
}
