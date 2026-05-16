import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "./social-auth";

export async function saveSocialMessage(
  platform: string,
  connectionId: number,
  externalId: string,
  externalUserId: string,
  fromHandle: string | null,
  fromAvatarUrl: string | null,
  text: string,
  direction: "inbound" | "outbound" = "inbound",
  createdAt: Date = new Date()
) {
  console.log(`[social-sync] Saving ${direction} message for ${platform} (conn: ${connectionId}, externalUser: ${externalUserId})`);
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

    console.log(`[social-sync] Thread ${thread.id} (${thread.externalUserId}) ensured. Last message at: ${thread.lastMessageAt}`);

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
        direction,
        createdAt,
      },
      update: {
        text,
        fromHandle,
        fromAvatarUrl,
        direction,
        createdAt,
      },
    });
    console.log(`[social-sync] Message ${msg.id} saved (externalId: ${externalId})`);
  } catch (err) {
    console.error(`[social-sync] Failed to save message for ${platform}:`, err);
  }
}

export async function syncTwitterMessages(connectionId: number, accessTokenOld: string, platformUserId: string) {
  console.log(`[social-sync/twitter] Starting sync for connection ${connectionId}, user ${platformUserId}`);
  try {
    const accessToken = await getValidAccessToken(connectionId) || accessTokenOld;
    
    // We use expansions=participant_ids to see everyone in the conversation
    const url = "https://api.twitter.com/2/dm_events?dm_event.fields=id,text,sender_id,created_at,dm_conversation_id,event_type&expansions=sender_id,participant_ids&user.fields=profile_image_url,username&max_results=50";
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

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
    if (events.length === 0) {
      console.log(`[social-sync/twitter] No events found. Response:`, JSON.stringify(data));
    }
    const users = data.includes?.users ?? [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    console.log(`[social-sync/twitter] Found ${events.length} events for connection ${connectionId}`);

    for (const event of events) {
      // Fallback: if event_type is missing but we have text, it's likely a message
      const type = event.event_type || (event.text ? "MessageCreate" : null);
      if (type !== "MessageCreate") {
        console.log(`[social-sync/twitter] Skipping non-message event: ${type}`);
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

      const sender: any = userMap.get(event.sender_id);
      
      await saveSocialMessage(
        "twitter",
        connectionId,
        event.id,
        externalUserId,
        sender ? `@${sender.username}` : null,
        sender ? sender.profile_image_url : null,
        event.text,
        isOutbound ? "outbound" : "inbound",
        new Date(event.created_at)
      );
    }
    console.log(`[social-sync/twitter] Sync complete for connection ${connectionId}`);
  } catch (err) {
    console.error("[social-sync/twitter] Fatal error during sync:", err);
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
    const res = await fetch(url);
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
