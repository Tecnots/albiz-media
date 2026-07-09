import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/app/lib/auth-crypto";
import { sendEmail } from "@/app/lib/email";
import { verifyEmailTemplate } from "@/app/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";
import { extractIp } from "@/lib/audit";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Rate limit both by IP (abuse from one source) and by target email (an
  // attacker cycling IPs to spam a victim's inbox with verification emails —
  // repeated sends to the same address are what tank sender reputation).
  const ip = extractIp(request) ?? "unknown";
  const [ipLimit, emailLimit] = await Promise.all([
    rateLimit(`resend-verification:ip:${ip}`, 5, 15 * 60_000),
    rateLimit(`resend-verification:email:${email.trim().toLowerCase()}`, 3, 15 * 60_000),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const resetAt = Math.max(ipLimit.resetAt, emailLimit.resetAt);
    return NextResponse.json({ error: "Too many requests. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Don't reveal whether account exists
    return NextResponse.json({ success: true });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: "Email is already verified" }, { status: 400 });
  }

  const token = generateToken();
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationToken: token, verificationTokenExpiry: expiry },
  });

  const { subject, html } = verifyEmailTemplate({ name: user.name, token });
  await sendEmail({ to: email, subject, html, templateKey: "verify-email" });

  return NextResponse.json({ success: true });
}
