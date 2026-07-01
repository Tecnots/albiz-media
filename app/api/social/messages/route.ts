import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET — social inbox for the authenticated user
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const platform = request.nextUrl.searchParams.get("platform") ?? undefined;

  try {
    const connections = await prisma.socialConnection.findMany({
      where: { userId: authUser.id, active: true, ...(platform ? { platform } : {}) },
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
    console.error("[GET /api/social/messages]", err);
    return NextResponse.json({ messages: [], unreadCount: 0 }, { status: 500 });
  }
}

// PATCH — mark social messages as read (only messages belonging to the authenticated user)
export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { ids } = await request.json();
    if (!ids?.length) return NextResponse.json({ ok: true });

    // Resolve all connectionIds belonging to this user so only their messages can be updated
    const userConnections = await prisma.socialConnection.findMany({
      where: { userId: authUser.id },
      select: { id: true },
    });
    const connectionIds = userConnections.map(c => c.id);

    await prisma.socialMessage.updateMany({
      where: { id: { in: ids }, connectionId: { in: connectionIds } },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[PATCH /api/social/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
