"use client";

import { usePushNotifications } from "@/app/lib/use-push-notifications";
import { BellRing, X } from "lucide-react";
import { useState, useEffect } from "react";

export function PushPromptBanner() {
  const { permission, isRegistering, requestAndRegister } = usePushNotifications(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if the permission is still default (not granted and not denied)
    // and if the user hasn't explicitly dismissed it this session
    if (permission === "default" && !sessionStorage.getItem("push_banner_dismissed")) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [permission]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem("push_banner_dismissed", "true");
    setIsVisible(false);
  };

  return (
    <div className="fixed top-3 left-3 right-3 sm:left-4 sm:right-4 bg-accent-tint border border-accent-tint-border rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-50">
      <div className="flex items-center gap-3">
        <BellRing className="w-5 h-5 flex-shrink-0 text-accent" />
        <p className="text-sm font-medium text-accent">
          Enable push notifications to get instantly notified about new stories and messages!
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
        <button
          onClick={() => requestAndRegister()}
          disabled={isRegistering}
          className="flex-1 sm:flex-none bg-accent text-accent-foreground px-4 py-1.5 rounded-full text-xs font-bold hover:bg-accent-hover transition-colors whitespace-nowrap disabled:opacity-50"
        >
          {isRegistering ? "Enabling..." : "Enable"}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-accent/60 hover:text-accent transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
