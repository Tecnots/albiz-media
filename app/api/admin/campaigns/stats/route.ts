import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const d = new URL(req.url).searchParams.get("days");
  const cutoff = d && d !== "all" ? new Date(Date.now() - Number(d) * 86_400_000) : null;
  const where = cutoff ? { createdAt: { gte: cutoff } } : {};

  const [statusGroups, deliveryAgg, recentRows, scheduledCount] = await Promise.all([
    prisma.emailCampaign.groupBy({ by: ["status"], _count: { _all: true }, where }),
    prisma.emailCampaign.aggregate({
      where,
      _sum: { recipientCount: true, deliveredCount: true, failedCount: true },
    }),
    prisma.emailCampaign.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      where,
      select: {
        id: true, name: true, status: true, audienceType: true,
        recipientCount: true, deliveredCount: true, failedCount: true,
        scheduledAt: true, sentAt: true, createdAt: true, metadata: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.emailCampaign.count({
      where: { ...where, status: "draft", scheduledAt: { gte: new Date() } },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) byStatus[g.status] = g._count._all;

  const totalRecipients = deliveryAgg._sum.recipientCount ?? 0;
  const totalDelivered = deliveryAgg._sum.deliveredCount ?? 0;
  const totalFailed = deliveryAgg._sum.failedCount ?? 0;
  const deliveryRate = totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 100) : 0;

  // Daily series (cap at 90 days for readability when no filter)
  const seriesDays = d && d !== "all" ? Math.min(Number(d), 365) : 30;
  const seriesCutoff = new Date(Date.now() - seriesDays * 86_400_000);
  const series = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT date_trunc('day', "createdAt")::date::text AS date, COUNT(*) AS count
    FROM "EmailCampaign"
    WHERE "createdAt" >= ${seriesCutoff}
    GROUP BY 1 ORDER BY 1
  `;

  // Channel distribution from metadata.channels JSON field
  const allMeta = await prisma.emailCampaign.findMany({ where, select: { metadata: true } });
  const channelDist = { email: 0, push: 0, inapp: 0 };
  for (const c of allMeta) {
    const chs = ((c.metadata as Record<string, unknown> | null)?.channels as string[]) ?? ["email"];
    for (const ch of chs) if (ch in channelDist) channelDist[ch as keyof typeof channelDist]++;
  }

  return NextResponse.json({
    kpis: {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      draft: Math.max(0, (byStatus.draft ?? 0) - scheduledCount),
      scheduled: scheduledCount,
      sending: byStatus.sending ?? 0,
      sent: byStatus.sent ?? 0,
      cancelled: byStatus.cancelled ?? 0,
      totalRecipients,
      totalDelivered,
      totalFailed,
      deliveryRate,
    },
    series: series.map(s => ({ date: s.date, value: Number(s.count) })),
    channelDistribution: channelDist,
    recent: recentRows.map(c => ({
      ...c,
      channels: ((c.metadata as Record<string, unknown> | null)?.channels as string[]) ?? ["email"],
    })),
  });
}
