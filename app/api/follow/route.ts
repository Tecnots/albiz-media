import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    const { followingId } = await request.json();

    console.log("Follow request:", { followerId: authUser.id, followingId });

    if (authUser.id === followingId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    let isNewFollow = false;
    
    try {
      await prisma.userFollow.create({
        data: { followerId: authUser.id, followingId },
      });
      isNewFollow = true;
      console.log("New follow created");
    } catch (err: any) {
      // If unique constraint error, it means already following
      if (err.code === 'P2002') {
        console.log("Already following");
        isNewFollow = false;
      } else {
        throw err;
      }
    }

    // Create notification only if this is a new follow
    if (isNewFollow) {
      try {
        const recipient = await prisma.user.findUnique({
          where: { id: followingId },
          select: { notificationPrefs: true },
        });
        const pushEnabled = (recipient?.notificationPrefs as any)?.push?.follows ?? true;
        if (pushEnabled) {
          await prisma.$executeRaw`
            INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage")
            VALUES ('FOLLOW', ${authUser.id}, ${followingId}, NOW(), 'TODAY', true, '', '')
          `;
        }
      } catch (err) {
        console.error("Error creating follow notification:", err);
      }
    }

    return NextResponse.json({ success: true, action: "followed" });
  } catch (err: any) {
    console.error("Follow endpoint error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  const { followingId } = await request.json();

  await prisma.userFollow.deleteMany({
    where: { followerId: authUser.id, followingId },
  });

  return NextResponse.json({ success: true, action: "unfollowed" });
}
