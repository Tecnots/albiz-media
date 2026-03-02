import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const notifications = await prisma.notification.findMany({
    include: { user: true },
    orderBy: { id: "asc" },
  });

  // Transform enums to lowercase to match frontend
  const transformed = notifications.map(n => ({
    id: n.id,
    type: n.type.toLowerCase() as string, // FOLLOW→follow, LIKE→like, etc.
    userId: n.userId,
    time: n.time,
    group: n.group, // stays uppercase: TODAY, YESTERDAY, EARLIER
    unread: n.unread,
    postPreview: n.postPreview,
    postImage: n.postImage,
  }));

  return NextResponse.json(transformed);
}
