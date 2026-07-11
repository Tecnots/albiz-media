import { prisma } from "@/lib/prisma";
import { getValidAccessToken, fetchWithRetry, classifySocialApiFailure } from "./social-auth";
import { blobStorageService } from "@/lib/blob-storage";

export async function saveSocialMessage(
  platform: string,
  connectionId: number,
  externalId: string,
  externalUserId: string,
  fromHandle: string | null,
  fromAvatarUrl: string | null,
  text: string,
  direction: "inbound" | "outbound" = "inbound",
  createdAt: Date = new Date(),
  attachmentUrl: string | null = null,
  // Set when we know a message has media but couldn't persist it (transient
  // failure) — lib/workers/social-sync-worker.ts retries these independently
  // on a later sweep without re-touching the rest of the message/thread.
  pendingMediaUrl: string | null = null,
  // Set when the initial outgoing-send attempt failed with a retryable error
  // (see sendToSocialPlatform below) — retried by the same background sweep.
  deliveryFailed: boolean = false
) {
  try {
    const thread = await prisma.socialThread.upsert({
      where: { connectionId_externalUserId: { connectionId, externalUserId } },
      create: {
        connectionId,
        platform,
        externalUserId,
        externalHandle: fromHandle,
        externalAvatarUrl: fromAvatarUrl,
        lastMessageAt: createdAt,
        unreadCount: direction === "inbound" ? 1 : 0,
      },
      update: {
        lastMessageAt: createdAt,
        unreadCount: { increment: direction === "inbound" ? 1 : 0 },
        // Always store platform if it was missing
        platform,
        // Only update handle/avatar if we have them and they were missing
        ...(fromHandle ? { externalHandle: fromHandle } : {}),
        ...(fromAvatarUrl ? { externalAvatarUrl: fromAvatarUrl } : {}),
      },
    });

    // 2. Upsert the message, linking it to the thread
    const msg = await prisma.socialMessage.upsert({
      where: { connectionId_externalId: { connectionId, externalId } },
      create: {
        connectionId,
        externalId,
        threadId: thread.id,
        fromHandle,
        fromAvatarUrl,
        text,
        attachmentUrl,
        pendingMediaUrl,
        deliveryFailed,
        direction,
        createdAt,
      },
      update: {
        text,
        fromHandle,
        fromAvatarUrl,
        attachmentUrl,
        pendingMediaUrl,
        deliveryFailed,
        direction,
        createdAt,
      },
    });
  } catch (err) {
    console.error(`[social-sync] Failed to save message for ${platform} (connection ${connectionId}, externalId ${externalId}):`, err);
  }
}

/**
 * Download a piece of incoming media (image/video/audio/document) from a
 * platform-hosted URL and re-host it in our own blob storage, so conversation
 * history doesn't break once the platform's temporary CDN link expires.
 * Returns the stored blob name (resolved to a fresh URL on read via
 * `blobStorageService.resolveMediaUrl`), or null if the fetch/upload failed.
 */
export async function persistIncomingMedia(
  connectionId: number,
  mediaUrl: string,
  extraHeaders?: Record<string, string>
): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      mediaUrl,
      extraHeaders ? { headers: extraHeaders } : undefined,
      { label: `media-download/connection-${connectionId}` }
    );
    if (!res.ok) {
      console.warn(`[social-sync] Failed to download incoming media (${res.status}) for connection ${connectionId} — will retry later if transient`);
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const ext = contentType.split("/")[1]?.split(";")[0]?.trim() || "bin";
    const buffer = Buffer.from(await res.arrayBuffer());

    const blobName = `social/${connectionId}/${blobStorageService.generateBlobName(`media.${ext}`)}`;
    // Uploads to blob storage already retry internally (see AZURE_UPLOAD_ATTEMPTS
    // in lib/blob-storage.ts) — no need to double-wrap this call.
    await blobStorageService.uploadFile(buffer, blobName, contentType);
    return blobName;
  } catch (err) {
    console.error(`[social-sync] Error persisting incoming media for connection ${connectionId}:`, err);
    return null;
  }
}

/**
 * WhatsApp Cloud API sends only a media *ID* in the webhook payload — the
 * actual (temporary, auth-gated) CDN URL has to be looked up first.
 */
export async function fetchWhatsAppMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      { label: `whatsapp-media-lookup/${mediaId}` }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch (err) {
    console.warn(`[social-sync] Failed to resolve WhatsApp media URL for ${mediaId}:`, err);
    return null;
  }
}

/**
 * WhatsApp messages aren't always plain text — location shares, contact
 * cards, and interactive button/list replies all arrive with no `text.body`.
 * Rather than silently dropping them (they were previously skipped entirely),
 * render a readable summary so the conversation doesn't have gaps.
 */
export function extractWhatsAppTextContent(msg: any): string {
  if (msg.text?.body) return msg.text.body;

  if (msg.location) {
    const { latitude, longitude, name, address } = msg.location;
    const label = name || address || "Shared a location";
    return latitude != null && longitude != null ? `${label} (https://www.google.com/maps?q=${latitude},${longitude})` : label;
  }

  if (msg.contacts?.length) {
    const names = msg.contacts.map((c: any) => c.name?.formatted_name).filter(Boolean);
    return names.length ? `Shared a contact: ${names.join(", ")}` : "Shared a contact";
  }

  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;

  return "";
}

/**
 * Mark our outbound messages in a thread as read once the platform reports
 * the contact has seen everything up to a given point (Instagram/Messenger
 * "read" webhook events, keyed by a watermark timestamp).
 */
export async function markOutboundMessagesReadByWatermark(
  connectionId: number,
  externalUserId: string,
  upTo: Date
) {
  try {
    const thread = await prisma.socialThread.findUnique({
      where: { connectionId_externalUserId: { connectionId, externalUserId } },
    });
    if (!thread) return;

    await prisma.socialMessage.updateMany({
      where: { threadId: thread.id, direction: "outbound", createdAt: { lte: upTo }, read: false },
      data: { read: true },
    });
  } catch (err) {
    console.error(`[social-sync] Failed to mark messages read for connection ${connectionId}:`, err);
  }
}

/**
 * Mark a single outbound message as read once WhatsApp reports its delivery
 * status (statuses[].status === "read"), keyed by the platform message ID
 * we stored as externalId when we sent it.
 */
export async function markMessageReadByExternalId(connectionId: number, externalId: string) {
  try {
    await prisma.socialMessage.updateMany({
      where: { connectionId, externalId, direction: "outbound", read: false },
      data: { read: true },
    });
  } catch (err) {
    console.error(`[social-sync] Failed to mark message ${externalId} read for connection ${connectionId}:`, err);
  }
}

export async function syncTwitterMessages(connectionId: number, accessTokenOld: string, platformUserId: string) {
  try {
    const accessToken = await getValidAccessToken(connectionId) || accessTokenOld;
    
    // We use expansions=participant_ids to see everyone in the conversation,
    // and attachments.media_keys/media.fields to resolve any attached media.
    const url = "https://api.twitter.com/2/dm_events?dm_event.fields=id,text,sender_id,created_at,dm_conversation_id,event_type,attachments&expansions=sender_id,participant_ids,attachments.media_keys&user.fields=profile_image_url,username&media.fields=url,preview_image_url,type&max_results=50";
    
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, { label: `twitter-dm-sync/connection-${connectionId}` });

    if (!res.ok) {
      const errText = await res.text();
      let msg = `Twitter API Error ${res.status}`;
      
      try {
        const errJson = JSON.parse(errText);
        if (errJson.detail) msg += `: ${errJson.detail}`;
        else if (errJson.errors?.[0]?.message) msg += `: ${errJson.errors[0].message}`;
      } catch {
        msg += `: ${errText.substring(0, 100)}`;
      }

      if (res.status === 403) {
        msg = "Twitter Access Denied (403): Your account likely has 'Free' tier access, which does not allow DM syncing. 'Basic' tier or higher is required for this feature.";
      } else if (res.status === 401) {
        msg = "Twitter Authentication Error (401): Please try reconnecting your account in Settings.";
      }
      
      throw new Error(msg);
    }

    const data = await res.json();
    const events = data.data ?? [];
    const users = data.includes?.users ?? [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    const mediaList = data.includes?.media ?? [];
    const mediaMap = new Map(mediaList.map((m: any) => [m.media_key, m]));

    for (const event of events) {
      // Fallback: if event_type is missing but we have text or media, it's likely a message
      const type = event.event_type || ((event.text || event.attachments) ? "MessageCreate" : null);
      if (type !== "MessageCreate") {
        continue;
      }

      const isOutbound = event.sender_id === platformUserId;
      let externalUserId = "";
      
      if (!isOutbound) {
        externalUserId = event.sender_id;
      } else {
        // For outbound, we need the OTHER participant's ID.
        // We find the person in 'includes.users' that is NOT us.
        const otherParticipant = users.find((u: any) => u.id !== platformUserId);
        if (otherParticipant) {
          externalUserId = otherParticipant.id;
        } else {
          // Fallback to conversation ID if we can't find a user ID
          // This prevents all outbound messages from different people merging into one thread.
          externalUserId = event.dm_conversation_id ? `conv_${event.dm_conversation_id}` : "unknown_recipient";
        }
      }

      const sender = userMap.get(event.sender_id) as any;
      const senderHandle = sender ? `@${sender.username}` : null;
      const senderAvatar = sender ? sender.profile_image_url : null;
      const direction = isOutbound ? "outbound" : "inbound";
      const createdAt = new Date(event.created_at);

      // A DM can carry more than one image/GIF — the schema stores one
      // attachment per message row, so extra media becomes extra rows.
      const mediaKeys: string[] = event.attachments?.media_keys ?? [];

      if (mediaKeys.length === 0) {
        await saveSocialMessage(
          "twitter", connectionId, event.id, externalUserId,
          senderHandle, senderAvatar, event.text ?? "", direction, createdAt, null
        );
        continue;
      }

      for (let i = 0; i < mediaKeys.length; i++) {
        const media = mediaMap.get(mediaKeys[i]) as any;
        const remoteUrl = media?.url ?? media?.preview_image_url;
        const attachmentUrl = remoteUrl ? await persistIncomingMedia(connectionId, remoteUrl) : null;
        // Twitter media URLs are directly re-fetchable later (unlike WhatsApp's
        // ID-based lookup) — record the same URL for the background sweep to retry.
        const pendingMediaUrl = remoteUrl && !attachmentUrl ? remoteUrl : null;

        await saveSocialMessage(
          "twitter",
          connectionId,
          mediaKeys.length > 1 ? `${event.id}_${i}` : event.id,
          externalUserId,
          senderHandle,
          senderAvatar,
          i === 0 ? (event.text ?? "") : "",
          direction,
          createdAt,
          attachmentUrl,
          pendingMediaUrl
        );
      }
    }
  } catch (err) {
    console.error(`[social-sync/twitter] Fatal error during sync for connection ${connectionId}:`, err);
    // Rethrow so callers relying on rejection actually see the failure —
    // this previously swallowed the error entirely, silently defeating both
    // app/api/social/threads/route.ts's `syncError` surfacing and (now) the
    // background sweep's own per-connection error isolation/logging.
    throw err;
  }
}

/**
 * Fetch an Instagram user's profile info (username + avatar) using the Graph API.
 * Returns { username, avatarUrl } or null on failure.
 */
export async function fetchInstagramUserProfile(
  userId: string,
  accessToken: string
): Promise<{ username: string; avatarUrl: string | null } | null> {
  try {
    const url = `https://graph.instagram.com/v22.0/${userId}?fields=name,username,profile_pic&access_token=${accessToken}`;
    const res = await fetchWithRetry(url, undefined, { label: `instagram-profile/${userId}` });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[social-sync] Failed to fetch IG profile for ${userId}: ${res.status} - ${errText}`);
      return null;
    }
    const data = await res.json();
    return {
      username: data.username ?? data.name ?? null,
      avatarUrl: data.profile_pic ?? null,
    };
  } catch (err) {
    console.warn(`[social-sync] Error fetching IG profile for ${userId}:`, err);
    return null;
  }
}

export interface SendResult {
  sent: boolean;
  externalId: string;
  error?: string;
  /** Whether a failed send is worth retrying in the background sweep. */
  retryable: boolean;
}

/**
 * Attempt to deliver a text reply through the connected platform's send API.
 * This is the single canonical place that talks to each platform's send
 * endpoint — used both by the live send request (app/api/social/threads/[id]/messages/route.ts)
 * and by the background retry sweep (lib/workers/social-sync-worker.ts), so
 * the two can't drift the way the old duplicate /api/social/reply endpoint did.
 */
export async function sendToSocialPlatform(
  connection: { id: number; platform: string; platformUserId: string },
  externalUserId: string,
  text: string
): Promise<SendResult> {
  const platform = connection.platform;
  const accessToken = await getValidAccessToken(connection.id);
  if (!accessToken) {
    return { sent: false, externalId: "", error: "Failed to get access token", retryable: false };
  }

  let externalId = `sent_${Date.now()}`;

  try {
    // ── Twitter DM v2 ──────────────────────────────────────────────────────
    if (platform === "twitter") {
      const res = await fetchWithRetry(
        `https://api.twitter.com/2/dm_conversations/with/${externalUserId}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
        { label: `send/twitter/connection-${connection.id}` }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[social/send/twitter] connection ${connection.id} error ${res.status}:`, errText);
        return { sent: false, externalId, error: `Twitter API ${res.status}: ${errText.substring(0, 100)}`, retryable: classifySocialApiFailure(res.status) === "retryable" };
      }
      const data = await res.json();
      return { sent: true, externalId: data.data?.dm_event_id || externalId, retryable: false };

    // ── Instagram DM ──────────────────────────────────────────────────────
    } else if (platform === "instagram") {
      const res = await fetchWithRetry(
        "https://graph.instagram.com/v22.0/me/messages",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ recipient: { id: externalUserId }, message: { text } }),
        },
        { label: `send/instagram/connection-${connection.id}` }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[social/send/instagram] connection ${connection.id} error ${res.status}:`, errText);
        return { sent: false, externalId, error: `Instagram API ${res.status}: ${errText.substring(0, 200)}`, retryable: classifySocialApiFailure(res.status) === "retryable" };
      }
      const data = await res.json();
      return { sent: true, externalId: data.message_id || externalId, retryable: false };

    // ── Facebook / Messenger ───────────────────────────────────────────────
    } else if (platform === "messenger" || platform === "facebook") {
      const res = await fetchWithRetry(
        "https://graph.facebook.com/v19.0/me/messages",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ recipient: { id: externalUserId }, message: { text } }),
        },
        { label: `send/${platform}/connection-${connection.id}` }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[social/send/${platform}] connection ${connection.id} error ${res.status}:`, errText);
        return { sent: false, externalId, error: `Meta API ${res.status}: ${errText.substring(0, 100)}`, retryable: classifySocialApiFailure(res.status) === "retryable" };
      }
      const data = await res.json();
      return { sent: true, externalId: data.message_id || externalId, retryable: false };

    // ── WhatsApp Business Cloud API ────────────────────────────────────────
    } else if (platform === "whatsapp") {
      const phoneNumberId = connection.platformUserId;
      const res = await fetchWithRetry(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: externalUserId,
            type: "text",
            text: { body: text },
          }),
        },
        { label: `send/whatsapp/connection-${connection.id}` }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[social/send/whatsapp] connection ${connection.id} error ${res.status}:`, errText);
        return { sent: false, externalId, error: `WhatsApp API ${res.status}: ${errText.substring(0, 100)}`, retryable: classifySocialApiFailure(res.status) === "retryable" };
      }
      const data = await res.json();
      return { sent: true, externalId: data.messages?.[0]?.id || externalId, retryable: false };

      // ── Telegram Bot API ───────────────────────────────────────────────────
      // NOTE: unreachable today — no OAuth config exists for "telegram" (see
      // app/api/social/connect/[platform]/route.ts), so no connection can ever
      // resolve platform === "telegram" here. Left in place and correct,
      // ready to use the moment a connect flow exists; not in scope to build one.
    } else if (platform === "telegram") {
      const botToken = process.env.TELEGRAM_BOT_TOKEN ?? accessToken;
      const res = await fetchWithRetry(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: externalUserId, text }),
        },
        { label: `send/telegram/connection-${connection.id}` }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[social/send/telegram] connection ${connection.id} error ${res.status}:`, errText);
        return { sent: false, externalId, error: `Telegram API ${res.status}: ${errText.substring(0, 100)}`, retryable: classifySocialApiFailure(res.status) === "retryable" };
      }
      const data = await res.json();
      return { sent: true, externalId: data.result?.message_id ? String(data.result.message_id) : externalId, retryable: false };

      // ── LinkedIn Messaging API ──────────────────────────────────────────────
      // NOTE: requires LinkedIn's Messaging Partner Program — the
      // r_liteprofile/w_member_social scopes this app requests do not grant
      // messaging access by themselves, so this will typically 403 until/unless
      // this app is approved for that product. Surfaced as a real error, never
      // a false success, and treated as non-retryable (a 403 here reflects a
      // permissions gap, not a transient outage — retrying won't help).
    } else if (platform === "linkedin") {
      const res = await fetchWithRetry(
        `https://api.linkedin.com/rest/conversations/${encodeURIComponent(externalUserId)}/events?action=create`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": "202401",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({ eventCreate: { value: { "com.linkedin.messaging.MessageCreate": { body: text } } } }),
        },
        { label: `send/linkedin/connection-${connection.id}` }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[social/send/linkedin] connection ${connection.id} error ${res.status}:`, errText);
        return { sent: false, externalId, error: `LinkedIn API ${res.status}: ${errText.substring(0, 150)}`, retryable: classifySocialApiFailure(res.status) === "retryable" };
      }
      const data = await res.json().catch(() => ({} as any));
      return { sent: true, externalId: data.value?.eventId ? String(data.value.eventId) : externalId, retryable: false };
    }

    return { sent: false, externalId, error: `Platform "${platform}" is not supported for sending messages`, retryable: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Platform send failed";
    console.error(`[social/send/${platform}] connection ${connection.id} exception:`, err);
    // A thrown network error (not an HTTP response at all) is transient by definition.
    return { sent: false, externalId, error: msg, retryable: true };
  }
}
