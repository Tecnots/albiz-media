import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET — list all connected social accounts for a user
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const userId = Number(request.nextUrl.searchParams.get("userId") ?? authUser.id);
  if (authUser.id !== userId) return unauthorized();

  try {
    const connections = await prisma.socialConnection.findMany({
      where: { userId: authUser.id },
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
    return NextResponse.json({ connections: [], error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — disconnect a social account
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { userId, platform } = await request.json();
    if (!platform || (userId && authUser.id !== userId)) {
      return NextResponse.json({ error: "Invalid request or unauthorized" }, { status: 400 });
    }

    await prisma.socialConnection.updateMany({
      where: { userId: authUser.id, platform },
      data: { active: false, accessToken: "", refreshToken: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
