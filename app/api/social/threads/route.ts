import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

// GET /api/social/threads?userId=&platform=
// Returns threads grouped by sender, each with the latest message and unread count.
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId") ?? 1);
  const platform = request.nextUrl.searchParams.get("platform") ?? undefined;

  try {
    const whereConnection = {
      userId,
      active: true,
      ...(platform ? { platform } : {}),
    };

    const threads = await db.socialThread.findMany({
      where: { connection: whereConnection },
      orderBy: { lastMessageAt: "desc" },
      include: {
        connection: {
          select: {
            id: true,
            platform: true,
            platformHandle: true,
            platformAvatarUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            text: true,
            direction: true,
            createdAt: true,
            attachmentUrl: true,
          },
        },
      },
    });

    const result = threads.map((t: any) => ({
      id: t.id,
      connectionId: t.connectionId,
      platform: t.connection.platform,
      platformHandle: t.connection.platformHandle,
      externalUserId: t.externalUserId,
      externalHandle: t.externalHandle,
      externalAvatarUrl: t.externalAvatarUrl,
      lastMessageAt: t.lastMessageAt,
      unreadCount: t.unreadCount,
      lastMessage: t.messages[0] ?? null,
    }));

    return NextResponse.json({ threads: result });
  } catch (err: unknown) {
    return NextResponse.json(
      { threads: [], error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

// GET /api/social/threads/[id]/messages — thread messages
export async function POST(request: NextRequest) {
  // Mark a thread as read
  try {
    const { threadId } = await request.json();
    if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });
    await db.socialThread.update({
      where: { id: Number(threadId) },
      data: { unreadCount: 0 },
    });
    await db.socialMessage.updateMany({
      where: { threadId: Number(threadId) },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
