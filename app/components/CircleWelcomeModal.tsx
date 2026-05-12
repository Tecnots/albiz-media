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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-md mx-4 bg-[#111111] rounded-2xl shadow-2xl overflow-hidden border border-white/10 ${closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} transition-all duration-300`}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5 text-[#a3a3a3]" />
        </button>

        {/* Header Background */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F44444]/20 to-transparent pointer-events-none" />

        <div className="p-8 relative">
          {/* Header */}
          <div className="text-center mb-8 pt-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#F44444] to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#F44444]/20">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-semibold text-white mb-3 tracking-tight">
              Welcome to Circle
            </h1>
            <p className="text-[#a3a3a3] text-sm max-w-[280px] mx-auto leading-relaxed">
              Your account has been officially upgraded to a premium Circle membership.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                <ShieldCheck className="w-5 h-5 text-[#F44444]" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Exclusive Content</h3>
                <p className="text-[#737373] text-sm">Create and view private stories and posts visible only to other Circle members.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                <Sparkles className="w-5 h-5 text-[#F44444]" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Enhanced Profile</h3>
                <p className="text-[#737373] text-sm">Stand out with a premium profile badge and priority visibility in searches.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                <Users className="w-5 h-5 text-[#F44444]" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Elite Networking</h3>
                <p className="text-[#737373] text-sm">Connect directly with verified businesses and industry leaders in the network.</p>
              </div>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleClose}
            className="w-full py-3.5 bg-white text-[#111111] rounded-xl text-sm font-bold hover:bg-[#f5f5f5] transition-all duration-200 active:scale-[0.98] shadow-lg shadow-white/5"
          >
            Explore Circle Features
          </button>
        </div>
      </div>
    </div>
  );
}
