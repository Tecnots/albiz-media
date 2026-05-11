import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { saveSocialMessage } from "@/lib/social-sync";

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
    
    console.log("--- Webhook Verification Debug ---");
    console.log("Platform:", platform);
    console.log("Received Token:", token);
    console.log("Expected Token:", verifyToken);
    console.log("Match:", token === verifyToken);
    
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
          for (const msg of (value.messages ?? [])) {
            if (!msg.text?.body) continue;
            const phone = value.contacts?.[0]?.wa_id ?? msg.from ?? "unknown";
            const name = value.contacts?.[0]?.profile?.name ?? null;
            const conn = await prisma.socialConnection.findFirst({ where: { platform: "whatsapp", active: true } });
            if (!conn) continue;
            await saveSocialMessage("whatsapp", conn.id, msg.id, phone, name ? `${name} (+${phone})` : `+${phone}`, null, msg.text.body, "inbound");
          }
        }
      }
    } catch (err) {
      console.error("[social/webhook/whatsapp]", err);
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  // Verify Meta signature
  if (platform === "instagram" || platform === "facebook" || platform === "messenger") {
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
        for (const messaging of (entry.messaging ?? entry.changes ?? [])) {
          const msg = messaging.message ?? messaging.value?.messages?.[0];
          if (!msg || !msg.text) continue;

          const senderId = messaging.sender?.id ?? messaging.value?.sender?.user_ref ?? "unknown";
          const msgId = msg.mid ?? msg.id ?? String(Date.now());

          // Find connection by platform — simple: find first connected instagram/facebook connection
          const conn = await prisma.socialConnection.findFirst({
            where: { platform, active: true },
          });
          if (!conn) continue;

          await saveSocialMessage(platform, conn.id, msgId, senderId, `@${senderId}`, null, msg.text, "inbound");
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

  return new NextResponse("OK", { status: 200 });
}
