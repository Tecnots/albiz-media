import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncTwitterMessages } from "@/lib/social-sync";
import { blobStorageService } from "@/lib/blob-storage";

const db = prisma as any;

// GET /api/social/threads?userId=&platform=
// Returns threads grouped by sender, each with the latest message and unread count.
export async function GET(request: NextRequest) {
  const userIdParam = request.nextUrl.searchParams.get("userId");
  const userId = Number(userIdParam ?? 1);
  const platform = request.nextUrl.searchParams.get("platform") ?? undefined;

  if (userIdParam && isNaN(userId)) {
    return NextResponse.json({ threads: [], error: "Invalid userId" }, { status: 400 });
  }

  try {
    const whereConnection = {
      userId,
      active: true,
      ...(platform ? { platform } : {}),
    };

    const sync = request.nextUrl.searchParams.get("sync");
    let syncError: string | null = null;
    if (sync === "true") {
      const connections = await prisma.socialConnection.findMany({
        where: { ...whereConnection, platform: "twitter" },
      });
      // Await sync to ensure database is populated before we fetch threads
      const syncErrors: string[] = [];
      await Promise.all(connections.map(conn => 
        syncTwitterMessages(conn.id, conn.accessToken, conn.platformUserId).catch(err => {
          console.error(`[api/social/threads] sync error for connection ${conn.id}:`, err);
          syncErrors.push(err.message || "Sync failed");
        })
      ));

      if (syncErrors.length > 0) {
        syncError = syncErrors[0];
      }
    }

    const threads = await prisma.socialThread.findMany({
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
      platform: t.platform ?? t.connection.platform,
      platformHandle: t.connection.platformHandle,
      externalUserId: t.externalUserId,
      externalHandle: t.externalHandle,
      externalAvatarUrl: t.externalAvatarUrl,
      lastMessageAt: t.lastMessageAt,
      unreadCount: t.unreadCount,
      lastMessage: t.messages[0] ? { ...t.messages[0], attachmentUrl: blobStorageService.resolveMediaUrl(t.messages[0].attachmentUrl) } : null,
    }));

    return NextResponse.json({ threads: result, syncError });
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
