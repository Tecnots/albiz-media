"use client";

import { SessionProvider } from "next-auth/react";
import { BanGuard } from "./components/BanGuard";

// Global fetch interceptor for injecting user-id header on Capacitor/mobile requests
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    let userIdHeader: Record<string, string> = {};
    try {
      const session = window.localStorage.getItem("albiz_user_session");
      if (session) {
        const parsed = JSON.parse(session);
        const userId = parsed?.id || parsed?.userId;
        if (userId) {
          userIdHeader = { "user-id": String(userId) };
        }
      }
    } catch (e) {}

    const initHeaders = init?.headers;
    let newHeaders: HeadersInit = { ...userIdHeader };

    if (initHeaders) {
      if (initHeaders instanceof Headers) {
        initHeaders.forEach((value, key) => {
          (newHeaders as Record<string, string>)[key] = value;
        });
      } else if (Array.isArray(initHeaders)) {
        initHeaders.forEach(([key, value]) => {
          (newHeaders as Record<string, string>)[key] = value;
        });
      } else {
        newHeaders = { ...newHeaders, ...initHeaders };
      }
    }

    return originalFetch.call(this, input, {
      ...init,
      headers: newHeaders,
    });
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BanGuard />
      {children}
    </SessionProvider>
  );
}
