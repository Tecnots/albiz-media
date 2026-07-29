import { NextRequest, NextResponse } from "next/server";
import { claimJobs, completeJob, failJob, recoverZombieJobs, enqueue, getQueueStats } from "@/lib/job-queue";
import { processEmailJob, handleEmailJobFailure } from "@/lib/workers/email-worker";
import { processPushJob } from "@/lib/workers/push-worker";
import {
  pruneOldJobs, pruneActivityLog, cleanupExpiredStories,
  cleanupReadNotifications, pruneEmailLogs,
  reconcileOrphanedEditorAssignments,
} from "@/lib/workers/maintenance-worker";
import { processScheduledPublish, revertScheduledArticleToApproved } from "@/lib/workers/scheduled-publisher";
import { processScheduledShortPublish, revertScheduledShortToApproved } from "@/lib/workers/scheduled-short-publisher";
import { processScheduledAlert, markAlertFailed } from "@/lib/workers/alert-worker";
import { processCampaignEmail, markCampaignRecipientFailed } from "@/lib/workers/campaign-email-worker";
import { processCampaignPush } from "@/lib/workers/campaign-push-worker";
import { recomputeTrendingScores } from "@/lib/workers/trending-worker";
import { runTopicsWorker } from "@/lib/workers/topics-worker";
import { processGenerateThumbnailJob } from "@/lib/workers/thumbnail-worker";
import { processDomainProvisionSslJob, processDomainReconcileJob } from "@/lib/workers/domain-worker";
import { processSocialReliabilitySweepJob } from "@/lib/workers/social-sync-worker";
import { enqueueWorkflowReminders } from "@/lib/alert-scheduler";
import type { JobPayloads } from "@/lib/job-queue";
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

  // ── Step 1.5: Reassign or flag articles orphaned by a banned editor ──────────
  // Previously this only re-validated on resubmit — a stuck article could sit
  // invisible in no one's queue indefinitely (audit finding H-6).
  try {
    const reconciled = await reconcileOrphanedEditorAssignments();
    runResults.editorReconciliation = reconciled;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runErrors.push(`reconcileOrphanedEditorAssignments: ${msg}`);
    console.error("[CRON/daily] reconcileOrphanedEditorAssignments failed:", e);
  }

  // ── Step 1.6: Run topics worker as backup ──────────────────────────────────
  // The primary trigger is /api/cron (every 5 min), but running here ensures
  // topics are refreshed at least once daily even if the frequent cron fails.
  try {
    const topicsResult = await runTopicsWorker();
    runResults.topicsWorker = topicsResult;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runErrors.push(`topicsWorker: ${msg}`);
    console.error("[CRON/daily] Topics worker failed:", e);
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

  // ── Step 2.5: Process pending jobs (fallback for Hobby plan) ─────────────────
  // On Vercel Hobby, /api/cron cannot run frequently. This drains the queue
  // at least once daily. For production, use an external scheduler (GitHub Actions)
  // to call /api/cron every 5 minutes.
  let jobResults: Array<{ jobId: string; type: string; status: "ok" | "failed"; error?: string }> = [];
  try {
    await recoverZombieJobs(5);
    const jobs = await claimJobs(50);
    for (const job of jobs) {
      const p = job.payload as any;
      try {
        type JT = keyof JobPayloads;
        switch (job.type as JT) {
          case "send-email": await processEmailJob(p); break;
          case "send-push": await processPushJob(p); break;
          case "prune-activity-log": await pruneActivityLog(p?.archiveDays, p?.deleteDays); break;
          case "cleanup-expired-stories": await cleanupExpiredStories(); break;
          case "cleanup-notifications": await cleanupReadNotifications(p?.keepPerRecipient); break;
          case "prune-email-logs": await pruneEmailLogs(p?.retentionDays); break;
          case "publish-scheduled-article": await processScheduledPublish(p); break;
          case "publish-scheduled-short": await processScheduledShortPublish(p); break;
          case "send-scheduled-alert": await processScheduledAlert(p); break;
          case "send-campaign-email": await processCampaignEmail(p); break;
          case "send-campaign-push": await processCampaignPush(p); break;
          case "recompute-trending": await recomputeTrendingScores(); break;
          case "generate-short-thumbnail": await processGenerateThumbnailJob(p); break;
          case "domain-provision-ssl": await processDomainProvisionSslJob(p); break;
          case "domain-reconcile": await processDomainReconcileJob(); break;
          case "social-reliability-sweep": await processSocialReliabilitySweepJob(); break;
          default: throw new Error(`Unknown job type: ${job.type}`);
        }
        await completeJob(job.id);
        jobResults.push({ jobId: job.id, type: job.type, status: "ok" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (job.type === "send-email") await handleEmailJobFailure(p, msg).catch(() => {});
        if (job.type === "publish-scheduled-article" && job.attempts >= job.maxAttempts)
          await revertScheduledArticleToApproved(p).catch(() => {});
        if (job.type === "publish-scheduled-short" && job.attempts >= job.maxAttempts)
          await revertScheduledShortToApproved(p).catch(() => {});
        if (job.type === "send-scheduled-alert" && job.attempts >= job.maxAttempts)
          await markAlertFailed(p).catch(() => {});
        if (job.type === "send-campaign-email" && job.attempts >= job.maxAttempts)
          await markCampaignRecipientFailed(p, msg).catch(() => {});
        await failJob(job.id, msg, job.attempts, job.maxAttempts);
        jobResults.push({ jobId: job.id, type: job.type, status: "failed", error: msg });
      }
    }
    runResults.jobsProcessed = jobResults.length;
    runResults.jobsOk = jobResults.filter(r => r.status === "ok").length;
    runResults.jobsFailed = jobResults.filter(r => r.status === "failed").length;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    runErrors.push(`jobProcessing: ${msg}`);
  }

  // Auto-enqueue editorial workflow reminders
  try { await enqueueWorkflowReminders(); } catch (e) {
    console.error("[CRON/daily] Workflow reminders failed:", e);
  }

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