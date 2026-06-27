import { NextRequest, NextResponse } from "next/server";
import { enqueue, getQueueStats } from "@/lib/job-queue";
import { pruneOldJobs } from "@/lib/workers/maintenance-worker";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: only enqueue maintenance jobs once per UTC day
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const alreadyQueued = await prisma.job.count({
    where: {
      type: { in: ["prune-activity-log", "cleanup-expired-stories", "cleanup-notifications", "prune-email-logs"] },
      createdAt: { gte: todayStart },
    },
  });

  if (alreadyQueued > 0) {
    return NextResponse.json({ skipped: true, reason: "Already enqueued today" });
  }

  const [j1, j2, j3, j4] = await Promise.all([
    enqueue("prune-activity-log",      { archiveDays: 90, deleteDays: 180 }),
    enqueue("cleanup-expired-stories", {}),
    enqueue("cleanup-notifications",   { keepPerRecipient: 100 }),
    enqueue("prune-email-logs",        { retentionDays: 30 }),
  ]);

  const prunedJobs = await pruneOldJobs();

  const stats = await getQueueStats();

  return NextResponse.json({
    enqueued: [j1, j2, j3, j4],
    prunedOldJobs: prunedJobs,
    queueStats: stats,
  });
}