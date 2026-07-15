import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { messagePreview } from "@/lib/message-preview";

const TYPING_TIMEOUT_MS = 3000;

// How many of the newest messages to return per conversation on each poll.
// Older history is fetched on demand via GET /api/conversations/[id]/messages.
const MESSAGE_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const { searchParams } = req.nextUrl;
  const userId = authUser.id;
  const since = searchParams.get("since");

  // Capture the cursor BEFORE querying so any write that commits during this
  // request is picked up by the next poll (at-least-once, never missed).
  const serverTime = new Date().toISOString();

  const whereClause: any = {
    participantId: userId,
  };
  if (since) {
    const sinceDate = new Date(since);
    // Return a conversation when EITHER its own row changed (new message,
    // preview, unread, typing, encryption) OR any of its messages changed
    // (edit, delete, delivered, read). The message-level clause is what makes
    // status/edit/delete propagate without depending on Conversation.updatedAt.
    whereClause.OR = [
      { updatedAt: { gt: sinceDate } },
      { messages: { some: { updatedAt: { gt: sinceDate } } } },
    ];
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    include: {
      // Newest-first from the DB, reversed to ascending below for rendering.
      messages: { orderBy: { id: "desc" }, take: MESSAGE_PAGE_SIZE },
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

  // Restore ascending (oldest→newest) order for the client, and expose whether
  // an older page exists (a full page implies there may be more history).
  for (const conv of conversations) {
    (conv as Record<string, unknown>).hasMoreMessages = conv.messages.length >= MESSAGE_PAGE_SIZE;
    conv.messages.reverse();
  }

  // Sort by most recent message
  conversations.sort((a, b) => {
    const aMax = a.messages.length ? a.messages[a.messages.length - 1].id : 0;
    const bMax = b.messages.length ? b.messages[b.messages.length - 1].id : 0;
    return bMax - aMax;
  });

  const now = Date.now();

  // Delivery receipts: when the recipient fetches, every still-"sent" message
  // the OTHER user sent becomes "delivered". Mark both the recipient's copy
  // (what we return here) AND the sender's mirror copy (matched by createdAt,
  // which is unique per send) so the sender's own view can show "delivered".
  const allUndeliveredIds: number[] = [];
  const deliveredCreatedAts: Date[] = [];
  for (const conv of conversations) {
    const otherUserId = conv.userId;
    for (const m of conv.messages) {
      if (m.senderId === otherUserId && m.status === "sent") {
        allUndeliveredIds.push(m.id);
        deliveredCreatedAts.push(m.createdAt);
      }
    }
  }
  if (allUndeliveredIds.length > 0) {
    await prisma.$transaction([
      prisma.message.updateMany({
        where: { id: { in: allUndeliveredIds } },
        data: { status: "delivered" },
      }),
      // Sender's mirror copy (fromMe = true, same createdAt). The status guard
      // prevents downgrading a message the sender has already seen read.
      prisma.message.updateMany({
        where: {
          fromMe: true,
          status: "sent",
          createdAt: { in: deliveredCreatedAts },
        },
        data: { status: "delivered" },
      }),
    ]);
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

  return NextResponse.json({
    conversations,
    serverTime,
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

    // Preview text shown in conversation list and notifications. Attachments
    // (incl. voice messages) resolve to a readable label; ciphertext never
    // surfaces for encrypted messages.
    const preview = messagePreview({ text, encrypted: isEncrypted, attachmentType, attachmentName, attachmentUrl });
    const previewText = preview;
    const notifPreview = isEncrypted ? "Encrypted message" : preview.slice(0, 80);
    const pushBody = isEncrypted
      ? "Sent you an encrypted message"
      : (preview.slice(0, 100) || "Sent an attachment");

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

    // Wrap all writes in a single transaction — a partial failure cannot corrupt
    // the conversation pair (H-8). Both views are created via upsert on the
    // (participantId, userId) unique key, so concurrent first-messages or
    // multi-device sends can never produce a duplicate thread (C-1).
    const { senderConvo, recipientConvo, senderMsg } = await prisma.$transaction(async (tx) => {
      // SENDER's view (participantId = sender, userId = recipient).
      const senderConvo = await tx.conversation.upsert({
        where: { participantId_userId: { participantId: senderId, userId: toUserId } },
        create: {
          participantId: senderId,
          userId: toUserId,
          lastMessage: previewText,
          time: timeStr,
          unreadCount: 0,
          online: false,
        },
        // Do NOT touch typing here: this row's typing marker belongs to the
        // OTHER user typing to the sender, which sending a message must not clear.
        update: { lastMessage: previewText, time: timeStr },
      });

      // RECIPIENT's view (participantId = recipient, userId = sender). A new
      // inbound message bumps unread and clears the sender's own typing marker
      // (which lives on THIS row) — typing stops the instant a message lands (T-1).
      const recipientConvo = await tx.conversation.upsert({
        where: { participantId_userId: { participantId: toUserId, userId: senderId } },
        create: {
          participantId: toUserId,
          userId: senderId,
          lastMessage: previewText,
          time: timeStr,
          unreadCount: 1,
          online: false,
        },
        update: {
          lastMessage: previewText,
          time: timeStr,
          unreadCount: { increment: 1 },
          typingUserId: null,
          typingAt: null,
        },
      });

      // Message in SENDER's conversation (fromMe = true)
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

      // Message in RECIPIENT's conversation (fromMe = false)
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
