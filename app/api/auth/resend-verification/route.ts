import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/app/lib/auth-crypto";
import { sendEmail } from "@/app/lib/email";
import { verifyEmailTemplate } from "@/app/lib/email-templates";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
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
  await sendEmail({ to: email, subject, html });

  return NextResponse.json({ success: true });
}
