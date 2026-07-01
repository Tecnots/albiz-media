import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || !authUser.id) {
      return unauthorized();
    }

    const body = await request.json();
    const userId = Number(body.userId);
    const { reactivationDate } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Strict ownership validation: user can only deactivate their own account (or admin)
    if (authUser.id !== userId && authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!reactivationDate) {
      return NextResponse.json({ error: "Reactivation date is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tempEmail = `deactivated_${Date.now()}_${userId}@temp.com`;

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: tempEmail,
        originalEmail: user.email,
        deactivatedAt: new Date(),
        reactivationDate: new Date(reactivationDate),
      },
    });

    logActivity({ eventType: "DEACTIVATE", userId: user.id, userName: user.name, handle: user.handle, avatar: user.avatar || undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating account:", error);
    return NextResponse.json({ error: "Failed to deactivate account" }, { status: 500 });
  }
}
