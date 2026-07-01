"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";

interface PushNotificationContextType {
  token: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType>({
  token: null,
  hasPermission: false,
  requestPermission: async () => {},
});

export const usePushNotifications = () => useContext(PushNotificationContext);

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    // Only run on iOS and Android devices, not on the web
    if (!Capacitor.isNativePlatform()) return;

    // Check current permissions
    checkPermissions();

    // Register push notification listeners
    registerListeners();

    return () => {
      // Cleanup listeners when component unmounts
      FirebaseMessaging.removeAllListeners();
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const { receive } = await FirebaseMessaging.checkPermissions();
      if (receive === 'granted') {
        setHasPermission(true);
        // If already granted, get the token
        await requestToken();
      }
    } catch (error) {
      console.error("Error checking push notification permissions:", error);
    }
  };

  const requestPermission = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { receive } = await FirebaseMessaging.requestPermissions();
      if (receive === 'granted') {
        setHasPermission(true);
        await requestToken();
      } else {
        setHasPermission(false);
      }
    } catch (error) {
      console.error("Error requesting push notification permissions:", error);
    }
  };

  const requestToken = async () => {
    try {
      const { token } = await FirebaseMessaging.getToken();
      setToken(token);
      // Here you would typically send the token to your backend
    } catch (error) {
      console.error("Error getting FCM device token:", error);
    }
  };

  const registerListeners = () => {
    // Fired when a push notification is received in the foreground
    FirebaseMessaging.addListener("notificationReceived", () => {
      // Optional: Show a custom toast or UI for foreground notification
    });

    // Fired when a push notification is tapped
    FirebaseMessaging.addListener("notificationActionPerformed", () => {
      // Handle navigation based on notification payload here
      // For example, if event.notification.data.url exists, route to it
    });
  };

  return (
    <PushNotificationContext.Provider value={{ token, hasPermission, requestPermission }}>
      {children}
    </PushNotificationContext.Provider>
  );
}
