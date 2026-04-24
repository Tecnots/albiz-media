import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, reactivationDate } = body;

    console.log("Deactivate request:", { userId, reactivationDate });

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!reactivationDate) {
      return NextResponse.json({ error: "Reactivation date is required" }, { status: 400 });
    }

    // Check if user exists first
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user to set deactivated status (save original email and change current email)
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deactivated_${Date.now()}_${userId}@temp.com`,
        originalEmail: user.email,
        deactivatedAt: new Date(),
        reactivationDate: new Date(reactivationDate),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating account:", error);
    return NextResponse.json({ error: (error as any).message || "Failed to deactivate account" }, { status: 500 });
  }
}
