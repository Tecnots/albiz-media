import { prisma } from "@/lib/prisma";

let adminInitialized = false;

async function getAdminMessaging() {
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getMessaging } = await import("firebase-admin/messaging");

  if (!adminInitialized && getApps().length === 0) {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountEnv) {
      console.warn("[FCM] Missing FIREBASE_SERVICE_ACCOUNT env var. Cannot initialize admin.");
      return null;
    }
    try {
      initializeApp({ credential: cert(JSON.parse(serviceAccountEnv)) });
      adminInitialized = true;
    } catch {
      return null;
    }
  } else {
    adminInitialized = true;
  }

  return getMessaging();
}

export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string; icon?: string; image?: string }
) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.warn("[FCM] Skipped sending push - FIREBASE_SERVICE_ACCOUNT is not configured.");
    return;
  }
  try {
    const tokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });
    console.log("[FCM] Found tokens for user", userId, ":", tokens.length);
    if (!tokens.length) return;

    const messaging = await getAdminMessaging();
    if (!messaging) return;

    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      data: {
        title: payload.title || "Notification",
        body: payload.body || "",
        url: payload.url || "/",
        icon: payload.icon || "/favicon.ico",
        image: payload.image || "",
        type: "DATA_ONLY",
      },
    });

    console.log("[FCM] Send response:", JSON.stringify({
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses
    }, null, 2));

    // Remove stale/invalid tokens
    const staleIds = tokens
      .filter((_, i) => {
        const r = response.responses[i];
        return (
          !r.success &&
          (r.error?.code === "messaging/invalid-registration-token" ||
            r.error?.code === "messaging/registration-token-not-registered")
        );
      })
      .map((t) => t.id);

    if (staleIds.length > 0) {
      await prisma.pushToken.deleteMany({ where: { id: { in: staleIds } } });
    }
  } catch (err) {
    console.error("FCM send error:", err);
  }
}
