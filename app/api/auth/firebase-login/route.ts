import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { upsertOAuthUser } from "@/lib/auth-upsert";
import { logActivity } from "@/lib/activity-logger";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded.email) {
      return NextResponse.json({ error: "No email found in token" }, { status: 400 });
    }

    const dbUser = await upsertOAuthUser(
      {
        email: decoded.email,
        name: (decoded.name as string) || decoded.email.split("@")[0],
        picture: (decoded.picture as string) || null,
        emailVerified: decoded.email_verified || true,
      },
      {
        provider: "firebase",
        providerAccountId: decoded.uid,
        type: "oauth",
      }
    );

    if (dbUser.banned) {
      return NextResponse.json({ error: "ACCOUNT_BANNED" }, { status: 403 });
    }

    // Log sign-in
    logActivity({ 
      eventType: "SIGNIN", 
      userId: dbUser.id, 
      userName: dbUser.name, 
      handle: dbUser.handle, 
      avatar: dbUser.avatar || undefined 
    });

    return NextResponse.json({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      handle: dbUser.handle,
      role: dbUser.role,
      avatar: dbUser.avatar,
      title: dbUser.title,
      verified: dbUser.verified,
      isPremium: dbUser.isPremium,
      canPost: dbUser.canPost,
    });
  } catch (error: any) {
    console.error("Firebase native login error:", error);
    return NextResponse.json({ error: "Authentication failed: " + (error.message || String(error)) }, { status: 500 });
  }
}
