import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — social inbox for a user
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId") ?? 1);
  const platform = request.nextUrl.searchParams.get("platform") ?? undefined;

  try {
    const connections = await prisma.socialConnection.findMany({
      where: { userId, active: true, ...(platform ? { platform } : {}) },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    const inbox = connections.flatMap(conn =>
      conn.messages.map(msg => ({
        id: msg.id,
        platform: conn.platform,
        platformHandle: conn.platformHandle,
        platformAvatarUrl: conn.platformAvatarUrl,
        fromHandle: msg.fromHandle,
        fromAvatarUrl: msg.fromAvatarUrl,
        text: msg.text,
        attachmentUrl: msg.attachmentUrl,
        read: msg.read,
        createdAt: msg.createdAt,
      }))
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = inbox.filter(m => !m.read).length;

    return NextResponse.json({ messages: inbox, unreadCount });
  } catch (err: unknown) {
    return NextResponse.json({ messages: [], unreadCount: 0, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// PATCH — mark social messages as read
export async function PATCH(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!ids?.length) return NextResponse.json({ ok: true });
    await prisma.socialMessage.updateMany({ where: { id: { in: ids } }, data: { read: true } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
