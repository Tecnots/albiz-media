import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { JobPayloads } from "@/lib/job-queue";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

let cachedLogo: Buffer | null | false = null;
function getLogoBuffer(): Buffer | null {
  if (cachedLogo === false) return null;
  if (!cachedLogo) {
    try {
      cachedLogo = readFileSync(path.join(process.cwd(), "public", "logo.svg"));
    } catch {
      cachedLogo = false;
    }
  }
  return cachedLogo instanceof Buffer ? cachedLogo : null;
}

// Shared low-level SMTP send — used by both processEmailJob and campaign-email-worker.
export async function sendRawEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured");
  }
  const transport = createTransport();
  const fromName  = process.env.SMTP_FROM_NAME ?? "Albiz";
  const fromEmail = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  const logo      = getLogoBuffer();
  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments: logo
      ? [{ filename: "logo.svg", content: logo, contentType: "image/svg+xml", cid: "albiz-logo" }]
      : [],
  });
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

  console.log(`[EMAIL] Sent to ${payload.to} — ${payload.subject}`);
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