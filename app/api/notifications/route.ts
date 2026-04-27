import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const recipientId = Number(request.nextUrl.searchParams.get("userId")) || 0;

  console.log("Notifications GET request for recipientId:", recipientId);

  // Filter notifications by recipient — each user only sees their own
  const rows = recipientId
    ? await prisma.$queryRaw<any[]>`
        SELECT n.id, n.type, n."userId", n."recipientId", n.time, n."group", n.unread, n."postPreview", n."postImage"
        FROM "Notification" n
        WHERE n."recipientId" = ${recipientId}
        ORDER BY n.id ASC
      `
    : await prisma.$queryRaw<any[]>`
        SELECT n.id, n.type, n."userId", n."recipientId", n.time, n."group", n.unread, n."postPreview", n."postImage"
        FROM "Notification" n
        ORDER BY n.id ASC
      `;

  const transformed = rows.map(n => ({
    id: n.id,
    type: n.type.toLowerCase() as string,
    userId: n.userId,
    time: n.time,
    group: n.group,
    unread: n.unread,
    postPreview: n.postPreview,
    postImage: n.postImage,
    postId: n.postId,
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
