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
    <div className="bg-[#F44444] text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between shadow-md z-50 sticky top-0">
      <div className="flex items-center gap-3 mb-3 sm:mb-0">
        <BellRing className="w-5 h-5 flex-shrink-0 animate-bounce" />
        <p className="text-sm font-medium">
          Enable push notifications to get instantly notified about new stories and messages!
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
        <button
          onClick={() => requestAndRegister()}
          disabled={isRegistering}
          className="flex-1 sm:flex-none bg-white text-[#F44444] px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-100 transition-colors whitespace-nowrap shadow-sm disabled:opacity-50"
        >
          {isRegistering ? "Enabling..." : "Enable"}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
