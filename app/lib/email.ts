import nodemailer from "nodemailer";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { readFileSync } from "fs";
import path from "path";

const scryptAsync = promisify(scrypt);

// ─── Password hashing ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  // Legacy: plaintext passwords from demo seed (no dot separator format)
  if (!stored.includes(".")) return password === stored;
  const [hash, salt] = stored.split(".");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(hash, "hex");
  if (buf.length !== storedBuf.length) return false;
  return timingSafeEqual(buf, storedBuf);
}

// ─── Token generation ────────────────────────────────────────────────────────

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

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
let cachedLogo: Buffer | null = null;
function getLogoBuffer(): Buffer {
  if (!cachedLogo) {
    cachedLogo = readFileSync(path.join(process.cwd(), "public", "logo.svg"));
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
      attachments: [
        {
          filename: "logo.svg",
          content: getLogoBuffer(),
          contentType: "image/svg+xml",
          cid: "albiz-logo",
        },
      ],
    });
    console.log(`[EMAIL SUCCESS] Sent to ${to}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
    throw error;
  }
}
