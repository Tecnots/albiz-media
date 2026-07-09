import { ServerClient, Models } from "postmark";
import { convert } from "html-to-text";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/job-queue";

// ─── Postmark client ─────────────────────────────────────────────────────────

let client: ServerClient | null = null;
function getClient(): ServerClient {
  if (!client) {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) throw new Error("POSTMARK_SERVER_TOKEN is not configured");
    client = new ServerClient(token);
  }
  return client;
}

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { email: true },
  });
  return !!row;
}

// ─── Low-level send ───────────────────────────────────────────────────────────
// Shared by the immediate transactional path (sendEmail) and the retry-queue
// worker (lib/workers/email-worker.ts) — this is the only place that talks to
// Postmark, so suppression checks and stream/header defaults apply everywhere.

export interface RawSendOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  stream?: "outbound" | "broadcast";
  headers?: Record<string, string>;
  tag?: string;
}

export async function sendViaPostmark(opts: RawSendOptions): Promise<void> {
  if (await isSuppressed(opts.to)) {
    console.warn(`[EMAIL] Skipped send — recipient is on the suppression list`);
    return;
  }

  const fromName = process.env.EMAIL_FROM_NAME ?? "Albiz";
  const fromEmail = process.env.EMAIL_FROM!;
  const text = convert(opts.html, { wordwrap: 130 });

  const info = await getClient().sendEmail({
    From: `${fromName} <${fromEmail}>`,
    To: opts.to,
    Subject: opts.subject,
    HtmlBody: opts.html,
    TextBody: text,
    ReplyTo: opts.replyTo,
    MessageStream:
      opts.stream === "broadcast" ? process.env.POSTMARK_BROADCAST_STREAM ?? "broadcast" : "outbound",
    TrackLinks: Models.LinkTrackingOptions.None,
    Tag: opts.tag,
    Headers: opts.headers
      ? Object.entries(opts.headers).map(([Name, Value]) => ({ Name, Value }))
      : undefined,
  });

  console.log(`[EMAIL SUCCESS] Sent to recipient. MessageID: ${info.MessageID}`);
}

// ─── Transactional send (signup/verify/reset/2FA/invite) ─────────────────────
// Creates an EmailLog row up front, attempts delivery immediately for low
// latency, and — only if that immediate attempt fails — falls back to the
// job queue so the per-minute cron retries it with backoff. Never throws:
// callers already treat email delivery as best-effort and must not block
// the surrounding request (e.g. account creation) on SMTP/API errors.

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  templateKey: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, templateKey, replyTo }: SendEmailOptions): Promise<void> {
  const log = await prisma.emailLog
    .create({ data: { to, subject, templateKey, status: "queued" }, select: { id: true } })
    .catch(() => null);

  try {
    await sendViaPostmark({ to, subject, html, replyTo, stream: "outbound", tag: templateKey });
    if (log) {
      await prisma.emailLog
        .update({ where: { id: log.id }, data: { status: "sent", sentAt: new Date() } })
        .catch(() => {});
    }
  } catch (error) {
    console.error(`[EMAIL ERROR] Immediate send failed for "${templateKey}", queuing retry:`, error);
    if (log) {
      await enqueue("send-email", { to, subject, html, templateKey, logId: log.id }).catch(() => {});
    } else {
      // No EmailLog row (DB was down) — nothing to retry against, surface the error.
      throw error;
    }
  }
}
