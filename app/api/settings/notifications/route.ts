import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

const defaultPrefs = {
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
    circleApproved: true,
    circleDeclined: true,
  },
};

export async function GET(request: NextRequest) {
  try {
    const userId = Number(request.nextUrl.searchParams.get("userId"));
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    const prefs = (user?.notificationPrefs as typeof defaultPrefs | null) ?? defaultPrefs;

    return NextResponse.json({ notifications: prefs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const { userId, notifications } = await request.json();
    if (!userId || !notifications) {
      return NextResponse.json({ error: "Missing userId or notifications" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: notifications },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
