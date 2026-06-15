"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image as ImageIcon, Eye, X } from "lucide-react";

interface AvatarOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasAvatar: boolean;
  onOptionSelect: (option: "view" | "camera" | "gallery") => void;
}

export default function AvatarOptionsModal({ isOpen, onClose, hasAvatar, onOptionSelect }: AvatarOptionsModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-white rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl z-10"
          >
            <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between bg-white">
              <h3 className="text-[17px] font-bold text-[#0a0a0a]">Profile Picture</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#525252] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 bg-white">
              {hasAvatar && (
                <button
                  onClick={() => onOptionSelect("view")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#f5f5f5] rounded-xl transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                    <Eye className="w-5 h-5 text-[#0a0a0a]" />
                  </div>
                  <span className="text-[15px] font-medium text-[#0a0a0a]">View profile picture</span>
                </button>
              )}
              
              <button
                onClick={() => onOptionSelect("camera")}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#f5f5f5] rounded-xl transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-[#0a0a0a]" />
                </div>
                <span className="text-[15px] font-medium text-[#0a0a0a]">Take photo</span>
              </button>

              <button
                onClick={() => onOptionSelect("gallery")}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#f5f5f5] rounded-xl transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-5 h-5 text-[#0a0a0a]" />
                </div>
                <span className="text-[15px] font-medium text-[#0a0a0a]">Choose from gallery</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
