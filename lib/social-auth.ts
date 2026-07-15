import { prisma } from "./prisma";

// ── Shared retry/classification policy for external platform APIs ──────────
// Used consistently across token refresh (here), media download and outgoing
// send (lib/social-sync.ts), and Twitter polling — one policy, one place.

/**
 * Whether a failed platform API call is worth retrying at all.
 * - No HTTP status (network error/timeout) → transient, retry.
 * - 429 (rate limited) or 5xx (upstream outage) → transient, retry.
 * - 4xx otherwise (bad request, unauthorized, not found, tier-gated, etc.)
 *   → the same request will fail again the same way, don't retry it blindly.
 */
export function classifySocialApiFailure(status?: number): "retryable" | "permanent" {
  if (status === undefined) return "retryable";
  if (status === 429) return "retryable";
  if (status >= 500) return "retryable";
  return "permanent";
}

/**
 * fetch() with a small, bounded exponential-backoff retry for transient
 * failures only. Capped at a few attempts with short delays — this runs
 * inline during a live request/webhook/job, not as a long-horizon background
 * mechanism, so it must never turn into an unbounded or slow retry loop.
 * Returns the last Response (ok or not) so callers keep their existing
 * status-code handling; only throws if every attempt threw a network error.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: { maxAttempts?: number; baseDelayMs?: number; label?: string }
): Promise<Response> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 300;
  const label = opts?.label ?? "social-api";

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || classifySocialApiFailure(res.status) === "permanent" || attempt === maxAttempts) {
        return res;
      }
      console.warn(`[social-retry] ${label} got ${res.status} (attempt ${attempt}/${maxAttempts}), retrying...`);
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) throw err;
      console.warn(`[social-retry] ${label} network error (attempt ${attempt}/${maxAttempts}), retrying...`, err);
    }
    await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
  }
  // Unreachable in practice (loop always returns or throws above), but keeps TS happy.
  throw lastError ?? new Error(`[social-retry] ${label} failed after ${maxAttempts} attempts`);
}

const TOKEN_URLS: Record<string, string> = {
  twitter: "https://api.twitter.com/2/oauth2/token",
  linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
  // Instagram and Meta (Facebook/Messenger/WhatsApp) use their own refresh
  // flows — handled separately below. Meta products don't issue a
  // refresh_token at all, so they can't go through the generic path.
};

export async function getValidAccessToken(connectionId: number): Promise<string | null> {
  const conn = await prisma.socialConnection.findUnique({
    where: { id: connectionId }
  });

  if (!conn || !conn.accessToken) return null;

  // Check if token is expired (with 5 min buffer)
  const isExpired = conn.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() + 300_000;

  if (!isExpired) return conn.accessToken;

  // Token is expired, try to refresh

  // Instagram uses a unique refresh flow
  if (conn.platform === "instagram") {
    return refreshInstagramToken(conn);
  }

  // Facebook, Messenger, and WhatsApp (Meta) tokens are long-lived but have no
  // refresh_token — a still-valid token is exchanged for a fresh one instead.
  if (conn.platform === "facebook" || conn.platform === "messenger" || conn.platform === "whatsapp") {
    return refreshMetaToken(conn);
  }

  // Other platforms use standard refresh_token flow
  if (!conn.refreshToken) {
    console.warn(`[social-auth] Token expired for connection ${connectionId} and no refresh token available.`);
    return conn.accessToken; // Fallback to old token, maybe it still works
  }

  try {
    const platform = conn.platform;
    const tokenUrl = TOKEN_URLS[platform];
    if (!tokenUrl) return conn.accessToken;

    // Only Twitter and LinkedIn reach this generic path now (Instagram and
    // Meta products have their own refresh flows above).
    const clientId = platform === "twitter" ? process.env.TWITTER_CLIENT_ID : process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = platform === "twitter" ? process.env.TWITTER_CLIENT_SECRET : process.env.LINKEDIN_CLIENT_SECRET;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
      client_id: clientId ?? "",
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (platform === "twitter" && clientId && clientSecret) {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    const res = await fetchWithRetry(tokenUrl, {
      method: "POST",
      headers,
      body: body.toString(),
    }, { label: `refresh-token/${platform}` });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[social-auth] Refresh failed for ${platform} (connection ${connectionId}, status ${res.status}):`, err);
      await recordRefreshFailure(connectionId, platform);
      return conn.accessToken;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token ?? conn.refreshToken;
    const expiresIn = data.expires_in;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    await prisma.socialConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt,
        lastSyncError: null,
      }
    });
    return newAccessToken;
  } catch (err) {
    console.error(`[social-auth] Error refreshing token for connection ${connectionId}:`, err);
    await recordRefreshFailure(connectionId, conn.platform);
    return conn.accessToken;
  }
}

/**
 * Best-effort, user-friendly failure reason recorded on the connection when a
 * token refresh attempt fails — surfaced in Settings' Connected Accounts UI
 * instead of a bare "Needs reconnect" pill with no explanation. Never throws.
 */
async function recordRefreshFailure(connectionId: number, platform: string): Promise<void> {
  try {
    await prisma.socialConnection.update({
      where: { id: connectionId },
      data: { lastSyncError: `We couldn't refresh your ${platform} access token. Try reconnecting this account.` },
    });
  } catch {
    // Non-critical — the connection's expiresAt-derived "expired" status still surfaces the problem.
  }
}

/**
 * Instagram long-lived tokens are refreshed via GET request:
 * GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
 * Returns a new long-lived token valid for 60 days.
 */
async function refreshInstagramToken(conn: any): Promise<string | null> {
  try {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${conn.accessToken}`;
    const res = await fetchWithRetry(url, undefined, { label: "refresh-token/instagram" });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[social-auth] Instagram token refresh failed (connection ${conn.id}, status ${res.status}):`, err);
      await recordRefreshFailure(conn.id, "instagram");
      return conn.accessToken;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in; // typically 5184000 (60 days)
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    await prisma.socialConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: newAccessToken,
        expiresAt,
        lastSyncError: null,
      }
    });
    return newAccessToken;
  } catch (err) {
    console.error(`[social-auth] Instagram refresh error for connection ${conn.id}:`, err);
    await recordRefreshFailure(conn.id, "instagram");
    return conn.accessToken;
  }
}

/**
 * Facebook, Messenger, and WhatsApp all sit on top of the Meta Graph API,
 * which has no refresh_token grant. A long-lived token (~60 days) is
 * refreshed by exchanging the still-valid token for a new one via
 * `grant_type=fb_exchange_token` — the same call used to mint the long-lived
 * token right after OAuth (see app/api/social/callback/[platform]/route.ts).
 * If the token has already fully expired, Meta will reject the exchange and
 * the caller falls back to the stale token, same as every other platform's
 * refresh failure path — the user needs to reconnect at that point.
 */
async function refreshMetaToken(conn: any): Promise<string | null> {
  try {
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    if (!clientId || !clientSecret) return conn.accessToken;

    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: conn.accessToken,
    });
    const url = `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`;
    const res = await fetchWithRetry(url, undefined, { label: `refresh-token/${conn.platform}` });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[social-auth] Meta token refresh failed for ${conn.platform} (connection ${conn.id}, status ${res.status}):`, err);
      await recordRefreshFailure(conn.id, conn.platform);
      return conn.accessToken;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in ?? 5_184_000; // Meta long-lived tokens default to ~60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.socialConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: newAccessToken,
        expiresAt,
        refreshToken: null, // Meta never issues one for these products
        lastSyncError: null,
      }
    });
    return newAccessToken;
  } catch (err) {
    console.error(`[social-auth] Error refreshing Meta token for connection ${conn.id}:`, err);
    await recordRefreshFailure(conn.id, conn.platform);
    return conn.accessToken;
  }
}
