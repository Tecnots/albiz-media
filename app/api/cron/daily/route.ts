import { NextRequest, NextResponse } from "next/server";
import { enqueue, getQueueStats } from "@/lib/job-queue";
import { pruneOldJobs } from "@/lib/workers/maintenance-worker";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const DEAD_JOB_ALERT_THRESHOLD  = 20;
const PENDING_BACKLOG_THRESHOLD = 200;
const ALERT_COOLDOWN_HOURS      = 12;

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON/daily] CRON_SECRET is not set — endpoint is unprotected");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const runResults: Record<string, unknown> = {};
  const runErrors: string[] = [];

  // ── Step 1: Prune completed/dead jobs older than 7 days ─────────────────────
  // Called directly (not queued) — fast DB delete, no side-effects on queue health.
  try {
    const prunedJobs = await pruneOldJobs();
    runResults.prunedJobs = prunedJobs;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runErrors.push(`pruneOldJobs: ${msg}`);
    console.error("[CRON/daily] pruneOldJobs failed:", e);
  }

  // ── Step 2: Enqueue daily maintenance tasks (per-type dedup guard) ────────────
  // Each type is checked independently so a partial prior failure can be retried.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  type MaintenanceTask = "prune-activity-log" | "cleanup-expired-stories" | "cleanup-notifications" | "prune-email-logs" | "domain-reconcile";

  const TASKS: Array<{ type: MaintenanceTask; payload: Record<string, unknown> }> = [
    { type: "prune-activity-log",      payload: { archiveDays: 90, deleteDays: 180 } },
    { type: "cleanup-expired-stories", payload: {} },
    { type: "cleanup-notifications",   payload: { keepPerRecipient: 100 } },
    { type: "prune-email-logs",        payload: { retentionDays: 30 } },
    { type: "domain-reconcile",        payload: {} },
  ];

  const enqueuedTasks: string[] = [];
  const skippedTasks: string[]  = [];

  // Query each type separately so partial successes from prior runs are respected.
  const existingCounts = await Promise.all(
    TASKS.map(({ type }) =>
      prisma.job.count({ where: { type, createdAt: { gte: todayStart } } }).catch(() => 0)
    )
  );

  await Promise.all(
    TASKS.map(async ({ type, payload }, i) => {
      if (existingCounts[i] > 0) {
        skippedTasks.push(type);
        return;
      }
      try {
         
        await enqueue(type, payload as any);
        enqueuedTasks.push(type);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        runErrors.push(`enqueue ${type}: ${msg}`);
        console.error(`[CRON/daily] Failed to enqueue ${type}:`, e);
      }
    })
  );

  runResults.enqueuedTasks = enqueuedTasks;
  runResults.skippedTasks  = skippedTasks;

  // ── Step 3: Queue health check — emit AdminNotification on abnormal conditions
  let queueStats: Record<string, number> = {};
  try {
    queueStats = await getQueueStats();
    runResults.queueStats = queueStats;
    await emitHealthAlerts(queueStats);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runErrors.push(`healthCheck: ${msg}`);
    console.error("[CRON/daily] Health check failed:", e);
  }

  // ── Step 4: Persist MaintenanceRun record ─────────────────────────────────────
  const completedAt = new Date();
  const duration    = completedAt.getTime() - startedAt.getTime();
  const status =
    runErrors.length === 0
      ? "success"
      : enqueuedTasks.length > 0 || runResults.prunedJobs != null
      ? "partial"
      : "failed";

  await prisma.maintenanceRun
    .create({
      data: {
        task:        "daily-maintenance",
        status,
        results:     runResults as Prisma.InputJsonValue,
        error:       runErrors.length ? runErrors.join("; ") : null,
        duration,
        startedAt,
        completedAt,
      },
    })
    .catch((e: unknown) => console.error("[CRON/daily] Failed to persist MaintenanceRun:", e));

  console.log(`[CRON/daily] ${status} in ${duration}ms — enqueued: [${enqueuedTasks.join(", ")}]`);

  return NextResponse.json({ status, results: runResults, errors: runErrors, duration });
}

// Creates an AdminNotification when queue health is abnormal.
// Deduplicates within a 12-hour window to avoid flooding the notification panel.
async function emitHealthAlerts(queueStats: Record<string, number>): Promise<void> {
  const deadCount    = queueStats.dead    ?? 0;
  const pendingCount = queueStats.pending ?? 0;
  const cooloffCutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 3_600_000);

  const conditions: Array<{ title: string; message: string }> = [];

  if (deadCount > DEAD_JOB_ALERT_THRESHOLD) {
    conditions.push({
      title:   "Dead tasks threshold exceeded",
      message: `${deadCount} tasks have exhausted all retry attempts and require review in System Tasks.`,
    });
  }

  if (pendingCount > PENDING_BACKLOG_THRESHOLD) {
    conditions.push({
      title:   "Queue backlog detected",
      message: `${pendingCount} tasks are waiting to be processed. Verify the cron schedule is active.`,
    });
  }

  // Atomic INSERT WHERE NOT EXISTS prevents duplicate alerts from concurrent cron runs.
  // A two-step count+create would race: two executions can both see count=0 before either commits.
  await Promise.all(
    conditions.map(async ({ title, message }) => {
      const inserted = await prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "AdminNotification" (type, title, message, unread, "createdAt")
          SELECT 'SYSTEM'::"AdminNotificationType", ${title}, ${message}, true, NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM "AdminNotification"
            WHERE type = 'SYSTEM'::"AdminNotificationType"
              AND title = ${title}
              AND "createdAt" >= ${cooloffCutoff}
          )
        `
      );
      if (inserted > 0) {
        console.warn(`[CRON/daily] Health alert fired: ${title}`);
      }
    })
  );
}