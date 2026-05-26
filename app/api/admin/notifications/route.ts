import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const unreadCount = await prisma.adminNotification.count({
      where: { unread: true },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, notifications: [], unreadCount: 0 }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "mark_all_read") {
      await prisma.adminNotification.updateMany({
        where: { unread: true },
        data: { unread: false },
      });
    } else if (body.ids?.length) {
      await prisma.adminNotification.updateMany({
        where: { id: { in: body.ids as number[] } },
        data: { unread: false },
      });
    } else {
      return NextResponse.json({ error: "Provide action or ids" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, title, message, metadata } = body;

    const notification = await prisma.adminNotification.create({
      data: { type, title, message, metadata: metadata ?? undefined },
    });

    return NextResponse.json(notification);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
