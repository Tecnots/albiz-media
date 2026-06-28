import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/app/lib/auth-crypto";
import { sendEmail } from "@/app/lib/email";
import { resetPasswordTemplate } from "@/app/lib/email-templates";

export async function POST(request: Request) {
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
  await sendEmail({ to: email, subject, html });

  return NextResponse.json({ success: true });
}
