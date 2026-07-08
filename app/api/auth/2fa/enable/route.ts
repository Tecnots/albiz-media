import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/app/lib/email";
import { twoFactorCodeTemplate } from "@/app/lib/email-templates";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`2fa-enable:${authUser.id}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "Two-factor authentication is already enabled" }, { status: 400 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEmailCode: code,
      twoFactorEmailCodeExpiry: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const { subject, html } = twoFactorCodeTemplate({ name: user.name, code });
  await sendEmail({ to: user.email, subject, html });

  return NextResponse.json({ sent: true });
}
