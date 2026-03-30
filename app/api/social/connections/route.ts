import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — list all connected social accounts for a user
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId") ?? 1);
  try {
    const connections = await prisma.socialConnection.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        platformHandle: true,
        platformAvatarUrl: true,
        active: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ connections });
  } catch (err: unknown) {
    return NextResponse.json({ connections: [], error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// DELETE — disconnect a social account
export async function DELETE(request: NextRequest) {
  try {
    const { userId, platform } = await request.json();
    if (!userId || !platform) return NextResponse.json({ error: "userId and platform required" }, { status: 400 });

    await prisma.socialConnection.updateMany({
      where: { userId, platform },
      data: { active: false, accessToken: "", refreshToken: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
