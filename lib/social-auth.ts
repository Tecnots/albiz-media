import { prisma } from "./prisma";

const TOKEN_URLS: Record<string, string> = {
  twitter: "https://api.twitter.com/2/oauth2/token",
  instagram: "https://api.instagram.com/oauth/access_token",
  facebook: "https://graph.facebook.com/v19.0/oauth/access_token",
  messenger: "https://graph.facebook.com/v19.0/oauth/access_token",
  linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
};

export async function getValidAccessToken(connectionId: number): Promise<string | null> {
  const conn = await prisma.socialConnection.findUnique({
    where: { id: connectionId }
  });

  if (!conn || !conn.accessToken) return null;

  // Check if token is expired (with 5 min buffer)
  const isExpired = conn.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() + 300_000;
  
  if (!isExpired) return conn.accessToken;

  // Token is expired, try to refresh if we have a refresh token
  if (!conn.refreshToken) {
    console.warn(`[social-auth] Token expired for connection ${connectionId} and no refresh token available.`);
    return conn.accessToken; // Fallback to old token, maybe it still works
  }

  try {
    const platform = conn.platform;
    const tokenUrl = TOKEN_URLS[platform];
    if (!tokenUrl) return conn.accessToken;

    const clientId = platform === "twitter" ? process.env.TWITTER_CLIENT_ID : process.env.META_APP_ID;
    const clientSecret = platform === "twitter" ? process.env.TWITTER_CLIENT_SECRET : process.env.META_APP_SECRET;

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

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[social-auth] Refresh failed for ${platform}:`, err);
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
      }
    });

    return newAccessToken;
  } catch (err) {
    console.error(`[social-auth] Error refreshing token for connection ${connectionId}:`, err);
    return conn.accessToken;
  }
}
