import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/email";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "Please verify your email before signing in", requiresVerification: true, email },
      { status: 403 }
    );
  }

  if (user.banned) {
    return NextResponse.json({ error: "This account has been suspended" }, { status: 403 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    handle: user.handle,
    role: user.role,
    avatar: user.avatar,
    title: user.title,
    verified: user.verified,
    isPremium: user.isPremium,
    canPost: user.canPost,
  });
}
