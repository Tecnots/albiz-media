import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/app/lib/auth-crypto";
import { sendEmail } from "@/app/lib/email";
import { resetPasswordTemplate } from "@/app/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";
import { extractIp } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const ip = extractIp(request) ?? "unknown";
  const ipLimit = await rateLimit(`forgot-password:ip:${ip}`, 5, 15 * 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((ipLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to avoid user enumeration
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = generateToken();
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken: token, resetPasswordTokenExpiry: expiry },
  });

  const { subject, html } = resetPasswordTemplate({ name: user.name, token });
  await sendEmail({ to: email, subject, html, templateKey: "reset-password" });

  return NextResponse.json({ success: true });
}
