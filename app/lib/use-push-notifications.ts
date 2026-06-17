"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase-client";

export function usePushNotifications(enabled = true) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const registerToken = useCallback(async () => {
    try {
      const messaging = getFirebaseMessaging();
      if (!messaging) return;

      const swReg = await navigator.serviceWorker.register("/api/push-sw", {
        scope: "/",
      });

      // Wait for SW to be active before calling getToken
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

  const requestAndRegister = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setIsRegistering(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        await registerToken();
      }
    } finally {
      setIsRegistering(false);
    }
  }, [registerToken]);

  const disable = useCallback(async () => {
    try {
      await fetch("/api/notifications/push-token", { method: "DELETE" });
    } catch {}
  }, []);

  // Silently re-register on mount if already granted (token may have rotated)
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      registerToken().catch(() => {});
    }
  }, [enabled, registerToken]);

  // Foreground message handler — FCM delivers to onMessage when the page is visible,
  // not to the service worker. Show the notification manually here.
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
        reg.showNotification(notif.title ?? "New notification", {
          body: notif.body ?? "",
          icon: "/favicon.ico",
          data,
        });
      });
    });

    return unsub;
  }, [enabled, permission]);

  return { permission, isRegistering, requestAndRegister, disable };
}
