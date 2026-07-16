import { prisma } from "@/lib/prisma";
import { sendRawEmail } from "@/lib/workers/email-worker";
import { campaignEmailTemplate } from "@/lib/circle-email-templates";
import { logActivity } from "@/lib/activity-logger";
import { generateUnsubscribeToken } from "@/lib/unsubscribe-token";
import type { JobPayloads } from "@/lib/job-queue";

const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "https://albizmedia.com";

export async function processCampaignEmail(
  payload: JobPayloads["send-campaign-email"]
): Promise<void> {
  const { campaignId, recipientRowId } = payload;

  const recipient = await prisma.emailCampaignRecipient.findUnique({
    where: { id: recipientRowId },
  });

  if (!recipient) {
    console.log(`[CAMPAIGN] No-op for recipient ${recipientRowId} — record not found`);
    return;
  }

  // Idempotency guard: skip if this row was already processed by a prior run.
  if (recipient.status !== "pending") {
    console.log(`[CAMPAIGN] No-op for recipient ${recipientRowId} — status is '${recipient.status}'`);
    return;
  }

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { subject: true, bodyHtml: true, status: true },
  });

  if (!campaign) {
    console.log(`[CAMPAIGN] No-op — campaign ${campaignId} not found`);
    return;
  }

  // Campaign was cancelled while this job was in the queue — skip delivery and
  // mark the recipient row so the counters don't drift.
  if (campaign.status === "cancelled") {
    await prisma.emailCampaignRecipient.updateMany({
      where: { id: recipientRowId, status: "pending" },
      data: { status: "skipped" },
    });
    return;
  }

  // One-click unsubscribe (RFC 8058) — required for Gmail/Yahoo bulk-sender
  // compliance on marketing/broadcast mail. Only buildable for rows tied to a
  // real account (recipient.userId); campaigns are always account-audience
  // sends today, but guard anyway since the column is nullable.
  const unsubscribeUrl = recipient.userId
    ? `${APP_URL}/api/email/unsubscribe?u=${generateUnsubscribeToken(recipient.userId)}`
    : undefined;

  const { subject, html } = campaignEmailTemplate({
    recipientName: recipient.name,
    subject: campaign.subject,
    bodyHtml: campaign.bodyHtml,
    unsubscribeUrl,
  });

  await sendRawEmail(
    recipient.email,
    subject,
    html,
    "broadcast",
    unsubscribeUrl
      ? { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined
  );

  // Conditional update — prevents overwriting a concurrent cancellation that
  // may have flipped this row to 'skipped' between the status check above and now.
  const updated = await prisma.emailCampaignRecipient.updateMany({
    where: { id: recipientRowId, status: "pending" },
    data: { status: "sent", sentAt: new Date() },
  });

  if (updated.count === 0) return; // Concurrent cancellation won the race — skip counter.

  // Atomically increment deliveredCount. When delivered + failed reaches recipientCount,
  // transition the campaign to 'sent' so the UI reflects completion.
  await prisma.$executeRaw`
    UPDATE "EmailCampaign"
    SET
      "deliveredCount" = "deliveredCount" + 1,
      status = CASE
        WHEN "deliveredCount" + 1 + "failedCount" >= "recipientCount" THEN 'sent'
        ELSE status
      END,
      "sentAt" = CASE
        WHEN "deliveredCount" + 1 + "failedCount" >= "recipientCount" AND "sentAt" IS NULL THEN NOW()
        ELSE "sentAt"
      END
    WHERE id = ${campaignId} AND status NOT IN ('cancelled', 'sent')
  `;

  console.log(`[CAMPAIGN] Delivered to ${recipient.email} (campaign ${campaignId})`);
}

// Called when a send-campaign-email job exhausts all retry attempts.
export async function markCampaignRecipientFailed(
  payload: JobPayloads["send-campaign-email"],
  errorMessage: string
): Promise<void> {
  const { campaignId, recipientRowId } = payload;

  const updated = await prisma.emailCampaignRecipient.updateMany({
    where: { id: recipientRowId, status: "pending" },
    data: { status: "failed", error: errorMessage.slice(0, 500) },
  });

  if (updated.count === 0) return;

  await prisma.$executeRaw`
    UPDATE "EmailCampaign"
    SET
      "failedCount" = "failedCount" + 1,
      status = CASE
        WHEN "failedCount" + 1 + "deliveredCount" >= "recipientCount" THEN 'sent'
        ELSE status
      END,
      "sentAt" = CASE
        WHEN "failedCount" + 1 + "deliveredCount" >= "recipientCount" AND "sentAt" IS NULL THEN NOW()
        ELSE "sentAt"
      END
    WHERE id = ${campaignId} AND status NOT IN ('cancelled', 'sent')
  `;

  // Emit CAMPAIGN_FAILED so the audit log has a permanent record of every
  // delivery that exhausted all retries. Fire-and-forget — never blocks delivery path.
  logActivity({
    eventType: "CAMPAIGN_FAILED",
    meta: JSON.stringify({
      campaignId,
      recipientRowId,
      error: errorMessage.slice(0, 200),
    }),
  }).catch(() => {});
}