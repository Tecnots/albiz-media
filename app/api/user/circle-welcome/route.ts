import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token?.sub) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(token.sub);

    await prisma.user.update({
      where: { id: userId },
      data: { circleWelcomeSeen: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark circle welcome as seen:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
