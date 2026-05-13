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
    clientId: process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID ?? "",
    clientSecret: process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET ?? "",
    // Instagram Business Login: use graph.facebook.com to fetch the connected IG business account
    profileUrl: "https://graph.facebook.com/me?fields=id,name,picture,instagram_business_account{id,username,profile_picture_url}",
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
  let code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Instagram sometimes appends #_ to the code
  if (code && code.endsWith("#_")) {
    code = code.slice(0, -2);
  }

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=${encodeURIComponent(error ?? "no_code")}`);
  }

  // State validation
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=state_mismatch`);
  }

  const [userIdStr, , ] = state.split(":");
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

    // Twitter uses Basic Auth. Instagram uses form body only (no Basic Auth header).
    if (config.pkce && config.clientId && config.clientSecret) {
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
      const safeErr = encodeURIComponent(errText.substring(0, 200));
      return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=token_failed_${safeErr}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string | null = tokenData.refresh_token ?? null;
    const expiresIn: number | null = tokenData.expires_in ?? null;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // Fetch profile
    let handle = "";
    let avatarUrl: string | null = null;
    let platformUserId = "";

    try {
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
          // Instagram Business Login returns a FB user token. The IG account is nested.
          const igAccount = profile.instagram_business_account;
          if (igAccount) {
            handle = "@" + (igAccount.username ?? "");
            avatarUrl = igAccount.profile_picture_url ?? null;
            platformUserId = igAccount.id ?? "";
          } else {
            // Fallback: use the FB user info
            handle = profile.name ?? "instagram";
            avatarUrl = profile.picture?.data?.url ?? null;
            platformUserId = profile.id ?? "";
          }
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
      }
    } catch {}

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
