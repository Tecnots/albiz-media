import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken, sendEmail } from "@/app/lib/email";
import { verifyEmailTemplate } from "@/app/lib/email-templates";
import { logActivity } from "@/lib/activity-logger";
import { notifyAdmin } from "@/lib/admin-notifier";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.banned) {
        return NextResponse.json({ error: "Your account email is banned, try another email" }, { status: 403 });
      }
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const handle = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20);

    // Ensure unique handle
    let finalHandle = handle || "user";
    const taken = await prisma.user.findUnique({ where: { handle: finalHandle } });
    if (taken) finalHandle = `${finalHandle}${Date.now() % 10000}`;

    const hashed = await hashPassword(password);
    const token = generateToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Use aggregate to find max ID since it's not autoincrement in schema
    const maxId = await prisma.user.aggregate({ _max: { id: true } });
    const newId = (maxId._max.id ?? 0) + 1;

    await prisma.user.create({
      data: {
        id: newId,
        name: name.trim(),
        email,
        handle: finalHandle,
        password: hashed,
        title: "",
        avatar: "",
        verificationToken: token,
        verificationTokenExpiry: expiry,
      },
    });

    // Log signup activity
    logActivity({ eventType: "SIGNUP", userId: newId, userName: name.trim(), handle: finalHandle });

    // Notify admin
    notifyAdmin({
      type: "NEW_USER",
      title: "New user registered",
      message: `${name.trim()} (@${finalHandle}) joined Albiz Media`,
      metadata: { userId: newId, email, handle: finalHandle },
    });

    // Try to send email but don't block signup if it fails (e.g. SMTP auth error)
    try {
      const { subject, html } = verifyEmailTemplate({ name: name.trim(), token });
      await sendEmail({ to: email, subject, html });
    } catch (emailError: any) {
      console.error("[SIGNUP] Email service failed:", emailError.message || emailError);
      // We return success anyway because the user account was created in the database.
      // This prevents the "Connection error" on frontend when SMTP credentials are invalid.
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[SIGNUP ERROR]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during signup" },
      { status: 500 }
    );
  }
}
