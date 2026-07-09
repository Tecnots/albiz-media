import { prisma } from "@/lib/prisma";
import { sendViaPostmark } from "@/app/lib/email";
import type { JobPayloads } from "@/lib/job-queue";

// Shared low-level send — used by both processEmailJob and campaign-email-worker.
export async function sendRawEmail(
  to: string,
  subject: string,
  html: string,
  stream: "outbound" | "broadcast" = "outbound",
  headers?: Record<string, string>
): Promise<void> {
  await sendViaPostmark({ to, subject, html, stream, headers });
}

export async function processEmailJob(
  payload: JobPayloads["send-email"]
): Promise<void> {
  await sendRawEmail(payload.to, payload.subject, payload.html);

  if (payload.logId) {
    await prisma.emailLog
      .update({ where: { id: payload.logId }, data: { status: "sent", sentAt: new Date() } })
      .catch(() => {});
  }

  const redacted = payload.to.replace(/^(.{2}).*@/, "$1***@");
  console.log(`[EMAIL] Sent to ${redacted} — ${payload.subject}`);
}

export async function handleEmailJobFailure(
  payload: JobPayloads["send-email"],
  error: string
): Promise<void> {
  if (payload.logId) {
    await prisma.emailLog
      .update({ where: { id: payload.logId }, data: { status: "failed", error: error.slice(0, 1000) } })
      .catch(() => {});
  }
}
