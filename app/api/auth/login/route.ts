import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.password !== password) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
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
  });
}
