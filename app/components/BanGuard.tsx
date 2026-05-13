"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert } from "lucide-react";

export function BanGuard() {
  const { data: session, status } = useSession();
  const [showBanModal, setShowBanModal] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.banned) {
      setShowBanModal(true);
    }
  }, [session, status]);

  return (
    <AnimatePresence>
      {showBanModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-[#e5e5e5]"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-[#0a0a0a] mb-3">Account Banned</h2>
            <p className="text-[#525252] mb-6 leading-relaxed">
              {(session?.user as any)?.banReason || "Your account has been suspended for violating our platform guidelines."}
              <br />
              <span className="text-xs mt-2 block text-[#737373]">If you believe this is a mistake, please contact our support team.</span>
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = "mailto:support@tecnots.com?subject=Account Banned Re-evaluation Request";
                  link.click();
                }}
                className="w-full py-3 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                Contact Admin (support@tecnots.com)
              </button>
              <button
                onClick={async () => {
                  await signOut({ redirect: false });
                  window.location.href = "/";
                }}
                className="w-full py-3 rounded-xl bg-[#0a0a0a] text-white text-sm font-semibold hover:bg-black transition-colors"
              >
                Sign Out Now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
