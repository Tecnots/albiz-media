"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken } from "firebase/messaging";
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

  return { permission, isRegistering, requestAndRegister, disable };
}
