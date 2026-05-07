import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/app/lib/email";
import { sendEmail } from "@/app/lib/email";
import { welcomeTemplate } from "@/app/lib/email-templates";

// GET — fetch invite details by token (for the accept page)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const invite = await prisma.userInvite.findUnique({ where: { token } });

  if (!invite || invite.status === "revoked") {
    return NextResponse.json({ error: "This invitation is no longer valid" }, { status: 404 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 400 });
  }

  // Check if this email already has an account
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    name: invite.name,
    hasAccount: !!existingUser,
  });
}

// POST — accept invite (create account or update role)
export async function POST(request: Request) {
  const { token, name, password } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const invite = await prisma.userInvite.findUnique({ where: { token } });

  if (!invite || invite.status === "revoked") {
    return NextResponse.json({ error: "This invitation is no longer valid" }, { status: 404 });
  }
  if (invite.status === "accepted") {
    return NextResponse.json({ error: "This invitation has already been used" }, { status: 400 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

  let userId: number;

  if (existingUser) {
    // Update existing user's role
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: invite.role as "NORMAL" | "CIRCLE" | "AUTHOR" | "ADMIN" },
    });
    userId = existingUser.id;
  } else {
    // Require name + password for new accounts
    if (!name?.trim() || !password) {
      return NextResponse.json({ error: "Name and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const finalName = name.trim();
    let handle = invite.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "user";

    const taken = await prisma.user.findUnique({ where: { handle } });
    if (taken) handle = `${handle}${Date.now() % 10000}`;

    const hashed = await hashPassword(password);
    const maxId = await prisma.user.aggregate({ _max: { id: true } });
    const newId = (maxId._max.id ?? 0) + 1;

    await prisma.user.create({
      data: {
        id: newId,
        name: finalName,
        email: invite.email,
        handle,
        password: hashed,
        title: "",
        avatar: "",
        role: invite.role as "NORMAL" | "CIRCLE" | "AUTHOR" | "ADMIN",
        emailVerified: new Date(),
      },
    });
    userId = newId;

    // Send welcome email
    const { subject, html } = welcomeTemplate({ name: finalName });
    sendEmail({ to: invite.email, subject, html }).catch(() => {});
  }

  // Mark invite as accepted
  await prisma.userInvite.update({
    where: { id: invite.id },
    data: { status: "accepted" },
  });

  // Fetch the user to return session data
  const user = await prisma.user.findUnique({ where: { id: userId } });

  return NextResponse.json({
    success: true,
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      handle: user!.handle,
      role: user!.role,
      avatar: user!.avatar,
      title: user!.title,
      verified: user!.verified,
      isPremium: user!.isPremium,
    },
  });
}
