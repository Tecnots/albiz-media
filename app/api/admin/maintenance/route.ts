import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { enqueue, getQueueStats } from "@/lib/job-queue";
import { pruneOldJobs } from "@/lib/workers/maintenance-worker";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const startedAt = new Date();
  const runResults: Record<string, unknown> = {};
  const runErrors: string[] = [];

  // Prune old jobs first so the queue stays lean
  try {
    runResults.prunedJobs = await pruneOldJobs();
  } catch (e) {
    runErrors.push(`pruneOldJobs: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Enqueue all maintenance tasks immediately (no today-guard for manual runs)
  type MaintenanceTask = "prune-activity-log" | "cleanup-expired-stories" | "cleanup-notifications" | "prune-email-logs";

  const TASKS: Array<{ type: MaintenanceTask; payload: Record<string, unknown> }> = [
    { type: "prune-activity-log",      payload: { archiveDays: 90, deleteDays: 180 } },
    { type: "cleanup-expired-stories", payload: {} },
    { type: "cleanup-notifications",   payload: { keepPerRecipient: 100 } },
    { type: "prune-email-logs",        payload: { retentionDays: 30 } },
  ];

  const enqueuedTaskIds: Record<string, string> = {};

  await Promise.all(
    TASKS.map(async ({ type, payload }) => {
      try {
         
        const jobId = await enqueue(type, payload as any);
        enqueuedTaskIds[type] = jobId;
      } catch (e) {
        runErrors.push(`enqueue ${type}: ${e instanceof Error ? e.message : String(e)}`);
      }
    })
  );

  runResults.enqueuedTasks = Object.keys(enqueuedTaskIds);

  const queueStats = await getQueueStats().catch(() => ({}));
  runResults.queueStats = queueStats;

  const completedAt = new Date();
  const duration    = completedAt.getTime() - startedAt.getTime();
  const status =
    runErrors.length === 0 ? "success" : Object.keys(enqueuedTaskIds).length > 0 ? "partial" : "failed";

  const run = await prisma.maintenanceRun
    .create({
      data: {
        task:        "manual",
        status,
        results:     runResults as Prisma.InputJsonValue,
        error:       runErrors.length ? runErrors.join("; ") : null,
        duration,
        startedAt,
        completedAt,
      },
    })
    .catch(() => null);

  return NextResponse.json({ status, results: runResults, errors: runErrors, duration, runId: run?.id });
}