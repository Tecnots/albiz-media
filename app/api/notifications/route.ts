import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json([]);

  const recipientId = authUser.id;

  const notifications = await prisma.notification.findMany({
    where: { recipientId },
    orderBy: { id: 'asc' }
  });

  const transformed = notifications.map(n => ({
    id: n.id,
    type: n.type.toLowerCase(),
    userId: n.userId,
    time: n.time,
    group: n.group,
    unread: n.unread,
    postPreview: n.postPreview,
    postImage: n.postImage,
    postId: n.postId,
    message: n.message,
  }));

  return NextResponse.json(transformed);
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  try {
    const body = await request.json();
    const userId = authUser.id;

    if (body.action === "mark_all_read") {
      // Only mark the current user's notifications as read
      if (userId) {
        await prisma.$executeRaw`UPDATE "Notification" SET unread = false WHERE "recipientId" = ${userId} AND unread = true`;
      } else {
        await prisma.$executeRaw`UPDATE "Notification" SET unread = false WHERE unread = true`;
      }
    } else if (body.ids?.length) {
      const ids = body.ids as number[];
      await prisma.$executeRaw`UPDATE "Notification" SET unread = false WHERE id = ANY(${ids}::int[])`;
    } else {
      return NextResponse.json({ error: "Provide action or ids" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
