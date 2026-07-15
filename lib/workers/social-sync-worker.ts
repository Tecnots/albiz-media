import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/social-auth";
import { syncTwitterMessages, persistIncomingMedia, fetchWhatsAppMediaUrl, sendToSocialPlatform } from "@/lib/social-sync";

// One recurring job (see lib/job-queue.ts's "social-reliability-sweep" and
// app/api/cron/route.ts) covers three concerns in a single pass, the same
// way the existing per-minute cron already bundles zombie recovery, trending,
// and topics into one invocation:
//   1. Twitter DM polling — the only supported platform with no usable
//      incoming webhook (see app/api/social/webhook/[platform]/route.ts's
//      closing comment), so this is its actual delivery-recovery mechanism.
//   2. Retrying attachments that failed to download/persist on first attempt.
//   3. Retrying outbound sends that failed with a transient (not permanent)
//      platform error.
// A single job type keeps this compatible with the Job table's partial
// unique index on (type) WHERE status='pending' (see migration
// 20260707000001_audit_fixes) — per-item job payloads would collide under
// that index the moment two items needed retrying at the same time.

const SOCIAL_SYNC_INTERVAL_MS = 5 * 60_000; // Twitter DM polling cadence
const MEDIA_RETRY_MAX_AGE_MS = 6 * 60 * 60_000; // give up on a media fetch after 6h — source CDN links don't outlive this
const SEND_RETRY_MAX_AGE_MS = 24 * 60 * 60_000; // give up on a send retry after 24h
const SWEEP_BATCH_SIZE = 50; // bound each pass so one sweep can't blow the cron's execution budget

export async function isSocialSyncDue(): Promise<boolean> {
  const latest = await prisma.job.findFirst({
    where: { type: "social-reliability-sweep", status: "completed" },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });
  if (!latest?.completedAt) return true;
  return Date.now() - latest.completedAt.getTime() >= SOCIAL_SYNC_INTERVAL_MS;
}

export interface SocialSweepStats {
  twitterSynced: number;
  twitterFailed: number;
  mediaRetried: number;
  mediaResolved: number;
  mediaGivenUp: number;
  sendsRetried: number;
  sendsResolved: number;
  sendsGivenUp: number;
}

export async function processSocialReliabilitySweepJob(): Promise<SocialSweepStats> {
  const stats: SocialSweepStats = {
    twitterSynced: 0, twitterFailed: 0,
    mediaRetried: 0, mediaResolved: 0, mediaGivenUp: 0,
    sendsRetried: 0, sendsResolved: 0, sendsGivenUp: 0,
  };

  await pollTwitterConnections(stats);
  await retryPendingMedia(stats);
  await retryFailedSends(stats);

  console.log(
    `[social-sync-worker] sweep complete — twitter ${stats.twitterSynced} ok/${stats.twitterFailed} failed; ` +
    `media retried ${stats.mediaRetried} (resolved ${stats.mediaResolved}, gave up ${stats.mediaGivenUp}); ` +
    `sends retried ${stats.sendsRetried} (resolved ${stats.sendsResolved}, gave up ${stats.sendsGivenUp})`
  );

  return stats;
}

// ── 1. Twitter polling ──────────────────────────────────────────────────────
// syncTwitterMessages is already idempotent (upserts keyed by externalId/
// externalUserId — see lib/social-sync.ts), so re-running it on a cadence
// naturally recovers anything missed, without ever duplicating a conversation
// or message. Each connection is isolated so one bad/rate-limited account
// can't stop the others from syncing.
async function pollTwitterConnections(stats: SocialSweepStats) {
  const connections = await prisma.socialConnection.findMany({
    where: { platform: "twitter", active: true },
    select: { id: true, accessToken: true, platformUserId: true },
    take: SWEEP_BATCH_SIZE,
  });

  for (const conn of connections) {
    try {
      await syncTwitterMessages(conn.id, conn.accessToken, conn.platformUserId);
      stats.twitterSynced++;
    } catch (err) {
      stats.twitterFailed++;
      console.error(`[social-sync-worker] Twitter poll failed for connection ${conn.id}:`, err instanceof Error ? err.message : err);
    }
  }
}

// ── 2. Attachment retry ─────────────────────────────────────────────────────
async function retryPendingMedia(stats: SocialSweepStats) {
  const pending = await prisma.socialMessage.findMany({
    where: { pendingMediaUrl: { not: null } },
    take: SWEEP_BATCH_SIZE,
  });

  for (const msg of pending) {
    stats.mediaRetried++;
    const isExpired = Date.now() - msg.createdAt.getTime() > MEDIA_RETRY_MAX_AGE_MS;

    try {
      const conn = await prisma.socialConnection.findUnique({ where: { id: msg.connectionId } });
      if (!conn) {
        // Connection was disconnected/deleted since — nothing left to retry against.
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { pendingMediaUrl: null } });
        stats.mediaGivenUp++;
        continue;
      }

      const accessToken = (await getValidAccessToken(conn.id)) || conn.accessToken;
      const marker = msg.pendingMediaUrl!;
      let remoteUrl = marker;
      let headers: Record<string, string> | undefined;

      if (marker.startsWith("whatsapp-media-id:")) {
        // WhatsApp CDN URLs expire quickly; we stored the longer-lived media
        // ID instead and re-resolve a fresh URL from it here.
        const mediaId = marker.slice("whatsapp-media-id:".length);
        const resolved = await fetchWhatsAppMediaUrl(mediaId, accessToken);
        if (!resolved) throw new Error(`WhatsApp media ${mediaId} is no longer resolvable`);
        remoteUrl = resolved;
        headers = { Authorization: `Bearer ${accessToken}` };
      }

      const attachmentUrl = await persistIncomingMedia(conn.id, remoteUrl, headers);
      if (attachmentUrl) {
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { attachmentUrl, pendingMediaUrl: null } });
        stats.mediaResolved++;
      } else if (isExpired) {
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { pendingMediaUrl: null } });
        stats.mediaGivenUp++;
        console.warn(`[social-sync-worker] Giving up on media for message ${msg.id} (connection ${msg.connectionId}) after ${MEDIA_RETRY_MAX_AGE_MS / 3_600_000}h`);
      }
      // else: still transient and within the age budget — leave pendingMediaUrl set, try again next sweep
    } catch (err) {
      console.error(`[social-sync-worker] Media retry failed for message ${msg.id} (connection ${msg.connectionId}):`, err instanceof Error ? err.message : err);
      if (isExpired) {
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { pendingMediaUrl: null } }).catch(() => {});
        stats.mediaGivenUp++;
      }
    }
  }
}

// ── 3. Outgoing send retry ──────────────────────────────────────────────────
async function retryFailedSends(stats: SocialSweepStats) {
  const pending = await prisma.socialMessage.findMany({
    where: { deliveryFailed: true, direction: "outbound" },
    take: SWEEP_BATCH_SIZE,
  });

  for (const msg of pending) {
    stats.sendsRetried++;
    const isExpired = Date.now() - msg.createdAt.getTime() > SEND_RETRY_MAX_AGE_MS;

    try {
      const thread = msg.threadId
        ? await prisma.socialThread.findUnique({ where: { id: msg.threadId }, include: { connection: true } })
        : null;
      if (!thread) {
        // Thread (or its connection) is gone — nothing left to retry against.
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { deliveryFailed: false } });
        stats.sendsGivenUp++;
        continue;
      }

      const result = await sendToSocialPlatform(thread.connection, thread.externalUserId, msg.text);
      if (result.sent) {
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { deliveryFailed: false } });
        stats.sendsResolved++;
      } else if (!result.retryable || isExpired) {
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { deliveryFailed: false } });
        stats.sendsGivenUp++;
        console.warn(`[social-sync-worker] Giving up on send for message ${msg.id} (connection ${thread.connectionId}): ${result.error}`);
      }
      // else: still transient and within the age budget — leave deliveryFailed set, try again next sweep
    } catch (err) {
      console.error(`[social-sync-worker] Send retry failed for message ${msg.id}:`, err instanceof Error ? err.message : err);
      if (isExpired) {
        await prisma.socialMessage.update({ where: { id: msg.id }, data: { deliveryFailed: false } }).catch(() => {});
        stats.sendsGivenUp++;
      }
    }
  }
}
