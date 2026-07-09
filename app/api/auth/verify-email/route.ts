import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/app/lib/email";
import { welcomeTemplate } from "@/app/lib/email-templates";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { verificationToken: token } });

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
  }

  // If already verified, return success (idempotent — handles email client prefetch & duplicate clicks)
  if (user.emailVerified) {
    return NextResponse.json({ success: true, name: user.name, alreadyVerified: true });
  }

  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Verification link has expired" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      // Keep verificationToken so the same link remains valid until expiry.
      // Email clients (Gmail, Outlook safety scanners) often prefetch links;
      // nulling the token here would cause "Link expired" on the user's actual click.
    },
  });

  // Send welcome email (non-blocking)
  const { subject, html } = welcomeTemplate({ name: user.name });
  sendEmail({ to: user.email, subject, html, templateKey: "welcome" }).catch(() => {});

  return NextResponse.json({ success: true, name: user.name });
}
