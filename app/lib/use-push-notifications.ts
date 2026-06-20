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
      console.log("[Push Hook] Registering token...");
      const messaging = getFirebaseMessaging();
      if (!messaging) {
        console.log("[Push Hook] No messaging instance");
        return;
      }

      console.log("[Push Hook] Registering service worker...");
      const swReg = await navigator.serviceWorker.register("/api/push-sw", {
        scope: "/",
      });

      // Wait for SW to be active before calling getToken
      await navigator.serviceWorker.ready;

      console.log("[Push Hook] Fetching getToken...");
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      console.log("[Push Hook] FCM Token acquired:", token ? token.substring(0, 15) + "..." : "null");

      if (token) {
        console.log("[Push Hook] Sending token to backend API...");
        await fetch("/api/user/device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        console.log("[Push Hook] Token sent to backend successfully.");
      }
    } catch (err) {
      console.error("Push token registration failed:", err);
    }
  }, []);

  const requestAndRegister = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setIsRegistering(true);
    console.log("[Push Hook] Requesting notification permission...");
    try {
      const perm = await Notification.requestPermission();
      console.log("[Push Hook] Permission result:", perm);
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
      await fetch("/api/user/device", { method: "DELETE" });
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
      console.log("[Push Hook] Foreground message received:", payload);
      const data = payload.data ?? {};
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(data.title ?? "New notification", {
          body: data.body ?? "",
          icon: data.icon ?? "/favicon.ico",
          image: data.image || undefined,
          data: { url: data.url ?? "/" },
        });
      });
    });

    return unsub;
  }, [enabled, permission]);

  return { permission, isRegistering, requestAndRegister, disable };
}
