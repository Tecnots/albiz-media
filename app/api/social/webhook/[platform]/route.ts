import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import {
  saveSocialMessage, fetchInstagramUserProfile, persistIncomingMedia, fetchWhatsAppMediaUrl,
  extractWhatsAppTextContent, markOutboundMessagesReadByWatermark, markMessageReadByExternalId,
} from "@/lib/social-sync";

const db = prisma as any;

// Verify webhook signatures
function verifyTwitterSignature(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
}

function verifyMetaSignature(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
}

// Shared logic is now imported from @/lib/social-sync

// GET — Meta/Twitter challenge verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const { searchParams } = request.nextUrl;

  // Meta webhook challenge (Instagram, Facebook, Messenger, WhatsApp all use hub.challenge)
  if (["instagram", "facebook", "messenger", "whatsapp"].includes(platform)) {
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "albiz_webhook_verify";
    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Twitter CRC challenge
  if (platform === "twitter") {
    const crcToken = searchParams.get("crc_token");
    if (!crcToken) return new NextResponse("Missing crc_token", { status: 400 });
    const secret = process.env.TWITTER_CLIENT_SECRET ?? "";
    const hash = crypto.createHmac("sha256", secret).update(crcToken).digest("base64");
    return NextResponse.json({ response_token: `sha256=${hash}` });
  }

  return new NextResponse("OK", { status: 200 });
}

// POST — receive incoming webhook events
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const rawBody = await request.text();

  // WhatsApp Business Platform webhook — same Meta signature, different payload shape
  if (platform === "whatsapp") {
    // Temporarily disabled for manual testing
    /*
    const sig = request.headers.get("x-hub-signature-256") ?? "";
    const secret = process.env.META_APP_SECRET ?? "";
    if (secret && !verifyMetaSignature(rawBody, sig, secret)) {
      return new NextResponse("Signature mismatch", { status: 401 });
    }
    */

    try {
      const data = JSON.parse(rawBody);
      for (const entry of (data.entry ?? [])) {
        for (const change of (entry.changes ?? [])) {
          if (change.field !== "messages") continue;
          const value = change.value;

          // NOTE: value.metadata.phone_number_id is the true identifier of the
          // receiving WhatsApp Business number, but connect-time profile fetch
          // (app/api/social/callback/[platform]/route.ts) can only capture a
          // Graph /me id, not a phone_number_id — these are different ID
          // namespaces. So this still can't route to the exact right
          // connection when more than one user has WhatsApp connected; doing
          // that correctly requires WhatsApp Embedded Signup, which is out of
          // scope here. Falls back to "first active" as before.
          const conn = await prisma.socialConnection.findFirst({ where: { platform: "whatsapp", active: true } });
          if (!conn) continue;

          for (const msg of (value.messages ?? [])) {
            const phone = value.contacts?.[0]?.wa_id ?? msg.from ?? "unknown";
            const name = value.contacts?.[0]?.profile?.name ?? null;

            let text = extractWhatsAppTextContent(msg);
            let attachmentUrl: string | null = null;
            let pendingMediaUrl: string | null = null;

            // WhatsApp media messages carry a media ID (image/video/audio/document/sticker),
            // not a direct URL — resolve it, then re-host it in our own storage.
            const mediaType = (["image", "video", "audio", "document", "sticker"] as const).find(t => msg[t]?.id);
            if (mediaType) {
              const media = msg[mediaType];
              const remoteUrl = await fetchWhatsAppMediaUrl(media.id, conn.accessToken);
              if (remoteUrl) {
                attachmentUrl = await persistIncomingMedia(conn.id, remoteUrl, { Authorization: `Bearer ${conn.accessToken}` });
              }
              if (!attachmentUrl) {
                // Unlike Instagram/Facebook/Twitter, a WhatsApp CDN URL expires
                // quickly — storing it for later retry is pointless. The media
                // ID itself stays resolvable for much longer, so the sweep
                // retries by re-resolving from the ID, not the URL.
                pendingMediaUrl = `whatsapp-media-id:${media.id}`;
              }
              if (!text) text = media.caption ?? "";
            }

            if (!text && !attachmentUrl && !pendingMediaUrl) continue;

            await saveSocialMessage("whatsapp", conn.id, msg.id, phone, name ? `${name} (+${phone})` : `+${phone}`, null, text, "inbound", new Date(), attachmentUrl, pendingMediaUrl);
          }

          // Delivery/read status updates for messages we sent
          for (const status of (value.statuses ?? [])) {
            if (status.status === "read") {
              await markMessageReadByExternalId(conn.id, status.id);
            } else if (status.status === "failed") {
              const err = status.errors?.[0];
              console.warn(`[social/webhook/whatsapp] Message ${status.id} failed to deliver: ${err?.title ?? "unknown error"}`);
            }
          }
        }
      }
    } catch (err) {
      console.error("[social/webhook/whatsapp]", err);
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  // ── Instagram DM webhook ───────────────────────────────────────────────────
  // Instagram DMs use the `messaging` array in each entry, with shape:
  // { sender: { id }, recipient: { id }, message: { mid, text } } for a new
  // message, or { sender, recipient, read: { watermark } } for a read receipt.
  if (platform === "instagram") {
    try {
      const data = JSON.parse(rawBody);

      for (const entry of (data.entry ?? [])) {
        for (const messaging of (entry.messaging ?? [])) {
          const senderId = messaging.sender?.id ?? "unknown";
          const recipientId = messaging.recipient?.id ?? "unknown";

          // Find connection by matching recipient ID (our IG account) to platformUserId
          let conn = await prisma.socialConnection.findFirst({
            where: { platform: "instagram", platformUserId: recipientId, active: true },
          });

          // Fallback: if platformUserId doesn't match (maybe stored differently), find any active Instagram connection
          if (!conn) {
            conn = await prisma.socialConnection.findFirst({
              where: { platform: "instagram", active: true },
            });
          }

          if (!conn) {
            console.warn(`[social/webhook/instagram] No active Instagram connection found for recipient ${recipientId}`);
            continue;
          }

          // Read receipt — the contact has seen everything we sent up to this point
          if (messaging.read?.watermark) {
            await markOutboundMessagesReadByWatermark(conn.id, senderId, new Date(Number(messaging.read.watermark)));
            continue;
          }

          const msg = messaging.message;
          if (!msg || msg.is_echo) continue; // echoes are our own messages bounced back — already saved locally

          const text = msg.text ?? "";
          const attachments = msg.attachments ?? [];
          if (!text && attachments.length === 0) continue;

          const msgId = msg.mid ?? String(Date.now());

          // Fetch sender's profile from Instagram Graph API for username + profile picture
          let senderHandle: string | null = `@${senderId}`;
          let senderAvatar: string | null = null;

          const profile = await fetchInstagramUserProfile(senderId, conn.accessToken);
          if (profile) {
            senderHandle = profile.username ? `@${profile.username}` : senderHandle;
            senderAvatar = profile.avatarUrl;
          }

          if (attachments.length === 0) {
            await saveSocialMessage("instagram", conn.id, msgId, senderId, senderHandle, senderAvatar, text, "inbound");
            continue;
          }

          // A DM can carry more than one attachment — one row per attachment,
          // since the schema stores a single attachmentUrl per message.
          for (let i = 0; i < attachments.length; i++) {
            const url = attachments[i]?.payload?.url;
            // Instagram attachment URLs are direct, publicly-fetchable CDN links — no auth header needed
            const attachmentUrl = url ? await persistIncomingMedia(conn.id, url) : null;
            // If the fetch failed transiently, the same URL is retried later —
            // Meta CDN attachment links are long-lived enough for this to work.
            const pendingMediaUrl = url && !attachmentUrl ? url : null;
            await saveSocialMessage(
              "instagram", conn.id, attachments.length > 1 ? `${msgId}_${i}` : msgId,
              senderId, senderHandle, senderAvatar,
              i === 0 ? text : "", "inbound", new Date(), attachmentUrl, pendingMediaUrl
            );
          }
        }
      }
    } catch (err) {
      console.error("[social/webhook/instagram]", err);
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  // ── Facebook / Messenger webhook ───────────────────────────────────────────
  if (platform === "facebook" || platform === "messenger") {
    try {
      const data = JSON.parse(rawBody);
      for (const entry of (data.entry ?? [])) {
        for (const messaging of (entry.messaging ?? entry.changes ?? [])) {
          const senderId = messaging.sender?.id ?? messaging.value?.sender?.user_ref ?? "unknown";
          // The Page that received the message — appears both at the entry
          // level and as recipient.id on each messaging event.
          const recipientId = messaging.recipient?.id ?? entry.id ?? "unknown";

          // Route to the connection for this specific Page. Different users can
          // each connect their own Page, so this must not just grab any active row.
          let conn = await prisma.socialConnection.findFirst({
            where: { platform, platformUserId: recipientId, active: true },
          });

          // Fallback for connections made before platformUserId was captured
          if (!conn) {
            conn = await prisma.socialConnection.findFirst({
              where: { platform, active: true },
            });
          }
          if (!conn) continue;

          // Read receipt — the contact has seen everything we sent up to this point
          if (messaging.read?.watermark) {
            await markOutboundMessagesReadByWatermark(conn.id, senderId, new Date(Number(messaging.read.watermark)));
            continue;
          }

          const msg = messaging.message ?? messaging.value?.messages?.[0];
          if (!msg || msg.is_echo) continue;

          const text = msg.text ?? "";
          const attachments = msg.attachments ?? [];
          if (!text && attachments.length === 0) continue;

          const msgId = msg.mid ?? msg.id ?? String(Date.now());

          if (attachments.length === 0) {
            await saveSocialMessage(platform, conn.id, msgId, senderId, `@${senderId}`, null, text, "inbound");
            continue;
          }

          // A message can carry more than one attachment — one row per
          // attachment, since the schema stores a single attachmentUrl per message.
          for (let i = 0; i < attachments.length; i++) {
            const url = attachments[i]?.payload?.url;
            const attachmentUrl = url ? await persistIncomingMedia(conn.id, url) : null;
            const pendingMediaUrl = url && !attachmentUrl ? url : null;
            await saveSocialMessage(
              platform, conn.id, attachments.length > 1 ? `${msgId}_${i}` : msgId,
              senderId, `@${senderId}`, null,
              i === 0 ? text : "", "inbound", new Date(), attachmentUrl, pendingMediaUrl
            );
          }
        }
      }
    } catch (err) {
      console.error(`[social/webhook/${platform}]`, err);
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  // Verify Twitter signature
  if (platform === "twitter") {
    // Temporarily disabled for manual testing
    /*
    const sig = request.headers.get("x-twitter-webhooks-signature") ?? "";
    const secret = process.env.TWITTER_CLIENT_SECRET ?? "";
    if (secret && !verifyTwitterSignature(rawBody, sig, secret)) {
      return new NextResponse("Signature mismatch", { status: 401 });
    }
    */

    try {
      const data = JSON.parse(rawBody);
      for (const event of (data.direct_message_events ?? [])) {
        if (event.type !== "message_create") continue;
        const mc = event.message_create;
        const senderId: string = mc.sender_id;
        const text: string = mc.message_data?.text ?? "";
        const msgId: string = event.id;

        // Find connection whose platform_user_id != senderId (i.e., this is incoming to them)
        const conn = await prisma.socialConnection.findFirst({
          where: { platform: "twitter", active: true, NOT: { platformUserId: senderId } },
        });
        if (!conn) continue;

        const users: Record<string, { screen_name: string; profile_image_url_https: string }> = data.users ?? {};
        const senderUser = users[senderId];
        await saveSocialMessage(
          "twitter", conn.id, msgId,
          senderId,
          senderUser ? `@${senderUser.screen_name}` : `@${senderId}`,
          senderUser?.profile_image_url_https ?? null,
          text,
          "inbound"
        );
      }
    } catch (err) {
      console.error(`[social/webhook/twitter]`, err);
    }

    return new NextResponse("OK", { status: 200 });
  }

  // LinkedIn and Telegram intentionally have no case here:
  // - LinkedIn's real-time messaging webhook is gated behind the same
  //   Messaging Partner Program as sending (see the linkedin branch in
  //   app/api/social/threads/[id]/messages/route.ts) — there's no
  //   unrestricted subscription to receive against.
  // - Telegram has no OAuth connect flow (see app/api/social/connect/[platform]/route.ts),
  //   so no SocialConnection row for it can exist and no webhook could be
  //   attributed to one anyway.
  // This 200 is just an inert acknowledgement for any platform without a
  // dedicated handler above.
  return new NextResponse("OK", { status: 200 });
}
