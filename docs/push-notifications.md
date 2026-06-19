# Web Push Notifications with Firebase Cloud Messaging (FCM)

A complete implementation guide for browser push notifications in a Next.js (App Router) project using Firebase Cloud Messaging. Covers setup, token management, foreground and background delivery, and per-user preference controls.

**Stack:** Next.js 14+ · Prisma · Firebase v10 (web SDK) · firebase-admin v14 · TypeScript

---

## How it works

```
User grants permission
        │
        ▼
Browser → getToken() → FCM → save token to DB
        │
        ▼
Any server action (like, follow, comment)
        │
        ▼
sendPushToUser(userId, payload)
        │
        ├─ App tab OPEN → onMessage() in page → reg.showNotification()
        └─ App tab CLOSED → Service Worker onBackgroundMessage() → showNotification()
```

FCM acts as the delivery broker between your server and the user's browser. The browser keeps a long-lived connection to FCM — your server just sends a message to FCM and it routes it to the right device.

---

## Prerequisites

1. A Firebase project — [console.firebase.google.com](https://console.firebase.google.com)
2. A Next.js App Router project with Prisma
3. Node.js 18+

---

## Step 1 — Firebase setup

### 1a. Enable Cloud Messaging

In the Firebase console:
- Go to **Project Settings → Cloud Messaging**
- Under **Web Push certificates**, click **Generate key pair**
- Copy the key pair — this is your **VAPID key**

### 1b. Get the service account JSON

- Go to **Project Settings → Service accounts**
- Click **Generate new private key**
- Download the JSON file
- Inline it as a single-line string for your `.env` file (escape newlines inside `private_key` as `\n`)

### 1c. Get the web app config

- Go to **Project Settings → General → Your apps**
- Register a web app if you haven't already
- Copy the `firebaseConfig` object

---

## Step 2 — Environment variables

```env
# Firebase web SDK — safe to expose publicly
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# VAPID key from Step 1a
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# Service account JSON from Step 1b — single line, \n preserved in private_key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"YOUR_PROJECT_ID","private_key":"-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@YOUR_PROJECT_ID.iam.gserviceaccount.com",...}
```

> **Note:** `FIREBASE_SERVICE_ACCOUNT` must be a single line with literal `\n` characters inside `private_key`. Do not use actual line breaks.

---

## Step 3 — Database

Add a `PushToken` table. One user can have multiple tokens (multiple devices / browsers).

```prisma
// prisma/schema.prisma

model PushToken {
  id        Int      @id @default(autoincrement())
  userId    Int
  token     String   @unique
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// Add to your User model:
// pushTokens PushToken[]
```

Apply:
```bash
npx prisma db push       # if your DB is ahead of migration history
# or
npx prisma migrate dev   # for greenfield projects
npx prisma generate
```

---

## Step 4 — Firebase client singleton

`lib/firebase-client.ts`

```typescript
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let messagingInstance: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

// SSR guard — Messaging only works in the browser
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (messagingInstance) return messagingInstance;
  messagingInstance = getMessaging(getFirebaseApp());
  return messagingInstance;
}
```

---

## Step 5 — Service worker

The service worker handles **background** push messages (when the tab is closed or hidden). Serving it from an API route (instead of a static file) lets you inject `process.env` values at runtime.

`app/api/push-sw/route.ts`

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const sw = `
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  var data = payload.data || {};
  var notif = payload.notification || {};
  self.registration.showNotification(data.title || notif.title || 'New notification', {
    body: data.body || notif.body || '',
    icon: data.icon || '/icon.png',
    badge: '/badge.png',
    tag: data.url || 'default',
    renotify: true,
    data: { url: data.url || '/' },
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) {
          list[i].navigate(url);
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
`;

  return new NextResponse(sw, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",   // allows /api/push-sw to control the root / scope
      "Cache-Control": "no-cache, no-store",
    },
  });
}
```

> **Why `Service-Worker-Allowed: /`?** By default a SW can only control URLs under its own path. This header lets the script at `/api/push-sw` control the root `/` scope.

---

## Step 6 — Token API

`app/api/notifications/push-token/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// Save a token for the current user
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { token } = await request.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  await prisma.pushToken.upsert({
    where: { token },
    create: { userId: authUser.id, token },
    update: { userId: authUser.id },
  });

  return NextResponse.json({ success: true });
}

// List tokens for the current user (useful for debugging)
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const tokens = await prisma.pushToken.findMany({
    where: { userId: authUser.id },
    select: { id: true, token: true, createdAt: true },
  });

  return NextResponse.json({ count: tokens.length, tokens });
}

// Delete one token (by body.token) or all tokens for the current user
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const body = await request.json().catch(() => ({}));

  if (body.token) {
    await prisma.pushToken.deleteMany({
      where: { userId: authUser.id, token: body.token },
    });
  } else {
    await prisma.pushToken.deleteMany({ where: { userId: authUser.id } });
  }

  return NextResponse.json({ success: true });
}
```

---

## Step 7 — Client hook

`app/lib/use-push-notifications.ts`

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase-client";

export function usePushNotifications(enabled = true) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isRegistering, setIsRegistering] = useState(false);

  // Read current browser permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Register the SW and save the FCM token to the server
  const registerToken = useCallback(async () => {
    try {
      const messaging = getFirebaseMessaging();
      if (!messaging) return;

      const swReg = await navigator.serviceWorker.register("/api/push-sw", {
        scope: "/",
      });

      await navigator.serviceWorker.ready;

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        await fetch("/api/notifications/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
    } catch (err) {
      console.error("Push token registration failed:", err);
    }
  }, []);

  // Ask for permission then register
  const requestAndRegister = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setIsRegistering(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") await registerToken();
    } finally {
      setIsRegistering(false);
    }
  }, [registerToken]);

  // Remove all tokens for this user from the server
  const disable = useCallback(async () => {
    try {
      await fetch("/api/notifications/push-token", { method: "DELETE" });
    } catch {}
  }, []);

  // Silently re-register on every mount to keep the token fresh (rotation)
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") registerToken().catch(() => {});
  }, [enabled, registerToken]);

  // Foreground handler — FCM delivers to onMessage (not SW) when the tab is open
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (permission !== "granted") return;

    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const unsub = onMessage(messaging, (payload) => {
      const notif = payload.notification ?? {};
      const data = payload.data ?? {};
      navigator.serviceWorker.ready.then((reg) => {
        const options: NotificationOptions = {
          body: data.body ?? notif.body ?? "",
          icon: data.icon || "/icon.png",
          badge: "/badge.png",
          tag: data.url || "default",
          data: { url: data.url || "/" },
        };
        (options as Record<string, unknown>).renotify = true;
        reg.showNotification(data.title || notif.title || "New notification", options);
      });
    });

    return unsub;
  }, [enabled, permission]);

  return { permission, isRegistering, requestAndRegister, disable };
}
```

---

## Step 8 — Mount in layout

Mount a setup component in your root layout so the token is refreshed on every page load for signed-in users.

```typescript
// app/(main)/layout.tsx
import { usePushNotifications } from "@/app/lib/use-push-notifications";

function PushNotificationsSetup() {
  const { isSignedIn } = useContext(AuthContext); // replace with your auth check
  usePushNotifications(isSignedIn);
  return null;
}

// Inside your layout JSX, inside the auth provider:
// <PushNotificationsSetup />
```

> Mount it **once only**. A duplicate mount causes double token registration.

---

## Step 9 — Server send utility

`lib/fcm-send.ts`

```typescript
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
  payload: {
    title: string;
    body: string;
    url?: string;
    icon?: string;   // actor avatar URL
    image?: string;  // post/content image URL
  }
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

    const data: Record<string, string> = {
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      icon: payload.icon || "",
      image: payload.image || "",
    };

    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/icon.png",
        },
        fcmOptions: { link: payload.url || "/" },
      },
      data,
    });

    // Auto-remove tokens FCM says are invalid
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
```

---

## Step 10 — Trigger from server actions

Call `sendPushToUser` fire-and-forget wherever you want to notify a user. Always `.catch(() => {})` so a push failure never breaks the primary action.

```typescript
// Example: notify post owner when someone likes their post
import { sendPushToUser } from "@/lib/fcm-send";

const actor = await prisma.user.findUnique({
  where: { id: actorUserId },
  select: { name: true, handle: true, avatar: true },
});

sendPushToUser(postOwnerId, {
  title: `${actor.name} liked your post`,
  body: postPreview.substring(0, 100),
  url: `/posts/${postId}`,
  icon: actor.avatar || undefined,
  image: postImage || undefined,
}).catch(() => {});
```

The `icon` (actor's avatar) and `image` (post photo) are optional but make the notification look significantly better — the OS renders the avatar as the notification icon and the image as a hero banner below the text.

---

## Settings UI

Expose enable/disable controls in your settings page using the hook:

```typescript
const { permission, isRegistering, requestAndRegister, disable } = usePushNotifications(true);

// permission === "default"  → show Enable button → onClick: requestAndRegister
// permission === "granted"  → show "Enabled on this device" + Disable button → onClick: disable
// permission === "denied"   → show "Blocked in browser settings" → no button
//                             (browser blocks programmatic permission requests once denied)
```

---

## Per-user preferences

Store push preferences as a JSON column on your User model (`notificationPrefs`). Guard each send with the relevant preference, defaulting to `true` (opt-out model):

```typescript
const prefs = user?.notificationPrefs as any;
const pushEnabled = prefs?.push?.likes ?? true;

if (pushEnabled) {
  sendPushToUser(userId, payload).catch(() => {});
}
```

---

## npm packages required

```bash
# Firebase web SDK (already a peer dep if you use Firebase Auth)
npm install firebase

# Firebase Admin SDK (server-side only)
npm install firebase-admin
```

---

## Testing

**Check token is in DB** (browser console on your app):
```js
fetch('/api/notifications/push-token').then(r => r.json()).then(console.log)
// Expected: { count: 1, tokens: [{ id, token, createdAt }] }
```

**Test SW notification directly** (browser console — bypasses FCM entirely):
```js
navigator.serviceWorker.ready.then(reg =>
  reg.showNotification('Test', { body: 'SW notification works', icon: '/icon.png' })
)
```

**Test full FCM pipeline from Node** (`test-fcm.mjs`):
```js
import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

if (getApps().length === 0) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const response = await getMessaging().sendEachForMulticast({
  tokens: ["YOUR_TOKEN_FROM_DB"],
  webpush: {
    notification: { title: "Test", body: "Hello from server" },
    fcmOptions: { link: "/" },
  },
});

console.log(response.successCount, response.failureCount);
```

```bash
node test-fcm.mjs
# Success: 1, Failure: 0
# messageId=projects/YOUR_PROJECT/messages/xxxxx
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Token count = 0 after clicking Enable | SW failed to register or `getToken()` errored | Open browser console, look for errors after clicking Enable |
| Permission granted but no notification | Foreground `onMessage` handler not set up | Ensure `usePushNotifications` is mounted and `permission` state is `"granted"` |
| FCM returns success but nothing appears | OS-level Do Not Disturb / Focus Assist is on | Disable Focus Assist (Windows) or Do Not Disturb (macOS) |
| Token save returns 401 | Auth cookie not sent — user is not signed in | Gate the hook with `usePushNotifications(isSignedIn)` |
| `migrate dev` fails with "drift detected" | DB is ahead of migration history | Use `prisma db push` instead |
| Multiple tokens for one user piling up | SW re-registered multiple times | Mount `<PushNotificationsSetup />` exactly once in the layout |
| Click on notification does nothing | SW `notificationclick` handler missing | Check the SW route includes the `notificationclick` listener |

---

## Security notes

- `FIREBASE_SERVICE_ACCOUNT` is a server-only secret. Never expose it to the client or commit it to git.
- `NEXT_PUBLIC_FIREBASE_*` values are intentionally public — they identify your Firebase project but cannot be used to send messages without the service account.
- FCM tokens are user-specific device identifiers. Treat them like session tokens — store them server-side only, never log them, and delete them on sign-out.
- The `PushToken` model uses `onDelete: Cascade` so tokens are automatically removed when the user is deleted.
