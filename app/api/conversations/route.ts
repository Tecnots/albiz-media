import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

const TYPING_TIMEOUT_MS = 3000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  const since = searchParams.get("since");

  const whereClause: Record<string, unknown> = {};
  if (since) {
    whereClause.updatedAt = { gt: new Date(since) };
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    include: {
      messages: { orderBy: { id: "asc" } },
      user: { select: { id: true, name: true, handle: true, avatar: true, lastSeenAt: true } },
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
    if (conv.typingAt && now - new Date(conv.typingAt).getTime() < TYPING_TIMEOUT_MS) {
      // typingUserId stays as-is
    } else {
      (conv as Record<string, unknown>).typingUserId = null;
      (conv as Record<string, unknown>).typingAt = null;
    }

    // Mark messages from the other user as "delivered" if still "sent"
    // The other user is conv.userId (the user the conversation references)
    const otherUserId = conv.userId;
    const undeliveredIds = conv.messages
      .filter((m) => m.senderId === otherUserId && m.status === "sent")
      .map((m) => m.id);

    if (undeliveredIds.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: undeliveredIds } },
        data: { status: "delivered" },
      });
      // Update in-memory too so the response reflects the change
      for (const msg of conv.messages) {
        if (undeliveredIds.includes(msg.id)) {
          (msg as Record<string, unknown>).status = "delivered";
        }
      }
    }
  }

  return NextResponse.json({
    conversations,
    serverTime: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  try {
    const { toUserId, text, encrypted, iv, storyImage } = await req.json();
    if (!toUserId || !text) {
      return NextResponse.json({ error: "Missing toUserId or text" }, { status: 400 });
    }

    const senderId = authUser.id;
    const messageText = storyImage
      ? JSON.stringify({ type: "story_reply", storyImage, text })
      : text;

    // Find or create conversation with this user
    let conversation = await prisma.conversation.findFirst({ where: { userId: toUserId } });

    if (!conversation) {
      const maxId = await prisma.conversation.aggregate({ _max: { id: true } });
      const newId = (maxId._max.id || 0) + 1;
      conversation = await prisma.conversation.create({
        data: {
          id: newId,
          userId: toUserId,
          lastMessage: text,
          time: "Just now",
          unreadCount: 0,
          online: false,
        },
      });
    }

    // fromMe = true only if the sender is NOT the conversation's userId
    // (conversation.userId is the other person in the chat)
    const isFromMe = senderId !== conversation.userId;
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        fromMe: isFromMe,
        text: messageText,
        time: "Just now",
        senderId,
        status: "sent",
        encrypted: encrypted ?? false,
        iv: iv ?? null,
        createdAt: new Date(),
      },
    });

    // Update conversation metadata
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: text,
        time: "Just now",
        unreadCount: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true, conversationId: conversation.id, messageId: message.id });
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
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
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

  return NextResponse.json({ ok: true });
}

// PUT: Toggle encryption on a conversation
export async function PUT(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();
  const { conversationId, encryptionEnabled } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { encryptionEnabled: encryptionEnabled ?? false },
  });

  return NextResponse.json({ ok: true });
}
