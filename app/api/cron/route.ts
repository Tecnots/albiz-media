import { NextRequest, NextResponse } from "next/server";
import { claimJobs, completeJob, failJob, recoverZombieJobs, enqueue } from "@/lib/job-queue";
import { processEmailJob, handleEmailJobFailure } from "@/lib/workers/email-worker";
import { processPushJob } from "@/lib/workers/push-worker";
import {
  pruneActivityLog,
  cleanupExpiredStories,
  cleanupReadNotifications,
  pruneEmailLogs,
} from "@/lib/workers/maintenance-worker";
import {
  processScheduledPublish,
  revertScheduledArticleToApproved,
} from "@/lib/workers/scheduled-publisher";
import { processScheduledAlert, markAlertFailed } from "@/lib/workers/alert-worker";
import { processCampaignEmail, markCampaignRecipientFailed } from "@/lib/workers/campaign-email-worker";
import { processCampaignPush } from "@/lib/workers/campaign-push-worker";
import { enqueueWorkflowReminders } from "@/lib/alert-scheduler";
import { recomputeTrendingScores, isTrendingRecomputeDue } from "@/lib/workers/trending-worker";
import { runTopicsWorker } from "@/lib/workers/topics-worker";
import { processGenerateThumbnailJob } from "@/lib/workers/thumbnail-worker";
import { processDomainProvisionSslJob, processDomainReconcileJob } from "@/lib/workers/domain-worker";
import type { JobPayloads } from "@/lib/job-queue";

// Vercel automatically provides CRON_SECRET and sends it as Authorization: Bearer <secret>
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON] CRON_SECRET is not set — endpoint is unprotected");
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export const maxDuration = 60; // seconds — Vercel Pro allows up to 60s

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{
    jobId: string;
    type: string;
    status: "ok" | "failed";
    error?: string;
  }> = [];

  // Recover jobs stuck in 'processing' from previous serverless executions that were
  // terminated before they could mark themselves complete or failed.
  let recovered = 0;
  try {
    recovered = await recoverZombieJobs(5);
  } catch (err) {
    console.error("[CRON] Zombie recovery failed:", err);
  }

  // Trending recompute runs on a 5-15 min cadence via this same per-minute
  // cron — a dedup gate against TrendingScore's own last-run timestamp
  // stands in for a dedicated cron entry, same pattern as cron/daily's
  // per-type dedup guard for its own periodic tasks.
  try {
    if (await isTrendingRecomputeDue()) {
      // The Job table has a partial unique index on (type) WHERE status='pending'
      // (added in migration 20260707000001_audit_fixes). A second concurrent cron
      // invocation that also passes the isTrendingRecomputeDue() check will hit a
      // P2002 unique-constraint violation here — treat that as a no-op.
      await enqueue("recompute-trending", {});
    }
  } catch (err: any) {
    if (err?.code === "P2002") {
      // A pending recompute job already exists — this is expected under concurrent cron runs.
    } else {
      console.error("[CRON] Trending dedup-gate check failed:", err);
    }
  }

  // Topics worker runs on the same cadence; independent from post-level trending
  try {
    await runTopicsWorker();
  } catch (err) {
    console.error("[CRON] Topics worker failed:", err);
  }

  try {
    const jobs = await claimJobs(20);

    for (const job of jobs) {
      const start = Date.now();
      try {
         
        const p = job.payload as any;

        switch (job.type as JobType) {
          case "send-email":
            await processEmailJob(p as JobPayloads["send-email"]);
            break;

          case "send-push":
            await processPushJob(p as JobPayloads["send-push"]);
            break;

          case "prune-activity-log":
            await pruneActivityLog(p?.archiveDays, p?.deleteDays);
            break;

          case "cleanup-expired-stories":
            await cleanupExpiredStories();
            break;

          case "cleanup-notifications":
            await cleanupReadNotifications(p?.keepPerRecipient);
            break;

          case "prune-email-logs":
            await pruneEmailLogs(p?.retentionDays);
            break;

          case "publish-scheduled-article":
            await processScheduledPublish(p as JobPayloads["publish-scheduled-article"]);
            break;

          case "send-scheduled-alert":
            await processScheduledAlert(p as JobPayloads["send-scheduled-alert"]);
            break;

          case "send-campaign-email":
            await processCampaignEmail(p as JobPayloads["send-campaign-email"]);
            break;

          case "send-campaign-push":
            await processCampaignPush(p as JobPayloads["send-campaign-push"]);
            break;

          case "recompute-trending":
            await recomputeTrendingScores();
            break;

          case "generate-short-thumbnail":
            await processGenerateThumbnailJob(p as JobPayloads["generate-short-thumbnail"]);
            break;

          case "domain-provision-ssl":
            await processDomainProvisionSslJob(p as JobPayloads["domain-provision-ssl"]);
            break;

          case "domain-reconcile":
            await processDomainReconcileJob();
            break;

          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }

        await completeJob(job.id);
        results.push({ jobId: job.id, type: job.type, status: "ok" });
        console.log(`[CRON] ${job.type} (${job.id}) in ${Date.now() - start}ms`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Update EmailLog status on failure
        if (job.type === "send-email") {
          await handleEmailJobFailure(
            job.payload as JobPayloads["send-email"],
            msg
          ).catch(() => {});
        }

        // When a scheduled-publish job exhausts all attempts, revert the article to approved
        if (job.type === "publish-scheduled-article" && job.attempts >= job.maxAttempts) {
          await revertScheduledArticleToApproved(
            job.payload as JobPayloads["publish-scheduled-article"]
          ).catch(() => {});
        }

        // When a scheduled-alert job exhausts all attempts, mark the alert as failed
        if (job.type === "send-scheduled-alert" && job.attempts >= job.maxAttempts) {
          await markAlertFailed(
            job.payload as JobPayloads["send-scheduled-alert"]
          ).catch(() => {});
        }

        // When a campaign email job exhausts all attempts, mark the recipient as failed
        if (job.type === "send-campaign-email" && job.attempts >= job.maxAttempts) {
          await markCampaignRecipientFailed(
            job.payload as JobPayloads["send-campaign-email"],
            msg
          ).catch(() => {});
        }

        await failJob(job.id, msg, job.attempts, job.maxAttempts);
        results.push({ jobId: job.id, type: job.type, status: "failed", error: msg });
        console.error(`[CRON] ${job.type} (${job.id}) attempt ${job.attempts}/${job.maxAttempts}: ${msg}`);
      }
    }
  } catch (err) {
    console.error("[CRON] Fatal error claiming jobs:", err);
    return NextResponse.json({ error: "Internal error claiming jobs" }, { status: 500 });
  }

  // Auto-enqueue editorial workflow reminders (review overdue, approval pending).
  // Runs after job processing to avoid competing for the 60s execution budget.
  // Fire-and-forget — a failure here does not affect the job processing response.
  let reminders: { reviewOverdue: number; approvalPending: number } | null = null;
  try {
    reminders = await enqueueWorkflowReminders();
  } catch (err) {
    console.error("[CRON] Workflow reminder scheduling failed:", err);
  }

  return NextResponse.json({
    recovered,
    processed: results.length,
    ok:        results.filter((r) => r.status === "ok").length,
    failed:    results.filter((r) => r.status === "failed").length,
    results,
    reminders,
  });
}

type JobType = keyof JobPayloads;