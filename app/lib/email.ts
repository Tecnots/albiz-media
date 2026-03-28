import nodemailer from "nodemailer";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

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

// ─── Albiz logo as SVG buffer (CID attachment) ────────────────────────────────

const LOGO_SVG = `<svg width="121" height="104" viewBox="0 0 121 104" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M71.9121 20.311L59.8833 0L9.15527e-05 103.861H23.2838L71.9121 20.311Z" fill="#FF4444"/>
  <path d="M96.0998 62.0821L83.9408 41.9091L47.9848 103.861H71.9121L96.0998 62.0821Z" fill="#FF4444"/>
  <path d="M120.15 103.861L108.381 83.2972L96.0998 103.861H120.15Z" fill="#FF4444"/>
  <path d="M108.058 83.3157L96.1438 62.4531L84.0538 83.3157L96.1438 103.795L108.058 83.3157Z" fill="#AF1212"/>
  <path d="M47.661 62.4531L60.0422 83.3157L47.661 103.795L35.7549 82.5496L47.661 62.4531Z" fill="#AF1212"/>
</svg>`;

const logoBuffer = Buffer.from(LOGO_SVG, "utf8");

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
    tls: { ciphers: "SSLv3" },
  });
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const transport = createTransport();
  const fromName = process.env.SMTP_FROM_NAME ?? "Albiz";
  const fromEmail = process.env.SMTP_FROM!;

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename: "logo.svg",
        content: logoBuffer,
        cid: "albizlogo",
        contentType: "image/svg+xml",
      },
    ],
  });
}
