import { createTransport, type Transporter } from "nodemailer";
import { randomUUID } from "crypto";
import { convert } from "html-to-text";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/job-queue";

// ─── SMTP transport (nodemailer) ─────────────────────────────────────────────

let transport: Transporter | null = null;
function getTransport(): Transporter {
  if (!transport) {
    const host = process.env.SMTP_HOST;
    if (!host) throw new Error("SMTP_HOST is not configured");
    transport = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: process.env.SMTP_SECURE !== "false",
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });
  }
  return transport;
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
// the SMTP server, so suppression checks apply everywhere.

export interface RawSendOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  stream?: "outbound" | "broadcast";
  headers?: Record<string, string>;
  tag?: string;
}

export async function sendViaSMTP(opts: RawSendOptions): Promise<void> {
  if (await isSuppressed(opts.to)) {
    console.warn(`[EMAIL] Skipped send — recipient is on the suppression list`);
    return;
  }

  const fromName = process.env.SMTP_FROM_NAME ?? "Albiz";
  const fromEmail = process.env.SMTP_FROM!;
  const fromDomain = fromEmail.split("@")[1] || "albiz.com";
  const text = convert(opts.html, { wordwrap: 130 });

  // Domain-aligned Message-ID improves deliverability by matching SPF/DKIM domain
  const messageId = `<${randomUUID()}@${fromDomain}>`;

  // Build headers for deliverability
  const headers: Record<string, string> = {
    "Message-ID": messageId,
    // List-Unsubscribe signals legitimacy to spam filters even for transactional mail
    "List-Unsubscribe": `<mailto:unsubscribe@${fromDomain}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    // Prevent vacation auto-replies from bouncing back
    "X-Auto-Response-Suppress": "OOF, AutoReply",
    ...(opts.tag ? { "X-Tag": opts.tag } : {}),
    ...(opts.stream ? { "X-Message-Stream": opts.stream } : {}),
    ...(opts.headers || {}),
  };

  const info = await getTransport().sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text,
    replyTo: opts.replyTo,
    headers,
  });

  console.log(`[EMAIL SUCCESS] Sent to recipient. MessageID: ${info.messageId}`);
}

// ─── Transactional send (signup/verify/reset/2FA/invite) ─────────────────────
// Creates an EmailLog row up front, attempts delivery immediately for low
// latency, and — only if that immediate attempt fails — falls back to the
// job queue so the per-minute cron retries it with backoff. Never throws:
// callers already treat email delivery as best-effort and must not block
// the surrounding request (e.g. account creation) on SMTP errors.

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
    await sendViaSMTP({ to, subject, html, replyTo, stream: "outbound", tag: templateKey });
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
      throw error;
    }
  }
}
