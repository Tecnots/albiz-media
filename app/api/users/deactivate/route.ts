import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";

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
      console.error("User not found:", userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("Found user:", { id: user.id, email: user.email });

    const tempEmail = `deactivated_${Date.now()}_${userId}@temp.com`;
    console.log("Setting temp email:", tempEmail);

    // Update user to set deactivated status (save original email and change current email)
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: tempEmail,
          originalEmail: user.email,
          deactivatedAt: new Date(),
          reactivationDate: new Date(reactivationDate),
        },
      });
      console.log("User updated successfully");
    } catch (updateError) {
      console.error("Prisma update error:", updateError);
      throw updateError;
    }

    // Log deactivation
    logActivity({ eventType: "DEACTIVATE", userId: user.id, userName: user.name, handle: user.handle, avatar: user.avatar || undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating account:", error);
    return NextResponse.json({ error: (error as any).message || "Failed to deactivate account" }, { status: 500 });
  }
}
