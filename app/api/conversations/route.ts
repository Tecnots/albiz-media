import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const TYPING_TIMEOUT_MS = 3000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = Number(searchParams.get("userId")) || 0;
  const since = searchParams.get("since");
  const search = searchParams.get("search")?.trim().toLowerCase() || "";

  // Build where clause — scope to this user's conversations
  if (!userId) {
    return NextResponse.json({ conversations: [], serverTime: new Date().toISOString() });
  }

  const whereClause: any = {
    OR: [
      { participantId: userId },
      { participantId: null },
    ],
  };
  if (since) {
    whereClause.updatedAt = { gt: new Date(since) };
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    include: {
      messages: { orderBy: { id: "asc" } },
      user: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatar: true,
          lastSeenAt: true,
          role: true,
          verified: true,
          title: true,
        },
      },
    },
    orderBy: { id: "desc" },
  });

  // Sort by most recent message (highest message id = most recent)
  conversations.sort((a, b) => {
    const aMax = a.messages.length ? a.messages[a.messages.length - 1].id : 0;
    const bMax = b.messages.length ? b.messages[b.messages.length - 1].id : 0;
    return bMax - aMax;
  });

  const now = Date.now();

  // Process each conversation
  for (const conv of conversations) {
    // Typing indicator: only include if within timeout window
    if (
      conv.typingAt &&
      now - new Date(conv.typingAt).getTime() < TYPING_TIMEOUT_MS
    ) {
      // typingUserId stays as-is
    } else {
      (conv as Record<string, unknown>).typingUserId = null;
      (conv as Record<string, unknown>).typingAt = null;
    }

    // Mark messages from the other user as "delivered" if still "sent"
    const otherUserId = conv.userId;
    const undeliveredIds = conv.messages
      .filter((m) => m.senderId === otherUserId && m.status === "sent")
      .map((m) => m.id);

    if (undeliveredIds.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: undeliveredIds } },
        data: { status: "delivered" },
      });
      for (const msg of conv.messages) {
        if (undeliveredIds.includes(msg.id)) {
          (msg as Record<string, unknown>).status = "delivered";
        }
      }
    }

    // Re-sign user avatar if it's an Azure blob
    if (conv.user?.avatar && blobStorageService.isAvailable) {
      const blobName = blobStorageService.extractBlobName(conv.user.avatar);
      if (blobName) conv.user.avatar = blobStorageService.getFileUrl(blobName);
    }

    // Re-sign attachment URLs in messages if they are Azure blobs
    for (const msg of conv.messages) {
      if (msg.attachmentUrl && blobStorageService.isAvailable) {
        const blobName = blobStorageService.extractBlobName(msg.attachmentUrl);
        if (blobName) msg.attachmentUrl = blobStorageService.getFileUrl(blobName);
      }
    }
  }

  // If search is provided, filter conversations by user name or message content
  let filtered = conversations;
  if (search) {
    filtered = conversations.filter((conv) => {
      const userName = (conv.user?.name || "").toLowerCase();
      const userHandle = (conv.user?.handle || "").toLowerCase();
      if (userName.includes(search) || userHandle.includes(search)) return true;
      return conv.messages.some((m) => m.text.toLowerCase().includes(search));
    });
  }

  return NextResponse.json({
    conversations: filtered,
    serverTime: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  // Only CIRCLE and ADMIN users can send messages
  if (authUser.role !== "CIRCLE" && authUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only Circle members can send messages" },
      { status: 403 }
    );
  }

  try {
    const { toUserId, text, encrypted, iv, storyImage, attachmentUrl, attachmentType, attachmentName, attachmentSize } = await req.json();
    if (!toUserId || (!text && !attachmentUrl)) {
      return NextResponse.json(
        { error: "Missing toUserId or content" },
        { status: 400 }
      );
    }

    // Verify recipient is CIRCLE or ADMIN
    const recipient = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { role: true, banned: true },
    });
    if (
      !recipient ||
      recipient.banned ||
      (recipient.role !== "CIRCLE" && recipient.role !== "ADMIN")
    ) {
      return NextResponse.json(
        { error: "Can only message Circle members" },
        { status: 403 }
      );
    }

    const senderId = authUser.id;
    const messageText = storyImage
      ? JSON.stringify({ type: "story_reply", storyImage, text })
      : text;

    const timeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Find or create SENDER's conversation view (participantId = sender, userId = recipient)
    let senderConvo = await prisma.conversation.findFirst({
      where: { participantId: senderId, userId: toUserId },
    });

    if (!senderConvo) {
      const maxId = await prisma.conversation.aggregate({
        _max: { id: true },
      });
      const newId = (maxId._max.id || 0) + 1;
      senderConvo = await prisma.conversation.create({
        data: {
          id: newId,
          participantId: senderId,
          userId: toUserId,
          lastMessage: text,
          time: timeStr,
          unreadCount: 0,
          online: false,
        },
      });
    }

    // Find or create RECIPIENT's conversation view (participantId = recipient, userId = sender)
    let recipientConvo = await prisma.conversation.findFirst({
      where: { participantId: toUserId, userId: senderId },
    });

    if (!recipientConvo) {
      const maxId2 = await prisma.conversation.aggregate({
        _max: { id: true },
      });
      const newId2 = (maxId2._max.id || 0) + 1;
      recipientConvo = await prisma.conversation.create({
        data: {
          id: newId2,
          participantId: toUserId,
          userId: senderId,
          lastMessage: text,
          time: timeStr,
          unreadCount: 0,
          online: false,
        },
      });
    }

    // Create message in SENDER's conversation (fromMe = true)
    const attachData = attachmentUrl ? {
      attachmentUrl,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
      attachmentSize: attachmentSize ? Number(attachmentSize) : null,
    } : {};

    const senderMsg = await prisma.message.create({
      data: {
        conversationId: senderConvo.id,
        fromMe: true,
        text: messageText,
        time: timeStr,
        senderId,
        status: "sent",
        encrypted: encrypted ?? false,
        iv: iv ?? null,
        createdAt: new Date(),
        ...attachData,
      },
    });

    // Create message in RECIPIENT's conversation (fromMe = false)
    await prisma.message.create({
      data: {
        conversationId: recipientConvo.id,
        fromMe: false,
        text: messageText,
        time: timeStr,
        senderId,
        status: "sent",
        encrypted: encrypted ?? false,
        iv: iv ?? null,
        createdAt: new Date(),
        ...attachData,
      },
    });

    // Update both conversation metadata
    await prisma.conversation.update({
      where: { id: senderConvo.id },
      data: { lastMessage: text, time: timeStr },
    });

    await prisma.conversation.update({
      where: { id: recipientConvo.id },
      data: {
        lastMessage: text,
        time: timeStr,
        unreadCount: { increment: 1 },
      },
    });

    // Push notification for recipient (respects push.messages pref)
    try {
      const recipientUser = await prisma.user.findUnique({
        where: { id: toUserId },
        select: { notificationPrefs: true },
      });
      const pushEnabled = (recipientUser?.notificationPrefs as any)?.push?.messages ?? true;
      if (pushEnabled) {
        // Upsert: update time + mark unread if notification already exists for this sender→recipient
        await prisma.$executeRaw`
          INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage")
          VALUES ('MESSAGE', ${senderId}, ${toUserId}, NOW(), 'TODAY', true, ${text?.slice(0, 80) ?? ""}, '')
          ON CONFLICT (type, "userId", "recipientId", "postId")
          DO UPDATE SET time = NOW(), unread = true, "postPreview" = ${text?.slice(0, 80) ?? ""}
        `;
      }
    } catch (notifErr) {
      console.error("Error creating message notification:", notifErr);
    }

    return NextResponse.json({
      ok: true,
      conversationId: senderConvo.id,
      messageId: senderMsg.id,
    });
  } catch (e: any) {
    console.error("POST /conversations error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  const { conversationId } = await req.json();
  if (!conversationId) {
    return NextResponse.json(
      { error: "Missing conversationId" },
      { status: 400 }
    );
  }

  const currentUserId = authUser.id;

  // Reset unread count
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });

  // Mark all messages from the OTHER user as "read"
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: currentUserId },
      status: { not: "read" },
    },
    data: { status: "read" },
  });

  // Also mark messages as "read" in the sender's conversation view
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participantId: true, userId: true },
  });
  if (conv) {
    // Find the other user's conversation view of this same pair
    const otherConvo = await prisma.conversation.findFirst({
      where: { participantId: conv.userId, userId: conv.participantId ?? 0 },
    });
    if (otherConvo) {
      await prisma.message.updateMany({
        where: {
          conversationId: otherConvo.id,
          fromMe: true,
          status: { not: "read" },
        },
        data: { status: "read" },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// PUT: Toggle encryption on a conversation
export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  const { conversationId, encryptionEnabled } = await req.json();
  if (!conversationId)
    return NextResponse.json(
      { error: "Missing conversationId" },
      { status: 400 }
    );

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { encryptionEnabled: encryptionEnabled ?? false },
  });

  return NextResponse.json({ ok: true });
}
