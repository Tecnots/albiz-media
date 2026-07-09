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
    marketing: true,
  },
};

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();

    const userId = Number(request.nextUrl.searchParams.get("userId"));
    if (!userId || authUser.id !== userId) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { notificationPrefs: true },
    });

    const stored = (user?.notificationPrefs as Partial<typeof defaultPrefs> | null) ?? {};
    // Merge with defaults so categories added after a user last saved their
    // preferences (e.g. "marketing") come back with a sane default instead
    // of undefined.
    const prefs = {
      push: { ...defaultPrefs.push, ...stored.push },
      email: { ...defaultPrefs.email, ...stored.email },
    };

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
    if (!userId || !notifications || authUser.id !== userId) {
      return NextResponse.json({ error: "Missing or invalid userId or notifications" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: { notificationPrefs: notifications },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
