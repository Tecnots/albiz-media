import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const notifications = await prisma.$queryRaw<any[]>`
      SELECT n.id, n.type, n."userId", n."recipientId", n.time, n."group", n.unread, n."postPreview", n."postImage"
      FROM "Notification" n
      ORDER BY n.id DESC
      LIMIT 50
    `;

    return NextResponse.json({ 
      count: notifications.length,
      notifications 
    });
  } catch (err: any) {
    console.error("Debug notifications error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
