import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function PUT(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { avatar } = await request.json();

    if (!avatar || typeof avatar !== "string") {
      return NextResponse.json({ error: "Invalid avatar URL" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: { avatar },
    });

    return NextResponse.json({ avatar: updatedUser.avatar });
  } catch (error: any) {
    console.error("Avatar update error:", error);
    return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 });
  }
}
