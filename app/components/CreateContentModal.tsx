"use client";

import { useContext } from "react";
import { X, PenLine, FileText, CircleDashed, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { StoryContext, AuthContext } from "@/app/lib/contexts";

interface CreateContentItem {
  type: "post" | "article" | "story";
  icon: typeof PenLine;
  label: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  cardBg: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateContentModal({ isOpen, onClose }: Props) {
  const { setShowCreatePost, setShowStoryCreator, setShowCreateArticle } = useContext(StoryContext);
  const { userRole } = useContext(AuthContext);
  const canWriteArticles = userRole === "ADMIN" || userRole === "AUTHOR" || userRole === "CIRCLE";
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  const handleSelect = (type: "post" | "article" | "story") => {
    onClose();
    if (type === "post") setShowCreatePost(true);
    else if (type === "article") setShowCreateArticle(true);
    else if (type === "story") setShowStoryCreator(true);
  };

  if (!isOpen) return null;

  const items: CreateContentItem[] = [
    {
      type: "post",
      icon: PenLine,
      label: "Post",
      desc: "Share your thoughts, images, videos or updates with your network.",
      iconBg: "#FFE0E0",
      iconColor: "#F44444",
      cardBg: "#FFF5F5",
    },
    ...(canWriteArticles
      ? [
          {
            type: "article" as const,
            icon: FileText,
            label: "Article",
            desc: "Write long form content and submit for review. Share your ideas in depth.",
            iconBg: "#DBEAFE",
            iconColor: "#3B82F6",
            cardBg: "#EFF6FF",
          },
        ]
      : []),
    ...(isCircle
      ? [
          {
            type: "story" as const,
            icon: CircleDashed,
            label: "Story",
            desc: "Share moments that disappear in 24 hours. Photos, videos and quick updates.",
            iconBg: "#EDE9FE",
            iconColor: "#8B5CF6",
            cardBg: "#F5F3FF",
          },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />

      {/* Desktop: Centered modal */}
      <div className="hidden md:flex items-center justify-center h-full">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-semibold text-[#0a0a0a]">Create Content</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
          <p className="text-sm text-[#737373] mb-5">Choose what you want to create</p>

          <div className={`grid gap-3 ${items.length === 3 ? "grid-cols-3" : items.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {items.map((item) => (
              <button
                key={item.type}
                onClick={() => handleSelect(item.type)}
                className="rounded-xl p-4 text-left transition-all hover:shadow-md cursor-pointer"
                style={{ backgroundColor: item.cardBg }}
              >
                <div className="flex justify-center mb-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: item.iconBg }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.iconColor }} />
                  </div>
                </div>
                <div className="text-center">
                  <span className="font-semibold text-sm text-[#0a0a0a] block mb-1">{item.label}</span>
                  <p className="text-xs text-[#737373] leading-relaxed">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Mobile: Bottom sheet */}
      <div className="md:hidden absolute bottom-0 left-0 right-0" onClick={(e) => e.stopPropagation()}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 340 }}
          className="bg-white rounded-t-2xl shadow-2xl"
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-[#d4d4d4] rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 pb-1">
            <h2 className="text-lg font-semibold text-[#0a0a0a]">Create</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
          <p className="text-sm text-[#737373] px-5 mb-3">Choose what you want to create</p>

          <div className="px-3 pb-5">
            {items.map((item) => (
              <button
                key={item.type}
                onClick={() => handleSelect(item.type)}
                className="flex items-center gap-3.5 w-full px-3 py-3.5 rounded-xl hover:bg-[#fafafa] transition-colors cursor-pointer"
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.iconBg }}
                >
                  <item.icon className="w-5 h-5" style={{ color: item.iconColor }} />
                </div>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-[15px] text-[#0a0a0a]">{item.label}</span>
                  <p className="text-[13px] text-[#737373] mt-0.5">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#a3a3a3] flex-shrink-0" />
              </button>
            ))}
          </div>

        </motion.div>
      </div>
    </div>
  );
}
