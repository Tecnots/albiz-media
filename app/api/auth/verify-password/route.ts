import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/auth-crypto";

export async function POST(request: Request) {
  const { userId, password } = await request.json();

  if (!userId || !password) {
    return NextResponse.json({ error: "User ID and password are required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
