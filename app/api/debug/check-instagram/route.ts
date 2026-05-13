import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Find the instagram connection
    const conn = await prisma.socialConnection.findFirst({
      where: { platform: "instagram", active: true }
    });
    if (!conn) return NextResponse.json({ error: "No instagram connection found" }, { status: 404 });

    // Try to fetch profile with the stored token
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,name&access_token=${conn.accessToken}`
    );
    const profileData = await profileRes.json();

    // Try to exchange for a long-lived token if we have INSTAGRAM_APP_SECRET
    let longLivedToken = null;
    let longLivedError = null;
    try {
      const llRes = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${conn.accessToken}`
      );
      const llData = await llRes.json();
      longLivedToken = llData;
    } catch (err: any) {
      longLivedError = err.message;
    }

    return NextResponse.json({
      conn: { id: conn.id, platform: conn.platform, platformHandle: conn.platformHandle, createdAt: conn.createdAt },
      profileFetch: { status: profileRes.status, data: profileData },
      longLivedToken,
      longLivedError,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
