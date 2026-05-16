import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncTwitterMessages } from "@/lib/social-sync";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Token exchange config
const TOKEN_CONFIG: Record<string, {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  profileUrl: string;
  pkce?: boolean;
}> = {
  twitter: {
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    clientId: process.env.TWITTER_CLIENT_ID ?? "",
    clientSecret: process.env.TWITTER_CLIENT_SECRET ?? "",
    profileUrl: "https://api.twitter.com/2/users/me?user.fields=profile_image_url,username",
    pkce: true,
  },
  instagram: {
    tokenUrl: "https://api.instagram.com/oauth/access_token",
<<<<<<< HEAD
    clientId: process.env.META_APP_ID ?? "",
    clientSecret: process.env.META_APP_SECRET ?? "",
    profileUrl: "https://graph.instagram.com/me?fields=id,username,profile_picture_url",
=======
    clientId: process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID ?? "",
    clientSecret: process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET ?? "",
    // Instagram Business Login: use graph.instagram.com to get IG user info
    profileUrl: "https://graph.instagram.com/me?fields=user_id,username,profile_picture_url,name",
>>>>>>> efd3e02cd92e79252f920a387792772aff4cf23f
  },
  whatsapp: {
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    clientId: process.env.META_APP_ID ?? "",
    clientSecret: process.env.META_APP_SECRET ?? "",
    // WhatsApp Business Account profile
    profileUrl: "https://graph.facebook.com/v19.0/me?fields=id,name",
  },
  messenger: {
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    clientId: process.env.META_APP_ID ?? "",
    clientSecret: process.env.META_APP_SECRET ?? "",
    profileUrl: "https://graph.facebook.com/me?fields=id,name,picture",
  },
  facebook: {
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    clientId: process.env.META_APP_ID ?? "",
    clientSecret: process.env.META_APP_SECRET ?? "",
    profileUrl: "https://graph.facebook.com/me?fields=id,name,picture",
  },
  linkedin: {
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    profileUrl: "https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))",
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: platformParam } = await params;
  const platform = platformParam.toLowerCase();
  const config = TOKEN_CONFIG[platform];
  if (!config) return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=unsupported`);

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=${encodeURIComponent(error ?? "no_code")}`);
  }

  // State validation
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=state_mismatch`);
  }

  const [userIdStr, ,] = state.split(":");
  const userId = Number(userIdStr);

  const callbackUrl = `${APP_URL}/api/social/callback/${platform}`;

  try {
    // Exchange code for token
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    // Twitter PKCE — attach code_verifier
    if (config.pkce) {
      const verifier = request.cookies.get(`pkce_${state}`)?.value;
      if (verifier) body.set("code_verifier", verifier);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Use Basic Auth header for confidential clients (required by Twitter)
    if (config.clientId && config.clientSecret) {
      const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers,
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[social/callback/${platform}] token error:`, errText);
      return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=token_failed`);
    }

    const tokenData = await tokenRes.json();
    let accessToken: string = tokenData.access_token;
    let refreshToken: string | null = tokenData.refresh_token ?? null;
    let expiresIn: number | null = tokenData.expires_in ?? null;
    let expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // ── Instagram: exchange short-lived token for long-lived token ──────────
    if (platform === "instagram") {
      try {
        const llUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${config.clientSecret}&access_token=${accessToken}`;
        const llRes = await fetch(llUrl);
        if (llRes.ok) {
          const llData = await llRes.json();
          console.log(`[social/callback/instagram] Long-lived token obtained, expires_in: ${llData.expires_in}s`);
          accessToken = llData.access_token;
          const llExpiresIn = llData.expires_in ?? 5184000; // default 60 days
          expiresIn = llExpiresIn;
          expiresAt = new Date(Date.now() + llExpiresIn * 1000);
          // Instagram long-lived tokens don't use refresh_token — they self-refresh via /refresh_access_token
          refreshToken = null;
        } else {
          const llErr = await llRes.text();
          console.error(`[social/callback/instagram] Failed to get long-lived token:`, llErr);
          // Continue with short-lived token — it'll work for ~1 hour
        }
      } catch (llError) {
        console.error(`[social/callback/instagram] Long-lived token exchange error:`, llError);
      }
    }

    // Fetch profile
    let handle = "";
    let avatarUrl: string | null = null;
    let platformUserId = "";

    try {
<<<<<<< HEAD
      const profileRes = await fetch(config.profileUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (platform === "twitter") {
          handle = "@" + (profile.data?.username ?? "");
          avatarUrl = profile.data?.profile_image_url ?? null;
          platformUserId = profile.data?.id ?? "";
        } else if (platform === "instagram") {
          handle = "@" + (profile.username ?? "");
          avatarUrl = profile.profile_picture_url ?? null;
          platformUserId = profile.id ?? "";
        } else if (platform === "facebook") {
          handle = profile.name ?? "";
          avatarUrl = profile.picture?.data?.url ?? null;
          platformUserId = profile.id ?? "";
        } else if (platform === "linkedin") {
          const first = profile.firstName?.localized?.en_US ?? "";
          const last = profile.lastName?.localized?.en_US ?? "";
          handle = `${first} ${last}`.trim();
          platformUserId = profile.id ?? "";
=======
      if (platform === "instagram") {
        // Instagram Business Login: use the IG token with graph.instagram.com
        const profileRes = await fetch(config.profileUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log(`[social/callback/instagram] Profile response status: ${profileRes.status}`);
        if (profileRes.ok) {
          const profile = await profileRes.json();
          console.log(`[social/callback/instagram] Profile data:`, JSON.stringify(profile));
          // graph.instagram.com/me returns { id, user_id, username, profile_picture_url, name }
          handle = "@" + (profile.username ?? "");
          avatarUrl = profile.profile_picture_url ?? null;
          // The `id` from graph.instagram.com/me IS the Instagram-scoped user ID (IGSID)
          // This is the same ID that appears as recipient.id in webhook events
          platformUserId = profile.user_id ?? profile.id ?? "";
        } else {
          const errText = await profileRes.text();
          console.error(`[social/callback/instagram] Profile fetch failed:`, errText);
        }
      } else {
        // All other platforms: use the standard profileUrl
        const profileRes = await fetch(config.profileUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (platform === "twitter") {
            handle = "@" + (profile.data?.username ?? "");
            avatarUrl = profile.data?.profile_image_url ?? null;
            platformUserId = profile.data?.id ?? "";
          } else if (platform === "facebook") {
            handle = profile.name ?? "";
            avatarUrl = profile.picture?.data?.url ?? null;
            platformUserId = profile.id ?? "";
          } else if (platform === "linkedin") {
            const first = profile.firstName?.localized?.en_US ?? "";
            const last = profile.lastName?.localized?.en_US ?? "";
            handle = `${first} ${last}`.trim();
            platformUserId = profile.id ?? "";
          }
>>>>>>> efd3e02cd92e79252f920a387792772aff4cf23f
        }
      }
    } catch { }

    // Upsert connection
    const conn = await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform } },
      create: {
        userId,
        platform,
        platformUserId,
        platformHandle: handle || platform,
        platformAvatarUrl: avatarUrl,
        accessToken,
        refreshToken,
        expiresAt,
        active: true,
      },
      update: {
        platformUserId,
        platformHandle: handle || platform,
        platformAvatarUrl: avatarUrl,
        accessToken,
        refreshToken,
        expiresAt,
        active: true,
      },
    });

    console.log(`[social/callback/${platform}] Connection saved: id=${conn.id}, platformUserId=${platformUserId}, handle=${handle}`);

    // Trigger initial sync for Twitter
    if (platform === "twitter") {
      syncTwitterMessages(conn.id, accessToken, platformUserId).catch(err => {
        console.error("[social/callback/twitter] initial sync failed:", err);
      });
    }

    const response = NextResponse.redirect(`${APP_URL}/settings?social=connected&platform=${platform}`);
    response.cookies.delete("oauth_state");
    if (config.pkce) response.cookies.delete(`pkce_${state}`);
    return response;
  } catch (err: unknown) {
    console.error(`[social/callback/${platform}]`, err);
    return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=server_error`);
  }
}
