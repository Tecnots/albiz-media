import { NextRequest, NextResponse } from "next/server";

// Temporary in-memory storage for notification preferences
// In production, you should add notificationPreferences field to User model and use Prisma
const notificationStore = new Map<number, any>();

export async function POST(request: NextRequest) {
  try {
    const { userId, notifications } = await request.json();

    if (!userId || !notifications) {
      return NextResponse.json({ error: "Missing userId or notifications" }, { status: 400 });
    }

    // Store in memory (temporary solution)
    notificationStore.set(userId, notifications);

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

    // Return stored preferences or defaults
    const stored = notificationStore.get(userId);

    return NextResponse.json({
      notifications: stored || {
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
