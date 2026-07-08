import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/auth-crypto";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  // Rate limit: 5 attempts per 15 minutes per user
  const pwLimit = await rateLimit(`verify-password:${authUser.id}`, 5, 15 * 60 * 1000);
  if (!pwLimit.allowed) {
    return NextResponse.json(pwLimit.error, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((pwLimit.resetAt - Date.now()) / 1000)) },
    });
  }

  const { userId, password } = await request.json();

  if (!password || (userId && authUser.id !== userId)) {
    return NextResponse.json({ error: "Password required or unauthorized" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error verifying password:", error);
    return NextResponse.json({ error: "Failed to verify password" }, { status: 500 });
  }
}
