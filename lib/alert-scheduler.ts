import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/job-queue";
import { logActivity } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

// Infer the Prisma interactive-transaction client type without importing private types.
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Alert creation params ──────────────────────────────────────────────────────

interface CreateAlertParams {
  type: "CUSTOM" | "PRE_PUBLISH_REMINDER" | "REVIEW_OVERDUE" | "APPROVAL_PENDING" | "SUBMISSION_REMINDER" | "INACTIVITY_REMINDER" | "DEADLINE_REMINDER";
  recipientId: number;
  entityType?: string;
  entityId?: number;
  channels: { inApp?: boolean; push?: boolean; email?: boolean };
  title: string;
  body: string;
  url?: string;
  scheduledFor: Date;
  createdById?: number;
  metadata?: Record<string, unknown>;
}

// ── Non-transactional helper — used by single-call paths (API routes, schedule hook)

async function createAlert(params: CreateAlertParams): Promise<string> {
  const alert = await prisma.scheduledAlert.create({
    data: {
      type: params.type,
      recipientId: params.recipientId,
      entityType: params.entityType,
      entityId: params.entityId,
      channels: params.channels as Prisma.InputJsonValue,
      title: params.title,
      body: params.body,
      url: params.url,
      scheduledFor: params.scheduledFor,
      createdById: params.createdById,
      metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true },
  });

  const jobId = await enqueue(
    "send-scheduled-alert",
    { alertId: alert.id },
    { scheduledAt: params.scheduledFor, priority: 7 }
  );

  await prisma.scheduledAlert.update({
    where: { id: alert.id },
    data: { jobId },
  });

  return alert.id;
}

// ── Transactional helper — used inside enqueueWorkflowReminders' transaction.
// Pre-generates the job UUID so both the ScheduledAlert row and the Job row are
// created atomically within the same transaction. The advisory lock held by the
// outer transaction ensures no concurrent cron run sees these rows until commit.

async function createAlertInTx(tx: PrismaTx, params: CreateAlertParams): Promise<void> {
  const jobId = randomUUID();

  const alert = await tx.scheduledAlert.create({
    data: {
      type: params.type,
      recipientId: params.recipientId,
      entityType: params.entityType,
      entityId: params.entityId,
      channels: params.channels as Prisma.InputJsonValue,
      title: params.title,
      body: params.body,
      url: params.url,
      scheduledFor: params.scheduledFor,
      createdById: params.createdById,
      metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
      jobId,
    },
    select: { id: true },
  });

  await tx.job.create({
    data: {
      id: jobId,
      type: "send-scheduled-alert",
      payload: { alertId: alert.id } as Prisma.InputJsonValue,
      maxAttempts: 3,
      priority: 7,
      scheduledAt: params.scheduledFor,
    },
  });
}

// ── Pre-publish reminder ───────────────────────────────────────────────────────
// Called immediately after an article is scheduled for publication.
// Schedules a push reminder to the author 1 hour before the publish time.
// Skips if the publish time is within 90 minutes — not enough notice.

export async function schedulePrePublishReminder(
  postId: number,
  publishAt: Date,
  authorId: number
): Promise<void> {
  try {
    const reminderAt = new Date(publishAt.getTime() - 60 * 60 * 1000);
    if (reminderAt <= new Date(Date.now() + 30 * 60 * 1000)) return; // <90 min away

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { title: true },
    });
    if (!post) return;

    const title = post.title ?? "Your article";

    await createAlert({
      type: "PRE_PUBLISH_REMINDER",
      recipientId: authorId,
      entityType: "post",
      entityId: postId,
      channels: { inApp: true, push: true, email: false },
      title: "Publishing soon",
      body: `"${title}" goes live in 1 hour.`,
      url: "/authors/my-articles",
      scheduledFor: reminderAt,
      metadata: { postId, publishAt: publishAt.toISOString() },
    });
  } catch (err) {
    console.error("[alert-scheduler] schedulePrePublishReminder failed:", err);
  }
}

// ── Workflow auto-reminders ────────────────────────────────────────────────────
// Called by the cron worker after job processing completes.
//
// Concurrency safety: the entire check+insert block runs inside a single
// interactive transaction guarded by pg_try_advisory_xact_lock. If a concurrent
// cron execution already holds the lock, pg_try_advisory_xact_lock returns false
// immediately (non-blocking) and we skip — preventing duplicate reminders that
// would otherwise arise when two cron runs both pass the NOT EXISTS check before
// either has committed its inserts.
//
// The advisory lock is transaction-scoped and released automatically on commit
// or rollback — no explicit unlock needed.

export async function enqueueWorkflowReminders(): Promise<{
  reviewOverdue: number;
  approvalPending: number;
}> {
  const counts = { reviewOverdue: 0, approvalPending: 0 };

  try {
    await prisma.$transaction(async (tx) => {
      // Acquire a transaction-scoped PostgreSQL advisory lock. The integer key is
      // derived from a stable string so it is consistent across all app instances.
      // pg_try_advisory_xact_lock is non-blocking: if another session holds the
      // lock, it returns false immediately instead of waiting.
      const lockResult = await tx.$queryRaw<{ acquired: boolean }[]>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext('albiz_workflow_reminders')) AS acquired`
      );

      if (!lockResult[0]?.acquired) {
        console.log("[alert-scheduler] Workflow reminder lock held by another execution — skipping");
        return;
      }

      // ── REVIEW_OVERDUE: articles stuck in under_review for >24h ──────────────
      // The NOT EXISTS check and the subsequent inserts are both within this
      // transaction, so the check is atomic with respect to any other transaction
      // holding the same advisory lock. A concurrent execution that tries to acquire
      // the lock will block until this transaction commits, at which point its own
      // NOT EXISTS check will correctly see the rows we just inserted.
      const reviewOverdue = await tx.$queryRaw<{
        id: number;
        title: string | null;
        assigned_editor_id: number | null;
      }[]>(Prisma.sql`
        SELECT
          p.id,
          p.title,
          p."assignedEditorId" AS assigned_editor_id
        FROM "Post" p
        WHERE p.status = 'under_review'
          AND p."assignedEditorId" IS NOT NULL
          AND p."createdAt" < NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (
            SELECT 1 FROM "ScheduledAlert" sa
            WHERE sa."entityType" = 'post'
              AND sa."entityId"   = p.id
              AND sa.type         = 'REVIEW_OVERDUE'
              AND sa.status NOT IN ('cancelled', 'failed')
          )
        LIMIT 50
      `);

      for (const row of reviewOverdue) {
        if (!row.assigned_editor_id) continue;
        const title = row.title ?? "An article";
        await createAlertInTx(tx, {
          type: "REVIEW_OVERDUE",
          recipientId: row.assigned_editor_id,
          entityType: "post",
          entityId: row.id,
          channels: { inApp: true, push: true, email: false },
          title: "Review overdue",
          body: `"${title}" has been waiting for review for more than 24 hours.`,
          url: `/editor/review/${row.id}`,
          scheduledFor: new Date(),
          metadata: { postId: row.id },
        });
        counts.reviewOverdue++;
      }

      // ── APPROVAL_PENDING: articles stuck in approved for >48h ─────────────────
      const approvalPending = await tx.$queryRaw<{
        id: number;
        title: string | null;
        user_id: number;
      }[]>(Prisma.sql`
        SELECT p.id, p.title, p."userId" AS user_id
        FROM "Post" p
        WHERE p.status = 'approved'
          AND p."createdAt" < NOW() - INTERVAL '48 hours'
          AND NOT EXISTS (
            SELECT 1 FROM "ScheduledAlert" sa
            WHERE sa."entityType" = 'post'
              AND sa."entityId"   = p.id
              AND sa.type         = 'APPROVAL_PENDING'
              AND sa.status NOT IN ('cancelled', 'failed')
          )
        LIMIT 50
      `);

      for (const row of approvalPending) {
        const title = row.title ?? "An article";
        await createAlertInTx(tx, {
          type: "APPROVAL_PENDING",
          recipientId: row.user_id,
          entityType: "post",
          entityId: row.id,
          channels: { inApp: true, push: false, email: false },
          title: "Article approved and waiting",
          body: `"${title}" was approved more than 48 hours ago and hasn't been published or scheduled yet.`,
          url: "/authors/my-articles",
          scheduledFor: new Date(),
          metadata: { postId: row.id },
        });
        counts.approvalPending++;
      }
    });
  } catch (err) {
    console.error("[alert-scheduler] enqueueWorkflowReminders failed:", err);
  }

  if (counts.reviewOverdue + counts.approvalPending > 0) {
    console.log(
      `[alert-scheduler] Enqueued: ${counts.reviewOverdue} review-overdue, ${counts.approvalPending} approval-pending`
    );
    logActivity({
      eventType: "ALERT_SCHEDULED",
      meta: JSON.stringify({ ...counts, source: "auto-workflow" }),
    }).catch(() => {});
  }

  return counts;
}

// ── Manual alert creation ─────────────────────────────────────────────────────
// Used by the REST API so editors/admins can schedule custom alerts for any user.

export async function scheduleCustomAlert(params: {
  recipientId: number;
  title: string;
  body: string;
  url?: string;
  scheduledFor: Date;
  channels?: { inApp?: boolean; push?: boolean; email?: boolean };
  entityType?: string;
  entityId?: number;
  createdById: number;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const alertId = await createAlert({
    type: "CUSTOM",
    recipientId: params.recipientId,
    entityType: params.entityType,
    entityId: params.entityId,
    channels: params.channels ?? { inApp: true, push: true, email: false },
    title: params.title,
    body: params.body,
    url: params.url,
    scheduledFor: params.scheduledFor,
    createdById: params.createdById,
    metadata: params.metadata,
  });

  await logActivity({
    eventType: "ALERT_SCHEDULED",
    userId: params.createdById,
    meta: JSON.stringify({
      alertId,
      recipientId: params.recipientId,
      scheduledFor: params.scheduledFor.toISOString(),
    }),
  });

  return alertId;
}

// ── Cancellation ──────────────────────────────────────────────────────────────

export async function cancelAlert(
  alertId: string,
  cancelledById: number
): Promise<{ cancelled: boolean; reason?: string }> {
  const alert = await prisma.scheduledAlert.findUnique({
    where: { id: alertId },
    select: { status: true, jobId: true, createdById: true },
  });

  if (!alert) return { cancelled: false, reason: "not_found" };
  if (alert.status !== "pending") {
    return { cancelled: false, reason: `status_is_${alert.status}` };
  }

  // Atomic guard: only cancel if still pending
  const updated = await prisma.scheduledAlert.updateMany({
    where: { id: alertId, status: "pending" },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  if (updated.count === 0) return { cancelled: false, reason: "status_changed" };

  // Mark the backing Job as dead (fire-and-forget)
  if (alert.jobId) {
    prisma.job.update({
      where: { id: alert.jobId },
      data: { status: "dead", lastError: "Alert cancelled" },
    }).catch(() => {});
  }

  await logActivity({
    eventType: "ALERT_CANCELLED",
    userId: cancelledById,
    meta: JSON.stringify({ alertId }),
  });

  return { cancelled: true };
}