import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { enqueueEmail } from "@/lib/job-queue";
import type { JobPayloads } from "@/lib/job-queue";

interface AlertChannels {
  inApp?: boolean;
  push?: boolean;
  email?: boolean;
}

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

export async function processScheduledAlert(
  payload: JobPayloads["send-scheduled-alert"]
): Promise<void> {
  const { alertId } = payload;

  const alert = await prisma.scheduledAlert.findUnique({
    where: { id: alertId },
    include: {
      recipient: { select: { id: true, email: true, name: true } },
    },
  });

  if (!alert) {
    console.log(`[ALERT] No-op for ${alertId} — record not found`);
    return;
  }

  // Idempotency: if the alert was already delivered or cancelled, silently exit.
  // The job table's atomic claiming (FOR UPDATE SKIP LOCKED) prevents concurrent
  // double-processing, but zombie recovery can re-run jobs where sentAt was set
  // before the job was marked complete. The status check is the guard.
  if (alert.status === "sent" || alert.status === "cancelled") {
    console.log(`[ALERT] No-op for ${alertId} — status is already '${alert.status}'`);
    return;
  }

  const channels = alert.channels as AlertChannels;
  const { recipient } = alert;
  const now = new Date();

  // ── In-app notification ──────────────────────────────────────────────────────
  if (channels.inApp !== false) {
    await prisma.notification.create({
      data: {
        type: "SCHEDULED_ALERT",
        userId: alert.createdById ?? recipient.id,
        recipientId: recipient.id,
        time: formatTime(now),
        group: "TODAY",
        unread: true,
        postId: alert.entityType === "post" ? alert.entityId ?? undefined : undefined,
        message: alert.body,
      },
    }).catch((err) => {
      console.error(`[ALERT] In-app delivery failed for ${alertId}:`, err);
    });
  }

  // ── Push notification ────────────────────────────────────────────────────────
  // Fix: await the dynamic import and push call so the promise is not floating.
  // Previously this used .then().catch() without await, meaning the serverless
  // function could return before FCM resolved and the delivery would be dropped.
  if (channels.push !== false) {
    try {
      const { sendPushToUser } = await import("@/lib/fcm-send");
      await sendPushToUser(recipient.id, {
        title: alert.title,
        body: alert.body,
        url: alert.url ?? undefined,
      });
    } catch (err) {
      console.error(`[ALERT] Push delivery failed for ${alertId}:`, err);
    }
  }

  // ── Email notification ───────────────────────────────────────────────────────
  if (channels.email !== false && recipient.email) {
    const { scheduledAlertTemplate } = await import("@/lib/circle-email-templates");
    const { subject, html } = scheduledAlertTemplate({
      recipientName: recipient.name,
      title: alert.title,
      body: alert.body,
      url: alert.url ?? undefined,
    });
    await enqueueEmail({ to: recipient.email, subject, html, templateKey: "scheduled-alert" });
  }

  // ── Mark delivered — atomic conditional update ────────────────────────────────
  // Fix: use updateMany with a status guard so a concurrent cancelAlert() that
  // ran during delivery cannot be overwritten. If cancellation won the race,
  // the alert stays 'cancelled' and we log a warning instead of ALERT_SENT.
  const updated = await prisma.scheduledAlert.updateMany({
    where: { id: alertId, status: { notIn: ["cancelled", "failed"] } },
    data: { status: "sent", sentAt: now },
  });

  if (updated.count === 0) {
    console.warn(`[ALERT] ${alertId} — delivered but could not mark sent (concurrent cancellation?). Notification was sent.`);
    return;
  }

  await logActivity({
    eventType: "ALERT_SENT",
    userId: alert.createdById ?? recipient.id,
    meta: JSON.stringify({ alertId, type: alert.type, recipientId: recipient.id }),
  });

  console.log(`[ALERT] Delivered ${alertId} (${alert.type}) to user ${recipient.id}`);
}

// Called when a send-scheduled-alert job exhausts all retry attempts.
export async function markAlertFailed(
  payload: JobPayloads["send-scheduled-alert"]
): Promise<void> {
  const { alertId } = payload;

  const updated = await prisma.scheduledAlert.updateMany({
    where: { id: alertId, status: { not: "sent" } },
    data: { status: "failed" },
  });

  if (updated.count === 0) return;

  const alert = await prisma.scheduledAlert.findUnique({
    where: { id: alertId },
    select: { type: true, recipientId: true, createdById: true },
  });

  if (!alert) return;

  await logActivity({
    eventType: "ALERT_FAILED",
    userId: alert.createdById ?? alert.recipientId,
    meta: JSON.stringify({ alertId, type: alert.type, recipientId: alert.recipientId }),
  });

  console.error(`[ALERT] Alert ${alertId} (${alert.type}) exhausted retries — marked failed`);
}