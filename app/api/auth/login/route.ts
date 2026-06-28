import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/app/lib/auth-crypto";
import { logActivity } from "@/lib/activity-logger";

export async function POST(request: Request) {
  const { email, password, name } = await request.json();

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // If not found by email, check if it's a deactivated account by originalEmail
  if (!user) {
    user = await prisma.user.findFirst({ where: { originalEmail: normalizedEmail } });
  }

  if (user) {
    // Existing user — verify password
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (user.banned) {
      return NextResponse.json({ error: "Your account email is banned, try another email" }, { status: 403 });
    }

    // Check if account is deactivated - allow immediate reactivation on sign-in
    if (user.deactivatedAt) {
      // Clear deactivation and restore original email
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.originalEmail || user.email,
          originalEmail: null,
          deactivatedAt: null,
          reactivationDate: null,
        },
      });
      logActivity({ eventType: "REACTIVATE", userId: user.id, userName: user.name, handle: user.handle, avatar: user.avatar || undefined });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json({ 
        error: "Your account is not verified. Please check your email and verify your account to sign in.",
        requiresVerification: true,
        email: user.email
      }, { status: 403 });
    }

    // Log sign-in
    logActivity({ eventType: "SIGNIN", userId: user.id, userName: user.name, handle: user.handle, avatar: user.avatar || undefined });

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
