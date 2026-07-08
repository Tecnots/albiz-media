"use client";

import { useEffect, useState, useContext } from "react";
import { X, Sparkles, ShieldCheck, Crown, Users } from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { AlbizLogo } from "@/app/lib/shared-components";

interface CircleWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CircleWelcomeModal({ isOpen, onClose }: CircleWelcomeModalProps) {
  const [closing, setClosing] = useState(false);
  const { updateUserProfile, userProfile } = useContext(AuthContext);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = async () => {
    setClosing(true);
    try {
      await fetch("/api/user/circle-welcome", { method: "PATCH" });
      if (userProfile && updateUserProfile) {
        updateUserProfile({ ...userProfile, circleWelcomeSeen: true });
      }
    } catch (error) {
      console.error("Failed to update welcome seen status:", error);
    }
    onClose();
  };

  if (!isOpen || !mounted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e5e5e5] ${closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} transition-all duration-300 max-h-[90dvh] flex flex-col`}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors z-10 min-touch-target"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1 min-h-0">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#FFF0F0] flex items-center justify-center border border-[#F44444]/10">
                <Crown className="w-6 h-6 text-[#F44444]" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">
              Welcome to Circle
            </h2>
            <p className="text-sm text-[#737373] text-center max-w-[280px] mx-auto leading-relaxed">
              Your account has been officially upgraded to a premium Circle membership.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa]">
              <div className="w-8 h-8 rounded-lg bg-[#FFF0F0] flex items-center justify-center flex-shrink-0 border border-[#F44444]/10">
                <ShieldCheck className="w-4 h-4 text-[#F44444]" />
              </div>
              <div>
                <h3 className="text-[#0a0a0a] text-xs font-semibold mb-0.5">Exclusive Content</h3>
                <p className="text-[#737373] text-xs">Create and view private stories and posts visible only to other Circle members.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa]">
              <div className="w-8 h-8 rounded-lg bg-[#FFF0F0] flex items-center justify-center flex-shrink-0 border border-[#F44444]/10">
                <Sparkles className="w-4 h-4 text-[#F44444]" />
              </div>
              <div>
                <h3 className="text-[#0a0a0a] text-xs font-semibold mb-0.5">Enhanced Profile</h3>
                <p className="text-[#737373] text-xs">Stand out with a premium profile badge and priority visibility in searches.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa]">
              <div className="w-8 h-8 rounded-lg bg-[#FFF0F0] flex items-center justify-center flex-shrink-0 border border-[#F44444]/10">
                <Users className="w-4 h-4 text-[#F44444]" />
              </div>
              <div>
                <h3 className="text-[#0a0a0a] text-xs font-semibold mb-0.5">Elite Networking</h3>
                <p className="text-[#737373] text-xs">Connect directly with verified businesses and industry leaders in the network.</p>
              </div>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-[#F44444] text-white rounded-xl text-sm font-semibold hover:bg-[#d64d3c] transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
          >
            Explore Circle Features
          </button>
        </div>
      </div>
    </div>
  );
}
