import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Platform OAuth config
const OAUTH_CONFIG: Record<string, {
  authUrl: string;
  scope: string;
  clientId: string;
  extraParams?: Record<string, string>;
  pkce?: boolean;
}> = {
  twitter: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    scope: "tweet.read users.read dm.read dm.write offline.access",
    clientId: process.env.TWITTER_CLIENT_ID ?? "",
    pkce: true,
  },
  instagram: {
    authUrl: "https://www.instagram.com/oauth/authorize",
    scope: "instagram_business_manage_messages,instagram_business_basic",
    clientId: process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID ?? "",
  },
  whatsapp: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "whatsapp_business_management,whatsapp_business_messaging",
    clientId: process.env.META_APP_ID ?? "",
  },
  messenger: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "pages_messaging,pages_manage_metadata,pages_show_list,public_profile",
    clientId: process.env.META_APP_ID ?? "",
  },
  facebook: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "pages_messaging,pages_manage_metadata,pages_show_list,public_profile",
    clientId: process.env.META_APP_ID ?? "",
  },
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    scope: "r_liteprofile r_emailaddress w_member_social",
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: platformRaw } = await params;
  const platform = platformRaw.toLowerCase();
  const config = OAUTH_CONFIG[platform];

  if (!config) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }

  if (!config.clientId) {
    return NextResponse.json(
      { error: `${platform} OAuth not configured. Add credentials to .env` },
      { status: 503 }
    );
  }

  const userId = request.nextUrl.searchParams.get("userId") ?? "1";
  const state = `${userId}:${platform}:${crypto.randomBytes(16).toString("hex")}`;

  const callbackUrl = `${APP_URL}/api/social/callback/${platform}`;
  const params2 = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: config.scope,
    state,
    ...(config.extraParams ?? {}),
  });

  // Twitter PKCE
  if (config.pkce) {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    params2.set("code_challenge", codeChallenge);
    params2.set("code_challenge_method", "S256");

    // Store verifier in a short-lived cookie
    const response = NextResponse.redirect(`${config.authUrl}?${params2}`);
    response.cookies.set(`pkce_${state}`, codeVerifier, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
    });
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  const response = NextResponse.redirect(`${config.authUrl}?${params2}`);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
