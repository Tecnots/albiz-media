import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/app/lib/email";

export async function POST(request: Request) {
  const { email, password, name } = await request.json();

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Existing user — verify password
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
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
      created: false,
    });
  }

  // User doesn't exist - return error
  return NextResponse.json({ error: "No account found with this email. Please sign up first." }, { status: 404 });
}
