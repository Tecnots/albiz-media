"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase-client";
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";

export function usePushNotifications(enabled = true) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== "undefined" && localStorage.getItem("pushDisabled") === "true") {
      setPermission("default");
      return;
    }

    if (Capacitor.isNativePlatform()) {
      FirebaseMessaging.checkPermissions().then((result) => {
        if (result.receive === "granted") setPermission("granted");
        else if (result.receive === "denied") setPermission("denied");
        else setPermission("default");
      }).catch(() => {});
    } else if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, [enabled]);

  const registerToken = useCallback(async () => {
    try {
      let token: string | undefined = undefined;

      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseMessaging.getToken();
        token = result.token;
      } else {
        const messaging = getFirebaseMessaging();
        if (!messaging) return;

        // Skip silently when VAPID key is absent — avoids a doomed FCM fetch
        // that would throw TypeError: Failed to fetch and pollute the console.
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) return;

        if (!("serviceWorker" in navigator)) return;

        const swReg = await navigator.serviceWorker.register("/api/push-sw", { scope: "/" });
        await navigator.serviceWorker.ready;

        token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg,
        });
      }

      if (token) {
        const res = await fetch("/api/user/device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        // 401 means user is not signed in — silently skip; not an error
        if (!res.ok && res.status !== 401) {
          console.warn("[PushNotifications] Device registration failed:", res.status);
        }
      }
    } catch (err) {
      // Push notifications unavailable (offline, blocked, misconfigured Firebase)
      // — not a fatal error, just log at debug level.
      if (process.env.NODE_ENV === "development") {
        console.warn("[PushNotifications] Token registration skipped:", err instanceof Error ? err.message : err);
      }
    }
  }, []);

  const requestAndRegister = useCallback(async () => {
    setIsRegistering(true);
    if (typeof window !== "undefined") localStorage.removeItem("pushDisabled");
    try {
      if (Capacitor.isNativePlatform()) {
        const { receive } = await FirebaseMessaging.requestPermissions();
        if (receive === "granted") {
          setPermission("granted");
          await registerToken();
        } else {
          setPermission("denied");
        }
      } else if (typeof window !== "undefined" && "Notification" in window) {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm === "granted") {
          await registerToken();
        }
      }
    } catch (err) {
      console.error("Permission request failed", err);
    } finally {
      setIsRegistering(false);
    }
  }, [registerToken]);

  const disable = useCallback(async () => {
    try {
      let currentToken: string | null = null;
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseMessaging.getToken().catch(() => null);
        currentToken = result?.token || null;
      } else {
        const messaging = getFirebaseMessaging();
        if (messaging) {
          const swReg = await navigator.serviceWorker.getRegistration("/api/push-sw");
          if (swReg) {
            currentToken = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: swReg,
            }).catch(() => null);
          }
        }
      }
      
      const delRes = await fetch("/api/user/device", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentToken ? { token: currentToken } : {}),
      });
      if (!delRes.ok && delRes.status !== 401) {
        console.warn("[PushNotifications] Device deregistration failed:", delRes.status);
      }
      if (typeof window !== "undefined") localStorage.setItem("pushDisabled", "true");
      setPermission("default");
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== "undefined" && localStorage.getItem("pushDisabled") === "true") return;

    if (Capacitor.isNativePlatform()) {
      FirebaseMessaging.checkPermissions().then((result) => {
        if (result.receive === "granted") registerToken().catch(() => {});
      });
    } else if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") registerToken().catch(() => {});
    }
  }, [enabled, registerToken]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    if (Capacitor.isNativePlatform()) {
      const listener = FirebaseMessaging.addListener("notificationReceived", () => {});
      return () => { listener.then(l => l.remove()); };
    } else {
      const messaging = getFirebaseMessaging();
      if (!messaging) return;
      const unsub = onMessage(messaging, (payload) => {
        const data = payload.data ?? {};
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(data.title ?? "New notification", {
            body: data.body ?? "",
            icon: data.icon ?? "/favicon.ico",
            image: data.image || undefined,
            data: { url: data.url ?? "/" },
          } as any);
        });
      });
      return unsub;
    }
  }, [enabled, permission]);

  return { permission, isRegistering, requestAndRegister, disable };
}
