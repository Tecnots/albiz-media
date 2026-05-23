import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/social-auth";
import { saveSocialMessage } from "@/lib/social-sync";

// GET /api/social/threads/[id]/messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const messages = await (prisma.socialMessage as any).findMany({
      where: { threadId: Number(id) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    return NextResponse.json(
      { messages: [], error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

// POST /api/social/threads/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: "Message text is required" }, { status: 400 });

    const thread = await prisma.socialThread.findUnique({
      where: { id: Number(id) },
      include: { connection: true },
    });

    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

    const { connection, externalUserId } = thread;
    const platform = thread.platform ?? connection.platform;
    const accessToken = await getValidAccessToken(connection.id);

    if (!accessToken) return NextResponse.json({ error: "Failed to get access token" }, { status: 401 });

    let externalId = `sent_${Date.now()}`;
    let sent = false;
    let sendError: string | null = null;

    try {
      // ── Twitter DM v2 ──────────────────────────────────────────────────────
      if (platform === "twitter") {
        const url = `https://api.twitter.com/2/dm_conversations/with/${externalUserId}/messages`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("[social/send/twitter] error:", errText);
          sendError = `Twitter API ${res.status}: ${errText.substring(0, 100)}`;
        } else {
          const data = await res.json();
          externalId = data.data?.dm_event_id || externalId;
          sent = true;
        }

      // ── Instagram DM ──────────────────────────────────────────────────────
      } else if (platform === "instagram") {
        // Instagram uses graph.instagram.com for sending messages
        const res = await fetch("https://graph.instagram.com/v22.0/me/messages", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: externalUserId },
            message: { text },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("[social/send/instagram] error:", errText);
          sendError = `Instagram API ${res.status}: ${errText.substring(0, 200)}`;
        } else {
          const data = await res.json();
          externalId = data.message_id || externalId;
          sent = true;
          console.log(`[social/send/instagram] Message sent to ${externalUserId}, message_id=${externalId}`);
        }

      // ── Facebook / Messenger ───────────────────────────────────────────────
      } else if (platform === "messenger" || platform === "facebook") {
        const res = await fetch("https://graph.facebook.com/v19.0/me/messages", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: externalUserId },
            message: { text },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[social/send/${platform}] error:`, errText);
          sendError = `Meta API ${res.status}: ${errText.substring(0, 100)}`;
        } else {
          const data = await res.json();
          externalId = data.message_id || externalId;
          sent = true;
        }

      // ── WhatsApp Business Cloud API ────────────────────────────────────────
      } else if (platform === "whatsapp") {
        const phoneNumberId = connection.platformUserId;
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: externalUserId,
              type: "text",
              text: { body: text },
            }),
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          console.error("[social/send/whatsapp] error:", errText);
          sendError = `WhatsApp API ${res.status}: ${errText.substring(0, 100)}`;
        } else {
          const data = await res.json();
          externalId = data.messages?.[0]?.id || externalId;
          sent = true;
        }

      // ── Telegram Bot API ───────────────────────────────────────────────────
      } else if (platform === "telegram") {
        const botToken = process.env.TELEGRAM_BOT_TOKEN ?? accessToken;
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: externalUserId, text }),
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          console.error("[social/send/telegram] error:", errText);
          sendError = `Telegram API ${res.status}: ${errText.substring(0, 100)}`;
        } else {
          const data = await res.json();
          externalId = data.result?.message_id ? String(data.result.message_id) : externalId;
          sent = true;
        }

      } else {
        sendError = `Platform "${platform}" is not supported for sending messages`;
      }
    } catch (platformErr) {
      sendError = platformErr instanceof Error ? platformErr.message : "Platform send failed";
      console.error(`[social/send/${platform}] exception:`, platformErr);
    }

    // Save outbound message to DB regardless of send result
    await saveSocialMessage(
      platform,
      connection.id,
      externalId,
      externalUserId,
      null,
      null,
      text,
      "outbound"
    );

    if (sendError) {
      console.warn(`[social/send/${platform}] Send failed but message saved locally: ${sendError}`);
      return NextResponse.json({ ok: false, externalId, warning: sendError });
    }

    return NextResponse.json({ ok: true, externalId });
  } catch (err: unknown) {
    console.error("[social/send] fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
