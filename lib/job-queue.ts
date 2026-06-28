import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ── Job type registry ──────────────────────────────────────────────────────────

export type JobType =
  | "send-email"
  | "send-push"
  | "prune-activity-log"
  | "cleanup-expired-stories"
  | "cleanup-notifications"
  | "prune-email-logs"
  | "publish-scheduled-article"
  | "send-scheduled-alert"
  | "send-campaign-email";

export interface JobPayloads {
  "send-email": {
    to: string;
    subject: string;
    html: string;
    templateKey: string;
    logId?: string;
  };
  "send-push": {
    userId: number;
    title: string;
    body: string;
    url?: string;
    icon?: string;
    image?: string;
  };
  "prune-activity-log": { archiveDays?: number; deleteDays?: number };
  "cleanup-expired-stories": Record<string, never>;
  "cleanup-notifications": { keepPerRecipient?: number };
  "prune-email-logs": { retentionDays?: number };
  "publish-scheduled-article": { postId: number; scheduleJobId: string };
  "send-scheduled-alert": { alertId: string };
  "send-campaign-email": { campaignId: string; recipientRowId: string };
}

const JOB_CONFIGS: Record<JobType, { maxAttempts: number; priority: number }> = {
  "send-email":                   { maxAttempts: 3, priority: 5  },
  "send-push":                    { maxAttempts: 2, priority: 5  },
  "prune-activity-log":           { maxAttempts: 2, priority: 2  },
  "cleanup-expired-stories":      { maxAttempts: 2, priority: 2  },
  "cleanup-notifications":        { maxAttempts: 2, priority: 2  },
  "prune-email-logs":             { maxAttempts: 2, priority: 1  },
  "publish-scheduled-article":    { maxAttempts: 3, priority: 10 },
  "send-scheduled-alert":         { maxAttempts: 3, priority: 7  },
  "send-campaign-email":          { maxAttempts: 3, priority: 5  },
};

// Exponential backoff: 2^attempt × 60 s, capped at 1 hour
function backoffMs(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 60_000, 3_600_000);
}

// ── Core queue operations ──────────────────────────────────────────────────────

export async function enqueue<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
  opts?: { scheduledAt?: Date; priority?: number }
): Promise<string> {
  const cfg = JOB_CONFIGS[type];
  const job = await prisma.job.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonValue,
      maxAttempts: cfg.maxAttempts,
      priority: opts?.priority ?? cfg.priority,
      scheduledAt: opts?.scheduledAt ?? new Date(),
    },
    select: { id: true },
  });
  return job.id;
}

export interface ClaimedJob {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
}

// Atomically claims up to `limit` pending jobs.
// FOR UPDATE SKIP LOCKED prevents duplicate processing across concurrent executions.
export async function claimJobs(limit = 20): Promise<ClaimedJob[]> {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM "Job"
        WHERE status = 'pending' AND "scheduledAt" <= NOW()
        ORDER BY priority DESC, "scheduledAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `
    );
    if (!pending.length) return [];

    const ids = pending.map((r) => r.id);
    await tx.job.updateMany({
      where: { id: { in: ids } },
      data: { status: "processing", startedAt: new Date(), attempts: { increment: 1 } },
    });

    return tx.job.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true, payload: true, attempts: true, maxAttempts: true },
    });
  });
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "completed", completedAt: new Date() },
  });
}

export async function failJob(
  jobId: string,
  error: string,
  attempts: number,
  maxAttempts: number
): Promise<void> {
  const lastError = error.slice(0, 2000);
  if (attempts >= maxAttempts) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "dead", lastError },
    });
  } else {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "pending",
        lastError,
        scheduledAt: new Date(Date.now() + backoffMs(attempts)),
      },
    });
  }
}

export async function getQueueStats(): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ status: string; count: bigint }[]>(
    Prisma.sql`SELECT status, COUNT(*)::bigint AS count FROM "Job" GROUP BY status`
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}

// ── Convenience wrappers ───────────────────────────────────────────────────────

export const enqueuePush = (payload: JobPayloads["send-push"]) =>
  enqueue("send-push", payload);

// Scans for jobs stuck in 'processing' longer than timeoutMinutes (serverless kill scenario)
// and safely reverts them. Uses FOR UPDATE SKIP LOCKED so concurrent cron invocations
// don't double-recover the same job.
export async function recoverZombieJobs(timeoutMinutes = 5): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const zombies = await tx.$queryRaw<{ id: string; attempts: number; max_attempts: number }[]>(
      Prisma.sql`
        SELECT id, attempts, "maxAttempts" AS max_attempts
        FROM "Job"
        WHERE status = 'processing' AND "startedAt" < ${cutoff}
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      `
    );

    if (!zombies.length) return 0;

    const now = Date.now();
    await Promise.all(
      zombies.map((z) => {
        const attempts    = Number(z.attempts);
        const maxAttempts = Number(z.max_attempts);
        const backoff     = Math.min(Math.pow(2, attempts) * 60_000, 3_600_000);
        return tx.job.update({
          where: { id: z.id },
          data: attempts >= maxAttempts
            ? { status: "dead",    lastError: "Recovered: serverless execution timeout" }
            : { status: "pending", lastError: "Recovered: serverless execution timeout",
                scheduledAt: new Date(now + backoff) },
        });
      })
    );

    console.log(`[QUEUE] Recovered ${zombies.length} zombie job(s) (stuck >${timeoutMinutes}min)`);
    return zombies.length;
  });
}

// Enqueues email and creates an EmailLog record for delivery tracking.
// Fire-and-forget — never throws so callers don't crash on queue failure.
export async function enqueueEmail(params: {
  to: string;
  subject: string;
  html: string;
  templateKey: string;
}): Promise<void> {
  try {
    const log = await prisma.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject,
        templateKey: params.templateKey,
        status: "queued",
      },
      select: { id: true },
    });
    await enqueue("send-email", { ...params, logId: log.id });
  } catch (err) {
    console.error("[enqueueEmail] Failed to queue email:", err);
  }
}