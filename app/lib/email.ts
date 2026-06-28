import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import path from "path";

// ─── Mailer ──────────────────────────────────────────────────────────────────

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

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Read logo once at module load. Attached to every email as inline CID so it
// renders reliably in Outlook (and works against localhost in dev where the
// client can't fetch external URLs).
let cachedLogo: Buffer | null | false = null; // false = tried and failed
function getLogoBuffer(): Buffer | null {
  if (cachedLogo === false) return null;
  if (!cachedLogo) {
    try {
      cachedLogo = readFileSync(path.join(process.cwd(), "public", "logo.svg"));
    } catch {
      cachedLogo = false;
      return null;
    }
  }
  return cachedLogo;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const transport = createTransport();
  const fromName = process.env.SMTP_FROM_NAME ?? "Albiz";
  const fromEmail = process.env.SMTP_FROM!;

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      attachments: getLogoBuffer()
        ? [{ filename: "logo.svg", content: getLogoBuffer()!, contentType: "image/svg+xml", cid: "albiz-logo" }]
        : [],
    });
    console.log(`[EMAIL SUCCESS] Sent to ${to}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
    throw error;
  }
}
