import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { userId, notifications } = await request.json();
    
    if (!userId || !notifications) {
      return NextResponse.json({ error: "Missing userId or notifications" }, { status: 400 });
    }

    // Update user's notification preferences in the database
    // Note: You may need to add a notificationPreferences field to your User model in Prisma schema
    // For now, we'll store it as JSON in a separate table or update the User model
    
    // Assuming you add a notificationPreferences JSON field to the User model:
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationPreferences: notifications as any,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Notification settings error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = Number(request.nextUrl.searchParams.get("userId"));
    
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      notifications: user.notificationPreferences || {
        push: {
          posts: true,
          stories: true,
          comments: true,
          likes: true,
          follows: true,
          mentions: true,
          messages: true,
          circlePosts: true,
        },
        email: {
          posts: false,
          stories: false,
          comments: false,
          likes: false,
          follows: true,
          mentions: false,
          circleUpdates: true,
        },
      },
    });
  } catch (e: any) {
    console.error("Get notification settings error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
