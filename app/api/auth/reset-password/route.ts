import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/app/lib/auth-crypto";

export async function POST(request: Request) {
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

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetPasswordToken: null,
      resetPasswordTokenExpiry: null,
    },
  });

  return NextResponse.json({ success: true });
}
