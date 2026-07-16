import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { getQueueStats } from "@/lib/job-queue";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [queueStats, emailStats, recentRuns, deadJobCount, pendingJobCount, lastDailyRun] = await Promise.all([
    getQueueStats(),
    prisma.emailLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.maintenanceRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        task: true,
        status: true,
        results: true,
        error: true,
        duration: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.job.count({ where: { status: "dead" } }),
    prisma.job.count({ where: { status: "pending" } }),
    // Dedicated query for the last daily run — not bounded by the top-10 history list,
    // so manual runs between daily runs cannot cause it to report "Never run".
    prisma.maintenanceRun.findFirst({
      where: { task: "daily-maintenance", status: { in: ["success", "partial"] } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
  ]);

  const emailStatsMap = Object.fromEntries(emailStats.map((r) => [r.status, r._count._all]));

  const lastRunAgeMs = lastDailyRun
    ? Date.now() - new Date(lastDailyRun.startedAt).getTime()
    : null;

  const totalEmails = (emailStatsMap.sent ?? 0) + (emailStatsMap.failed ?? 0);
  const emailFailRate =
    totalEmails > 0 ? (emailStatsMap.failed ?? 0) / totalEmails : 0;

  // Health signals
  const signals: Array<{ name: string; status: "ok" | "warn" | "error"; detail: string }> = [
    {
      name:   "Dead tasks",
      status: deadJobCount > 20 ? "error" : deadJobCount > 5 ? "warn" : "ok",
      detail: deadJobCount === 0 ? "None" : `${deadJobCount} task${deadJobCount !== 1 ? "s" : ""} dead`,
    },
    {
      name:   "Queue backlog",
      status: pendingJobCount > 200 ? "error" : pendingJobCount > 50 ? "warn" : "ok",
      detail:
        pendingJobCount === 0
          ? "Clear"
          : `${pendingJobCount} pending`,
    },
    {
      name:   "Last maintenance",
      status:
        lastRunAgeMs === null
          ? "warn"
          : lastRunAgeMs > 50 * 3_600_000
          ? "error"
          : lastRunAgeMs > 26 * 3_600_000
          ? "warn"
          : "ok",
      detail:
        lastRunAgeMs === null
          ? "Never run"
          : lastRunAgeMs < 3_600_000
          ? `${Math.floor(lastRunAgeMs / 60_000)}m ago`
          : lastRunAgeMs < 86_400_000
          ? `${Math.floor(lastRunAgeMs / 3_600_000)}h ago`
          : `${Math.floor(lastRunAgeMs / 86_400_000)}d ago`,
    },
    {
      name:   "Email delivery",
      status:
        emailFailRate > 0.2 ? "error" : emailFailRate > 0.05 ? "warn" : "ok",
      detail:
        totalEmails === 0
          ? "No recent emails"
          : `${Math.round(emailFailRate * 100)}% failure rate`,
    },
  ];

  return NextResponse.json({
    queue:       queueStats,
    email:       emailStatsMap,
    signals,
    recentRuns,
  });
}