import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

const TYPING_TIMEOUT_MS = 3000;

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { searchParams } = req.nextUrl;
  const userId = authUser.id;
  const since = searchParams.get("since");
  const search = searchParams.get("search")?.trim().toLowerCase() || "";

  const whereClause: any = {
    participantId: userId,
  };
  if (since) {
    whereClause.updatedAt = { gt: new Date(since) };
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    include: {
      messages: { orderBy: { id: "asc" }, take: 50 },
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

  // Sort by most recent message
  conversations.sort((a, b) => {
    const aMax = a.messages.length ? a.messages[a.messages.length - 1].id : 0;
    const bMax = b.messages.length ? b.messages[b.messages.length - 1].id : 0;
    return bMax - aMax;
  });

  const now = Date.now();

  // Collect all undelivered message IDs across all conversations in one pass,
  // then fire a single updateMany instead of one per conversation (H-14).
  const allUndeliveredIds: number[] = [];
  for (const conv of conversations) {
    const otherUserId = conv.userId;
    for (const m of conv.messages) {
      if (m.senderId === otherUserId && m.status === "sent") allUndeliveredIds.push(m.id);
    }
  }
  if (allUndeliveredIds.length > 0) {
    await prisma.message.updateMany({
      where: { id: { in: allUndeliveredIds } },
      data: { status: "delivered" },
    });
    const deliveredSet = new Set(allUndeliveredIds);
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (deliveredSet.has(msg.id)) (msg as Record<string, unknown>).status = "delivered";
      }
    }
  }

  for (const conv of conversations) {
    // Typing indicator: clear if expired
    if (
      conv.typingAt &&
      now - new Date(conv.typingAt).getTime() < TYPING_TIMEOUT_MS
    ) {
      // keep typingUserId as-is
    } else {
      (conv as Record<string, unknown>).typingUserId = null;
      (conv as Record<string, unknown>).typingAt = null;
    }

    // Resolve media URLs
    if (conv.user) {
      conv.user.avatar = blobStorageService.resolveMediaUrl(conv.user.avatar) ?? conv.user.avatar;
    }
    for (const msg of conv.messages) {
      if (msg.attachmentUrl) {
        msg.attachmentUrl = blobStorageService.resolveMediaUrl(msg.attachmentUrl) ?? msg.attachmentUrl;
      }
    }
  }

  // Filter by search query if provided
  let filtered = conversations;
  if (search) {
    filtered = conversations.filter((conv) => {
      const userName = (conv.user?.name || "").toLowerCase();
      const userHandle = (conv.user?.handle || "").toLowerCase();
      if (userName.includes(search) || userHandle.includes(search)) return true;
      // Only search plaintext messages; encrypted ones are searched client-side
      return conv.messages.some((m) => !m.encrypted && m.text.toLowerCase().includes(search));
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
    const {
      toUserId, text, encrypted, iv,
      msgIndex, ratchetPublicKey,
      storyImage, attachmentUrl, attachmentType, attachmentName, attachmentSize,
    } = await req.json();
    if (!toUserId || (!text && !attachmentUrl)) {
      return NextResponse.json(
        { error: "Missing toUserId or content" },
        { status: 400 }
      );
    }

    const senderId = authUser.id;
    if (toUserId === senderId) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }

    // Verify recipient is CIRCLE or ADMIN and not banned
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

    const isEncrypted = encrypted ?? false;

    const messageText = storyImage
      ? JSON.stringify({ type: "story_reply", storyImage, text })
      : text;

    const timeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Preview text shown in conversation list and notifications.
    // NEVER expose ciphertext — use a generic placeholder for encrypted messages.
    const previewText = isEncrypted ? "" : (text || "");
    const notifPreview = isEncrypted ? "Encrypted message" : (text?.slice(0, 80) ?? "");
    const pushBody = isEncrypted
      ? "Sent you an encrypted message"
      : (text?.slice(0, 100) || "Sent an attachment");

    const attachData = attachmentUrl ? {
      attachmentUrl,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
      attachmentSize: attachmentSize ? Number(attachmentSize) : null,
    } : {};

    const ratchetData = isEncrypted ? {
      msgIndex:         typeof msgIndex === "number" ? msgIndex : 0,
      ratchetPublicKey: ratchetPublicKey ?? null,
    } : {};

    const msgCreatedAt = new Date();

    // Wrap all 6 writes in a single transaction — a partial failure cannot corrupt the conversation pair (H-8)
    const { senderConvo, recipientConvo, senderMsg } = await prisma.$transaction(async (tx) => {
      // Find or create SENDER's conversation view (participantId = sender, userId = recipient)
      let senderConvo = await tx.conversation.findFirst({
        where: { participantId: senderId, userId: toUserId },
      });
      if (!senderConvo) {
        senderConvo = await tx.conversation.create({
          data: {
            participantId: senderId,
            userId: toUserId,
            lastMessage: previewText,
            time: timeStr,
            unreadCount: 0,
            online: false,
          },
        });
      }

      // Find or create RECIPIENT's conversation view (participantId = recipient, userId = sender)
      let recipientConvo = await tx.conversation.findFirst({
        where: { participantId: toUserId, userId: senderId },
      });
      if (!recipientConvo) {
        recipientConvo = await tx.conversation.create({
          data: {
            participantId: toUserId,
            userId: senderId,
            lastMessage: previewText,
            time: timeStr,
            unreadCount: 0,
            online: false,
          },
        });
      }

      // Create message in SENDER's conversation (fromMe = true)
      const senderMsg = await tx.message.create({
        data: {
          conversationId: senderConvo.id,
          fromMe: true,
          text: messageText,
          time: timeStr,
          senderId,
          status: "sent",
          encrypted: isEncrypted,
          iv: iv ?? null,
          createdAt: msgCreatedAt,
          ...ratchetData,
          ...attachData,
        },
      });

      // Create message in RECIPIENT's conversation (fromMe = false)
      await tx.message.create({
        data: {
          conversationId: recipientConvo.id,
          fromMe: false,
          text: messageText,
          time: timeStr,
          senderId,
          status: "sent",
          encrypted: isEncrypted,
          iv: iv ?? null,
          createdAt: msgCreatedAt,
          ...ratchetData,
          ...attachData,
        },
      });

      // Update both conversation previews — ciphertext never stored as lastMessage
      await tx.conversation.update({
        where: { id: senderConvo.id },
        data: { lastMessage: previewText, time: timeStr },
      });
      await tx.conversation.update({
        where: { id: recipientConvo.id },
        data: {
          lastMessage: previewText,
          time: timeStr,
          unreadCount: { increment: 1 },
        },
      });

      return { senderConvo, recipientConvo, senderMsg };
    });

    // Push notification — respects user push.messages pref
    try {
      const recipientUser = await prisma.user.findUnique({
        where: { id: toUserId },
        select: { name: true, avatar: true, notificationPrefs: true },
      });
      const pushEnabled = (recipientUser?.notificationPrefs as any)?.push?.messages ?? true;
      if (pushEnabled) {
        await prisma.$executeRaw`
          INSERT INTO "Notification" (type, "userId", "recipientId", time, "group", unread, "postPreview", "postImage")
          VALUES ('MESSAGE', ${senderId}, ${toUserId}, NOW(), 'TODAY', true, ${notifPreview}, '')
          ON CONFLICT (type, "userId", "recipientId", "postId")
          DO UPDATE SET time = NOW(), unread = true, "postPreview" = ${notifPreview}
        `;

        const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true, avatar: true } });
        if (sender) {
          const { sendPushToUser } = await import("@/lib/fcm-send");
          sendPushToUser(toUserId, {
            title: `New message from ${sender.name}`,
            body: pushBody,
            url: `/messages`,
            icon: sender.avatar || undefined,
          }).catch((err) => console.error("Push DM err:", err));
        }
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

// PATCH: Mark conversation as read
export async function PATCH(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { conversationId } = await req.json();
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const currentUserId = authUser.id;

  // Verify the authenticated user owns this conversation (IDOR fix)
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, participantId: currentUserId },
    select: { id: true, userId: true, participantId: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Reflect the "read" status in the sender's own conversation view
  if (!conv.participantId) {
    return NextResponse.json({ ok: true });
  }
  const otherConvo = await prisma.conversation.findFirst({
    where: { participantId: conv.userId, userId: conv.participantId },
    select: { id: true },
  });

  // Reset the unread count and mark every unread message "read" atomically —
  // a partial write here (e.g. process crash between statements) would let
  // unreadCount and Message.status drift out of sync with no way to self-heal,
  // since neither is ever recomputed live from the other.
  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    }),
    // Mark all messages from the OTHER user in this view as "read"
    prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: currentUserId },
        status: { not: "read" },
      },
      data: { status: "read" },
    }),
    ...(otherConvo ? [
      prisma.message.updateMany({
        where: {
          conversationId: otherConvo.id,
          fromMe: true,
          status: { not: "read" },
        },
        data: { status: "read" },
      }),
    ] : []),
  ]);

  return NextResponse.json({ ok: true });
}

// PUT: Toggle encryption on a conversation
export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { conversationId, encryptionEnabled } = await req.json();
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // Verify the authenticated user owns this conversation (IDOR fix)
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, participantId: authUser.id },
    select: { id: true, userId: true, participantId: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find the mirror conversation (other participant's view of the same thread)
  const mirror = await prisma.conversation.findFirst({
    where: { participantId: conv.userId, userId: conv.participantId ?? 0 },
    select: { id: true },
  });

  // Update both conversation records atomically so both participants always
  // see a consistent encryption state
  const encValue = encryptionEnabled ?? false;
  if (mirror) {
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { encryptionEnabled: encValue },
      }),
      prisma.conversation.update({
        where: { id: mirror.id },
        data: { encryptionEnabled: encValue },
      }),
    ]);
  } else {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { encryptionEnabled: encValue },
    });
  }

  return NextResponse.json({ ok: true });
}
