import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    clientId: process.env.META_APP_ID ?? "",
    clientSecret: process.env.META_APP_SECRET ?? "",
    profileUrl: "https://graph.instagram.com/me?fields=id,username,profile_picture_url",
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

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[social/callback/${platform}] token error:`, errText);
      return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=token_failed`);
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
        }
      }
    } catch {}

    // Upsert connection
    await prisma.socialConnection.upsert({
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

    const response = NextResponse.redirect(`${APP_URL}/settings?social=connected&platform=${platform}`);
    response.cookies.delete("oauth_state");
    if (config.pkce) response.cookies.delete(`pkce_${state}`);
    return response;
  } catch (err: unknown) {
    console.error(`[social/callback/${platform}]`, err);
    return NextResponse.redirect(`${APP_URL}/settings?social=error&msg=server_error`);
  }
}
