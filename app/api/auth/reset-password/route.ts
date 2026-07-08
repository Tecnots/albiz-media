import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/app/lib/auth-crypto";
import { writeAuditLog, extractIp } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = extractIp(request) ?? "unknown";
  const ipLimit = await rateLimit(`reset-password:ip:${ip}`, 5, 15 * 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((ipLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { resetPasswordToken: token } });

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  if (user.resetPasswordTokenExpiry && user.resetPasswordTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Reset link has expired" }, { status: 400 });
  }

  const hashed = await hashPassword(password);

  // Atomically update password + increment sessionVersion to invalidate all existing JWTs
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetPasswordToken: null,
      resetPasswordTokenExpiry: null,
      sessionVersion: { increment: 1 },
    },
  });

  writeAuditLog({ action: "AUTH_PASSWORD_CHANGE", actorId: user.id, targetId: user.id, targetType: "user", meta: { via: "reset_token" } });

  return NextResponse.json({ success: true });
}
