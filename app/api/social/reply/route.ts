import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/social/reply
// Body: { connectionId, threadId, text }
export async function POST(request: NextRequest) {
  try {
    const { connectionId, threadId, text } = await request.json();
    if (!connectionId || !threadId || !text?.trim()) {
      return NextResponse.json({ error: "connectionId, threadId, and text are required" }, { status: 400 });
    }

    const conn = await prisma.socialConnection.findUnique({ where: { id: Number(connectionId) } });
    if (!conn || !conn.active) {
      return NextResponse.json({ error: "Connection not found or inactive" }, { status: 404 });
    }

    const thread = await prisma.socialThread.findUnique({ where: { id: Number(threadId) } });
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // ── Platform send logic ──────────────────────────────────────────────────
    let sent = false;
    let sendError: string | null = null;

    try {
      if (conn.platform === "twitter") {
        // Twitter DM v2
        const res = await fetch(
          `https://api.twitter.com/2/dm_conversations/${thread.externalUserId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${conn.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
          }
        );
        sent = res.ok;
        if (!sent) sendError = `Twitter API ${res.status}`;

      } else if (conn.platform === "whatsapp") {
        // WhatsApp Business Cloud API
        const phoneNumberId = conn.platformUserId;
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${conn.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: thread.externalUserId,
              type: "text",
              text: { body: text },
            }),
          }
        );
        sent = res.ok;
        if (!sent) sendError = `WhatsApp API ${res.status}`;

      } else if (conn.platform === "instagram" || conn.platform === "messenger" || conn.platform === "facebook") {
        // Meta Send API
        const res = await fetch("https://graph.facebook.com/v19.0/me/messages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${conn.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: thread.externalUserId },
            message: { text },
          }),
        });
        sent = res.ok;
        if (!sent) sendError = `Meta API ${res.status}`;

      } else if (conn.platform === "telegram") {
        const botToken = process.env.TELEGRAM_BOT_TOKEN ?? conn.accessToken;
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: thread.externalUserId, text }),
          }
        );
        sent = res.ok;
        if (!sent) sendError = `Telegram API ${res.status}`;
      }
    } catch (platformErr) {
      sendError = platformErr instanceof Error ? platformErr.message : "Platform send failed";
    }

    // ── Save outbound message regardless of send result ──────────────────────
    const saved = await prisma.socialMessage.create({
      data: {
        connectionId: Number(connectionId),
        externalId: `out_${threadId}_${Date.now()}`,
        fromHandle: conn.platformHandle ?? "me",
        text,
        direction: "outbound",
        threadId: Number(threadId),
        read: true,
      },
    });

    // Update thread lastMessageAt
    await prisma.socialThread.update({
      where: { id: Number(threadId) },
      data: { lastMessageAt: new Date() },
    });

    if (sendError) {
      return NextResponse.json({ ok: false, saved, warning: sendError });
    }

    return NextResponse.json({ ok: true, saved });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
