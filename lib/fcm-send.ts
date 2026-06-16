import { prisma } from "@/lib/prisma";

let adminInitialized = false;

async function getAdminMessaging() {
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getMessaging } = await import("firebase-admin/messaging");

  if (!adminInitialized && getApps().length === 0) {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountEnv) return null;
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
  payload: { title: string; body: string; url?: string }
) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return;
  try {
    const tokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });
    if (!tokens.length) return;

    const messaging = await getAdminMessaging();
    if (!messaging) return;

    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/favicon.ico",
        },
        fcmOptions: { link: payload.url || "/" },
      },
      data: payload.url ? { url: payload.url } : {},
    });

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
