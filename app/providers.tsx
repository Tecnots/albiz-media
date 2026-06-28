"use client";

import { SessionProvider } from "next-auth/react";
import { BanGuard } from "./components/BanGuard";
import { PushNotificationProvider } from "./components/PushNotificationProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PushNotificationProvider>
        <BanGuard />
        {children}
      </PushNotificationProvider>
    </SessionProvider>
  );
}
