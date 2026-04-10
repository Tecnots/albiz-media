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

  // User doesn't exist — create them
  const handle = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  let finalHandle = handle || "user";
  const taken = await prisma.user.findUnique({ where: { handle: finalHandle } });
  if (taken) finalHandle = `${finalHandle}${Date.now() % 10000}`;

  const hashed = await hashPassword(password);
  const maxId = await prisma.user.aggregate({ _max: { id: true } });
  const newId = (maxId._max.id ?? 0) + 1;

  user = await prisma.user.create({
    data: {
      id: newId,
      name: (name || email.split("@")[0]).trim(),
      email,
      handle: finalHandle,
      password: hashed,
      title: "",
      avatar: "",
      emailVerified: new Date(),
    },
  });

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
    created: true,
  });
}
