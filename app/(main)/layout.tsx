"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useContext, createContext, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from "next-auth/react";
import { motion, AnimatePresence, useAnimation, useMotionValue } from "framer-motion";
import { useGesture } from "@use-gesture/react";
import {
  Activity, Search, Users, Bell, Mail, Bookmark, BarChart3, Settings, User,
  Plus, PenLine, CircleDashed, Eye, EyeOff, X, ChevronLeft, ChevronRight, Heart, Send, MessageCircle,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Link2, List, ListOrdered, Smile, MapPin, Hash, AtSign,
  Clock, ImagePlus, Menu as MenuIcon, Play, Loader2, FileText, Pencil, Trash2,
  Share2, TrendingUp, ChevronUp, Globe, ChevronDown, Volume2, VolumeX, MoreVertical,
} from "lucide-react";
import { FollowingContext, CreatePostContext, CreateStoryContext, AuthContext, StoryContext, MobileContext, getAuthSubtitle, type UserRoleType, type UserProfile, type InteractionContext } from "@/app/lib/contexts";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getCroppedBlob } from "@/app/lib/crop-image";
import { users, navItems } from "@/app/lib/data";
import { AlbizLogo, VerifiedBadge } from "@/app/lib/shared-components";
import { Avatar } from "@/app/components/Avatar";
import { api } from "@/app/lib/api";
import { CircleUpgradeFormData } from "@/types/circle-upgrade";
import OnboardModal from "@/app/components/OnboardModal";
import CircleUpgradeForm from "@/components/CircleUpgradeForm";
import AvatarCropModal from "@/app/components/AvatarCropModal";
import CircleWelcomeModal from "@/app/components/CircleWelcomeModal";
import { isNative, initNativeApp, haptic, copyToClipboard } from "@/app/lib/capacitor";
import { signInWithGoogle } from "@/lib/google-signin";
import { signInWithApple } from "@/lib/apple-signin";
import { Share as CapacitorShare } from '@capacitor/share';
import { App as CapacitorApp } from '@capacitor/app';
import { Toast } from "@capacitor/toast";
import { usePushNotifications } from "@/app/lib/use-push-notifications";
import { PushPromptBanner } from "@/app/components/PushPromptBanner";
import { useContentTranslation } from "@/app/lib/useContentTranslation";
import { normalizeStoryStickers, type StickerElement } from "@/app/lib/storySticker";
import { StoryStickerContent } from "@/app/(main)/stories/StoryStickerContent";
import { StoryElementToolbar } from "@/app/(main)/stories/StoryElementToolbar";
import { MentionPicker } from "@/app/(main)/stories/MentionPicker";
import { HashtagPicker } from "@/app/(main)/stories/HashtagPicker";
import { MusicPicker } from "@/app/(main)/stories/MusicPicker";


function AdStoryViewer({ ad, onClose }: { ad: any; onClose: () => void }) {
  const { currentUserId } = useContext(AuthContext);
  const [progress, setProgress] = useState(0);
  const firedImpression = useRef(false);
  const DURATION = 7000;

  useEffect(() => {
    if (!firedImpression.current) {
      firedImpression.current = true;
      fetch("/api/ads/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: ad.campaignId, creativeId: ad.creativeId, type: "IMPRESSION", placement: "Stories", userId: currentUserId }),
      }).catch(() => { });
    }
  }, [ad.campaignId, currentUserId]);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct >= 100) { clearInterval(tick); onClose(); }
    }, 50);
    return () => clearInterval(tick);
  }, [onClose]);

  const handleCta = () => {
    fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: ad.campaignId, creativeId: ad.creativeId, type: "CLICK", placement: "Stories", userId: currentUserId }),
    }).catch(() => { });
    if (ad.ctaUrl) window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm h-full max-h-[calc(100dvh)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Background image */}
        {ad.image ? (
          <Image src={ad.image} alt={ad.title} fill sizes="(max-width: 640px) 100vw, 384px" priority className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

        {/* Progress bar */}
        <div className="absolute top-3 inset-x-3 h-0.5 bg-white/30 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-none" style={{ width: `${progress}%` }} />
        </div>

        {/* Header */}
        <div className="absolute top-6 inset-x-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 overflow-hidden flex-shrink-0">
              {ad.sponsor?.logo ? (
                <Image src={ad.sponsor.logo} alt={ad.sponsor.name} width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                  {(ad.sponsor?.name || "A").charAt(0)}
                </div>
              )}
            </div>
            <span className="text-white text-sm font-semibold">{ad.sponsor?.name}</span>
            <span className="text-white/60 text-xs">· Ad</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 inset-x-0 p-5 pb-8">
          <p className="text-white font-semibold text-lg leading-tight mb-1.5">{ad.title}</p>
          {ad.description && <p className="text-white/70 text-sm mb-4 line-clamp-2">{ad.description}</p>}
          <button
            onClick={handleCta}
            className="w-full py-3 rounded-2xl bg-white text-[#0a0a0a] text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            {ad.ctaText || "Learn More"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function StoryViewer({ onClose, viewingUserId, isAuthModalOpen }: { onClose: () => void; viewingUserId?: number | null; isAuthModalOpen?: boolean }) {
  const pathname = usePathname();
  const { currentUserId, userRole, isSignedIn, openAuthModal, requireGuestAuth } = useContext(AuthContext);
  const { following } = useContext(FollowingContext);
  const isCircleUser = userRole === "CIRCLE" || userRole === "ADMIN";

  // Fetch real stories from DB — no placeholders
  const [dbStories, setDbStories] = useState<Record<number, any[]>>({});
  const [dbUsers, setDbUsers] = useState<Record<number, any>>({});
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const refreshStories = () => {
    // If viewing a specific user's profile, fetch only their stories
    // Otherwise fetch all stories from all users
    const targetUserId = viewingUserId || undefined;
    api.getStories(targetUserId).then((data: any) => {
      const map: Record<number, any[]> = {};
      const userMap: Record<number, any> = {};
      for (const su of (data.storyUsers || [])) {
        // Filter stories based on visibility and user role
        const filteredStories = su.stories.filter((s: any) => {
          // Public stories are visible to everyone
          if (s.visibility === "public") return true;
          // Circle-only stories only visible to Circle users
          if (s.visibility === "circle" && isCircleUser) return true;
          // Circle-only stories not visible to non-Circle users
          return false;
        });
        map[su.user.id] = filteredStories;
        userMap[su.user.id] = su.user;
      }
      setDbStories(map);
      setDbUsers(userMap);
      setStoriesLoaded(true);
    }).catch(() => setStoriesLoaded(true));
  };
  useEffect(() => { refreshStories(); }, [viewingUserId, currentUserId]);

  // Build ordered list of users with real stories only
  const storyUsersList = Object.entries(dbStories).map(([uid, stories]) => {
    const u = dbUsers[Number(uid)] || users.find(u => u.id === Number(uid));
    return u ? { ...u, storyCount: stories.length } : null;
  }).filter((u): u is NonNullable<typeof u> => {
    if (!u || u.storyCount === 0) return false;
    return true;
  });

  const startUserIdx = 0; // Always start at index 0 since we only fetch one user's stories
  const [userIndex, setUserIndex] = useState(startUserIdx);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [replySent, setReplySent] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const [insightsTab, setInsightsTab] = useState<"viewers" | "activity" | "responses">("viewers");
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [insightsData, setInsightsData] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const storyOwnerId = storyUsersList[userIndex]?.id || currentUserId || 1;
  const storyOwner = dbUsers[storyOwnerId] || users.find(u => u.id === storyOwnerId) || users[0];

  // Map DB stories — ordered oldest first (API returns asc)
  const rawStories = dbStories[storyOwnerId] || [];
  const userStories = rawStories.map((s: any) => ({
    id: s.id,
    image: s.imageUrl,
    time: new Date(s.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
    views: s.views,
    likes: s.likes,
    shares: s.shares || 0,
    dbId: s.id,
    textOverlay: s.textOverlay || null,
    textColor: s.textColor || "#ffffff",
    textBold: s.textBold ?? false,
    textItalic: s.textItalic ?? false,
    textAlign: s.textAlign ?? "center",
    textPosX: s.textPosX ?? 50,
    textPosY: s.textPosY ?? 50,
    textScale: s.textScale ?? 1,
    textRotation: s.textRotation ?? 0,
    textOpacity: s.textOpacity ?? 1,
    textBackgroundColor: s.textBackgroundColor ?? null,
    location: s.location || null,
    locPosX: s.locPosX ?? 50,
    locPosY: s.locPosY ?? 20,
    imgPosX: s.imgPosX ?? 0,
    imgPosY: s.imgPosY ?? 0,
    imgScale: s.imgScale ?? 1,
    imgFit: s.imgFit || "contain",
    stickers: s.stickers ?? null,
  }));

  const isOwnStory = storyOwnerId === currentUserId;
  const story = userStories[current] || userStories[0];

  const {
    translated: translatedStoryFields,
    showTranslated: showTranslatedStory,
    isTranslatable: isStoryTranslatable,
    state: storyTranslateState,
    handleTranslate: handleTranslateStory,
    toggleOriginal: toggleOriginalStory,
    isRtl: isStoryRtl,
  } = useContentTranslation("story", story?.dbId ?? 0, {
    content: story?.textOverlay ?? undefined,
  });
  const displayStoryText = showTranslatedStory ? translatedStoryFields?.content ?? story?.textOverlay : story?.textOverlay;

  // If this story has a real question sticker, the reply box below doubles as
  // its answer box (Instagram-style — answering a question is just a targeted
  // reply, not a separate inbox).
  const activeQuestion = story
    ? normalizeStoryStickers(story.stickers).find((el): el is StickerElement & { type: "question" } => el.type === "question" && !!el.data.prompt)
    : undefined;

  // Prefill the answer box with the viewer's own prior response, if any —
  // supports "intentionally updating" an answer instead of only ever blank.
  useEffect(() => {
    if (!activeQuestion || !story?.dbId) return;
    api.getMyQuestionResponse(story.dbId, activeQuestion.id)
      .then((res) => { if (res.answer) setReplyText(res.answer); })
      .catch(() => {});
  }, [activeQuestion?.id, story?.dbId]);

  // Music sticker playback — a hidden <audio> element driven by the same
  // paused/current state as the story's own progress timer, trimmed to the
  // range chosen in the editor.
  const activeMusic = story
    ? normalizeStoryStickers(story.stickers).find((el): el is StickerElement & { type: "music" } => el.type === "music" && !!el.data.audioUrl)
    : undefined;
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicMuted, setMusicMuted] = useState(false);

  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio || !activeMusic) return;
    audio.currentTime = activeMusic.data.trimStart ?? 0;
    const onTimeUpdate = () => {
      const end = activeMusic.data.trimEnd;
      if (end && audio.currentTime >= end) audio.currentTime = activeMusic.data.trimStart ?? 0;
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, [activeMusic?.id, current]);

  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio || !activeMusic) return;
    if (paused || showInsights || isAuthModalOpen) audio.pause();
    else audio.play().catch(() => {});
  }, [paused, showInsights, isAuthModalOpen, activeMusic?.id]);

  // A question sticker's "answer" is a dedicated, private response, not a
  // DM — everything else typed in this box is a normal reply to the owner.
  const submitReplyOrAnswer = () => {
    const text = replyText.trim();
    if (!text) return;
    if (activeQuestion && story?.dbId) {
      api.submitQuestionResponse(story.dbId, activeQuestion.id, text).catch(() => {});
    } else {
      api.sendMessage(storyOwnerId, text, { storyImage: story.image }).catch(() => {});
    }
    setReplyText(""); setReplySent(true); setPaused(false);
    setTimeout(() => setReplySent(false), 2000);
  };

  // Close if no stories available
  useEffect(() => {
    if (storiesLoaded && userStories.length === 0) onClose();
  }, [storiesLoaded, userStories.length]);

  // Delete current story
  const handleDeleteStory = () => {
    if (!story?.dbId) return;
    api.deleteStory(story.dbId, currentUserId).then(() => {
      refreshStories();
      if (current > 0) setCurrent(c => c - 1);
      else if (userStories.length <= 1) onClose();
      setShowInsights(false);
    }).catch(() => { });
  };

  // Archive current story
  const handleArchiveStory = () => {
    if (!story?.dbId) return;
    api.updateStory(story.dbId, currentUserId, "archive").then(() => {
      refreshStories();
      if (current > 0) setCurrent(c => c - 1);
      else if (userStories.length <= 1) onClose();
      setShowInsights(false);
    }).catch(() => { });
  };

  const storyCircleViewers: any[] = insightsData?.viewers?.circle || [];
  const anonymousViewerCount: number = insightsData?.viewers?.other?.length || 0;
  const totalShares = story?.shares || 0;

  // Flag to defer closing to a useEffect (avoids setState-during-render)
  const [shouldClose, setShouldClose] = useState(false);
  useEffect(() => { if (shouldClose) onClose(); }, [shouldClose]);

  // Advance to next user's stories
  const advanceToNextUser = () => {
    if (userIndex < storyUsersList.length - 1) {
      setUserIndex(i => i + 1);
      setCurrent(0);
      setProgress(0);
      setShowInsights(false);
      setLiked(new Set());
      setReplyText("");
      setReplySent(false);
    } else {
      setShouldClose(true);
    }
  };

  // Go back to previous user's last story
  const retreatToPrevUser = () => {
    if (userIndex > 0) {
      const prevIdx = userIndex - 1;
      const prevUserId = storyUsersList[prevIdx]?.id;
      const prevCount = prevUserId ? (dbStories[prevUserId]?.length || 0) : 0;
      setUserIndex(prevIdx);
      setCurrent(Math.max(0, prevCount - 1));
      setProgress(0);
      setShowInsights(false);
    }
  };

  useEffect(() => {
    if (paused || showInsights || isAuthModalOpen) return;
    const interval = setInterval(() => {
      setProgress(prev => prev >= 100 ? 100 : prev + 2);
    }, 100);
    return () => clearInterval(interval);
  }, [paused, showInsights, isAuthModalOpen]);

  useEffect(() => {
    if (progress >= 100) {
      if (current < userStories.length - 1) {
        setCurrent(c => c + 1);
        setProgress(0);
      } else {
        advanceToNextUser();
      }
    }
  }, [progress, current, userStories.length]);

  const goNext = () => {
    if (current < userStories.length - 1) {
      setCurrent(c => c + 1);
      setProgress(0);
      setShowInsights(false);
      setShowOwnerMenu(false);
    } else {
      advanceToNextUser();
    }
  };

  const goPrev = () => {
    if (current > 0) {
      setCurrent(c => c - 1);
      setProgress(0);
      setShowInsights(false);
      setShowOwnerMenu(false);
    } else {
      retreatToPrevUser();
    }
  };

  const toggleLike = () => {
    if (!isSignedIn) { requireGuestAuth("like", toggleLike); return; }
    if (isOwnStory) return; // can't like own story
    const wasLiked = liked.has(current);
    setLiked(prev => {
      const next = new Set(prev);
      if (next.has(current)) next.delete(current);
      else next.add(current);
      return next;
    });
    // Persist to DB
    if (story?.dbId) {
      api.storyAction(story.dbId, wasLiked ? "unlike" : "like", currentUserId).catch(() => { });
    }
  };

  const handleShare = async () => {
    if (story?.image) {
      const url = typeof window !== "undefined" ? window.location.href : "";
      const title = `${storyOwner.name}'s Story`;
      const text = story.textOverlay || "Check out this story!";

      if (isNative) {
        try {
          await CapacitorShare.share({ title, text, url });
        } catch (err) {
          console.error("Share failed:", err);
        }
        return;
      }

      try {
        if (navigator.share) {
          await navigator.share({ title, text, url });
        } else {
          // Fallback: copy to clipboard
          const success = await copyToClipboard(url);
          if (success) {
            alert("Link copied to clipboard!");
          } else {
            alert("Sharing is not supported on this device.");
          }
        }
      } catch (err) {
        console.error("Share failed:", err);
      }
    }
  };

  const openInsights = async () => {
    setPaused(true);
    setShowInsights(true);
    setInsightsTab("viewers");
    setLoadingInsights(true);
    setInsightsData(null);

    if (story?.dbId && isOwnStory) {
      try {
        const data = await fetch(`/api/stories/${story.dbId}/insights`).then(r => r.json());
        setInsightsData(data);
      } catch (e) {
        console.error("Failed to fetch insights:", e);
      } finally {
        setLoadingInsights(false);
      }
    } else {
      setLoadingInsights(false);
    }
  };

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  // Track views for real DB stories
  useEffect(() => {
    if (story?.dbId) {
      api.storyAction(story.dbId, "view", currentUserId).catch(() => { });
    }
  }, [current, userIndex, story?.dbId, currentUserId]);

  // If no story available, show loading or nothing
  if (!story) return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      {!storiesLoaded && <Loader2 className="w-8 h-8 text-white/50 animate-spin" />}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black flex md:bg-black/95 items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3 md:max-w-md md:mx-auto">
        {userStories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-100 ease-linear" style={{ width: `${i < current ? 100 : i === current ? progress : 0}%` }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 z-30 flex items-center justify-between px-4 md:max-w-md md:mx-auto">
        <Link href={`/${storyOwner.handle}?from=${encodeURIComponent(pathname)}`} onClick={onClose} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Avatar src={storyOwner.avatar} name={storyOwner.name} size={40} className="ring-2 ring-white/50" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white text-sm font-semibold">{storyOwner.name}</span>
              {storyOwner.verified && <VerifiedBadge className="scale-75" />}
            </div>
            <span className="text-white/60 text-xs">{story.time}</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {activeMusic && (
            <button onClick={() => setMusicMuted(m => !m)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              {musicMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          )}
          {isOwnStory && (
            <div className="relative">
              <button
                onClick={() => { setShowOwnerMenu(prev => !prev); setPaused(true); }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-white" />
              </button>
              {showOwnerMenu && (
                <>
                  <div className="fixed inset-0 z-[201]" onClick={() => { setShowOwnerMenu(false); setPaused(false); }} />
                  <div className="absolute top-full right-0 mt-1 z-[202] bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-2xl min-w-[150px]">
                    <button
                      onClick={() => { handleArchiveStory(); setShowOwnerMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white/80 text-sm hover:bg-white/5 transition-colors"
                    >
                      <Bookmark className="w-4 h-4 flex-shrink-0" />
                      Archive
                    </button>
                    <div className="h-px bg-white/10 mx-4" />
                    <button
                      onClick={() => { handleDeleteStory(); setShowOwnerMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[#F44444] text-sm hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 flex-shrink-0" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={() => setPaused(p => !p)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            {paused ? (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            )}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {activeMusic && <audio ref={musicAudioRef} src={activeMusic.data.audioUrl} muted={musicMuted} loop={false} />}

      {/* Forward / Backward buttons — hidden on mobile, tap areas handle nav */}
      <button
        onClick={goPrev}
        disabled={current === 0}
        className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full items-center justify-center transition-all ${current === 0 ? "opacity-0 pointer-events-none" : "bg-white/15 hover:bg-white/25 backdrop-blur-sm"
          }`}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={goNext}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm items-center justify-center transition-all"
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Story image — keyed per story so each one gets a clean mount */}
      <div className="w-full h-full md:h-auto md:max-w-md md:aspect-[9/16] relative md:rounded-xl overflow-hidden bg-black">
        <div key={`story-${storyOwnerId}-${current}`} className="absolute inset-0 animate-storyFadeIn">
          <Image
            src={story.image}
            alt={`Story ${current + 1}`}
            fill
            unoptimized
            className={`${story.imgFit === "cover" ? "object-cover" : "object-contain"} bg-black`}
            style={{ transform: `translate(${story.imgPosX || 0}px, ${story.imgPosY || 0}px) scale(${story.imgScale || 1})` }}
          />

          {/* Text overlay — at saved position */}
          {story.textOverlay && (
            <div
              className="absolute z-30 px-2 max-w-[90%]"
              style={{
                left: `${story.textPosX ?? 50}%`,
                top: `${story.textPosY ?? 50}%`,
                transform: `translate(-50%, -50%) rotate(${story.textRotation ?? 0}deg) scale(${story.textScale ?? 1})`,
                opacity: story.textOpacity ?? 1,
                ...(story.textBackgroundColor ? { backgroundColor: story.textBackgroundColor, borderRadius: 8, padding: "4px 8px" } : {}),
              }}
            >
              <p
                className={`text-xl drop-shadow-lg ${showTranslatedStory ? "whitespace-normal" : "whitespace-nowrap"} ${story.textBold ? "font-bold" : "font-medium"} ${story.textItalic ? "italic" : ""}`}
                style={{ color: story.textColor || "#ffffff", textAlign: (story.textAlign || "center") as any }}
                dir={isStoryRtl ? "rtl" : undefined}
              >
                {displayStoryText}
              </p>
            </div>
          )}

          {/* Location badge — at saved position */}
          {story.location && (
            <div
              className="absolute z-30 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1"
              style={{
                left: `${story.locPosX ?? 50}%`,
                top: `${story.locPosY ?? 20}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <MapPin className="w-3 h-3 text-white" />
              <span className="text-white text-xs font-medium">{story.location}</span>
            </div>
          )}

          {/* Saved stickers — normalized so old (position-only) and new (content-bearing) shapes both render */}
          {normalizeStoryStickers(story.stickers).map((el) => {
            const style = {
              left: `${el.x}%`,
              top: `${el.y}%`,
              transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale})`,
              opacity: el.opacity,
              zIndex: 30 + el.zIndex,
            };
            const bg =
              el.type === "poll" || el.type === "question"
                ? "rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.22)]"
                : el.type === "music"
                ? "bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
                : "bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]";
            return (
              <div key={el.id} className={`absolute ${bg}`} style={style}>
                <StoryStickerContent
                  element={el}
                  storyTime={story.time}
                  storyId={story.dbId}
                  isSignedIn={isSignedIn}
                  requireGuestAuth={requireGuestAuth}
                />
              </div>
            );
          })}
        </div>

        {/* Gradients — outside the keyed container so they don't flash */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Bottom section — different for own vs others */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
          {isStoryTranslatable && (
            <div className="flex justify-center mb-2">
              <button
                onClick={showTranslatedStory ? toggleOriginalStory : handleTranslateStory}
                disabled={storyTranslateState === "loading"}
                className="text-xs text-white/70 hover:text-white transition-colors bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 disabled:opacity-60"
              >
                {showTranslatedStory ? "Show original" : storyTranslateState === "loading" ? "Translating…" : "Translate"}
              </button>
            </div>
          )}
          {isOwnStory ? (
            /* ── OWN STORY: Show analytics summary + swipe-up hint ── */
            <div>
              {/* Swipe up / tap hint */}
              <button
                onClick={openInsights}
                className="w-full flex flex-col items-center mb-3 group"
              >
                <ChevronUp className="w-5 h-5 text-white/60 group-hover:text-white transition-colors animate-bounce" />
                <span className="text-white/50 text-[10px] group-hover:text-white/80 transition-colors">View insights</span>
              </button>
              {/* Quick stats row */}
              <div className="flex items-center justify-between">
                <button onClick={openInsights} className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-white/90">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium">{story.views}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-white/90">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm font-medium">{story.likes}</span>
                  </span>
                  {totalShares > 0 && (
                    <span className="flex items-center gap-1.5 text-white/90">
                      <Share2 className="w-4 h-4" />
                      <span className="text-sm font-medium">{totalShares}</span>
                    </span>
                  )}
                </button>
                {/* Stacked viewer avatars */}
                <button onClick={openInsights} className="flex items-center -space-x-2">
                  {story?.views > 0 ? (
                    <>
                      {/* Show up to 3 viewer placeholders based on actual view count */}
                      {Array.from({ length: Math.min(3, story.views) }, (_, i) => (
                        <div key={`viewer-${i}`} className="w-7 h-7 rounded-full bg-[#d4d4d4/50] ring-2 ring-black/80 flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-400" />
                        </div>
                      ))}
                      {story.views > 3 && (
                        <div className="w-7 h-7 rounded-full bg-white/20 ring-2 ring-black/80 flex items-center justify-center">
                          <span className="text-[9px] text-white font-semibold">+{story.views - 3}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    /* No views yet */
                    <div className="w-7 h-7 rounded-full bg-[#d4d4d4/30] ring-2 ring-black/80 flex items-center justify-center">
                      <Eye className="w-3 h-3 text-gray-500" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ── OTHER'S STORY: Circle users can reply (goes to DMs), others can only like ── */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {isCircleUser ? (
                  /* Circle user — full reply input that sends to messages.
                     Doubles as the answer box when the story has a question sticker. */
                  <div className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2.5 border border-white/20">
                    {replySent ? (
                      <span className="flex-1 text-sm text-white/70 text-center">Sent to {storyOwner.name.split(" ")[0]}</span>
                    ) : (
                      <>
                        <input
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder={activeQuestion ? "Type your answer..." : `Reply to ${storyOwner.name.split(" ")[0]}...`}
                          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                          onFocus={() => setPaused(true)}
                          onBlur={() => { if (!replyText) setPaused(false); }}
                          onKeyDown={e => {
                            if (e.key === "Enter" && replyText.trim()) {
                              submitReplyOrAnswer();
                            }
                          }}
                        />
                        {replyText && (
                          <button onClick={submitReplyOrAnswer} className="text-[#F44444] text-xs font-semibold">Send</button>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
                <button onClick={toggleLike} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Heart className={`w-6 h-6 ${liked.has(current) ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
                </button>
                <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Share2 className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tap areas for navigation */}
      <button onClick={goPrev} className="absolute left-0 top-20 w-1/4 h-[calc(100%-200px)] z-20" />
      <button onClick={goNext} className="absolute right-0 top-20 w-1/4 h-[calc(100%-200px)] z-20" />

      {/* ── INSIGHTS PANEL (own stories only) — slides up from bottom ── */}
      {showInsights && isOwnStory && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowInsights(false); setPaused(false); }}>
          <div className="absolute bottom-0 left-0 right-0 md:max-w-md md:mx-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1a1a1a] rounded-t-2xl max-h-[70vh] overflow-hidden">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Insights header with stats */}
              <div className="px-5 pb-3">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white text-base font-semibold">Story insights</span>
                  <button onClick={() => { setShowInsights(false); setPaused(false); }} className="p-1 hover:bg-white/10 rounded-full">
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <Eye className="w-4 h-4 text-white/50 mx-auto mb-1" />
                    <span className="text-xl font-bold text-white block">{loadingInsights ? "-" : (insightsData?.stats?.views ?? story.views)}</span>
                    <span className="text-[10px] text-white/40">Views</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <Heart className="w-4 h-4 text-white/50 mx-auto mb-1" />
                    <span className="text-xl font-bold text-white block">{loadingInsights ? "-" : (insightsData?.stats?.likes ?? story.likes)}</span>
                    <span className="text-[10px] text-white/40">Likes</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <Share2 className="w-4 h-4 text-white/50 mx-auto mb-1" />
                    <span className="text-xl font-bold text-white block">{loadingInsights ? "-" : (insightsData?.stats?.shares ?? story.shares)}</span>
                    <span className="text-[10px] text-white/40">Shares</span>
                  </div>
                </div>

                {/* Reach summary */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 mb-3">
                  <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-xs text-white/70">
                    {loadingInsights ? (
                      "Loading..."
                    ) : insightsData?.viewers ? (
                      <>
                        <span className="text-[#22c55e] font-semibold">{insightsData.viewers.circle?.length || 0} Circle members</span> and <span className="text-white/90 font-semibold">{insightsData.viewers.other?.length || 0} others</span> reached
                      </>
                    ) : (
                      <>
                        <span className="text-[#22c55e] font-semibold">{storyCircleViewers.length} Circle members</span> and <span className="text-white/90 font-semibold">{anonymousViewerCount} others</span> reached
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setInsightsTab("viewers")}
                  className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${insightsTab === "viewers" ? "text-white border-b-2 border-[#F44444]" : "text-white/40"}`}
                >
                  Viewers
                </button>
                <button
                  onClick={() => setInsightsTab("activity")}
                  className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${insightsTab === "activity" ? "text-white border-b-2 border-[#F44444]" : "text-white/40"}`}
                >
                  Activity
                </button>
                {activeQuestion && (
                  <button
                    onClick={() => setInsightsTab("responses")}
                    className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${insightsTab === "responses" ? "text-white border-b-2 border-[#F44444]" : "text-white/40"}`}
                  >
                    Responses
                  </button>
                )}
              </div>

              {/* Tab content */}
              <div className="overflow-y-auto max-h-[35vh]">
                {insightsTab === "responses" ? (
                  /* Responses tab — private answers to the story's Question sticker */
                  <div className="px-2 py-2">
                    {loadingInsights ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
                    ) : (insightsData?.questionResponses?.circle?.length || insightsData?.questionResponses?.other?.length) ? (
                      <>
                        {[...(insightsData.questionResponses.circle ?? []), ...(insightsData.questionResponses.other ?? [])].map((r: any) => (
                          <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl">
                            <Avatar src={r.avatar} name={r.name} size={36} className="ring-1 ring-white/20" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white text-sm font-medium truncate">{r.name}</span>
                                {r.verified && <VerifiedBadge className="scale-75" />}
                                <span className="text-white/30 text-[10px] ml-auto flex-shrink-0">{r.respondedAt}</span>
                              </div>
                              <p className="text-white/70 text-xs mt-0.5">{r.answer}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-center py-6 text-white/30 text-xs">No responses yet</p>
                    )}
                  </div>
                ) : insightsTab === "viewers" ? (
                  <div className="px-2 py-2">
                    {loadingInsights ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
                    ) : insightsData?.viewers ? (
                      <>
                        {/* Circle member viewers with profiles */}
                        {insightsData.viewers.circle?.map((viewer: any) => (
                          <Link key={viewer.id} href={`/${viewer.handle}?from=${encodeURIComponent(pathname)}`} onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                            <Avatar src={viewer.avatar} name={viewer.name} size={40} className="ring-1 ring-white/20" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white text-sm font-medium truncate">{viewer.name}</span>
                                {viewer.verified && <VerifiedBadge className="scale-75" />}
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#F44444]/20 text-[#F44444] flex-shrink-0">Circle</span>
                              </div>
                              <span className="text-white/40 text-xs">{viewer.viewedAt}</span>
                            </div>
                          </Link>
                        ))}

                        {/* Other viewers (non-followers) */}
                        {insightsData.viewers.other?.map((viewer: any) => (
                          <div key={viewer.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                            <Avatar src={viewer.avatar} name={viewer.name} size={40} className="ring-1 ring-white/20" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white text-sm font-medium truncate">{viewer.name}</span>
                                {viewer.verified && <VerifiedBadge className="scale-75" />}
                              </div>
                              <span className="text-white/40 text-xs">{viewer.viewedAt}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        {/* Derived viewer list */}
                        {storyCircleViewers.map(viewer => (
                          <Link key={viewer.id} href={`/${viewer.handle}?from=${encodeURIComponent(pathname)}`} onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                            <Avatar src={viewer.avatar} name={viewer.name} size={40} className="ring-1 ring-white/20" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white text-sm font-medium truncate">{viewer.name}</span>
                                {viewer.verified && <VerifiedBadge className="scale-75" />}
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#F44444]/20 text-[#F44444] flex-shrink-0">Circle</span>
                              </div>
                              <span className="text-white/40 text-xs">{viewer.viewedAt}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {viewer.likedStory && <Heart className="w-3.5 h-3.5 text-[#F44444] fill-[#F44444]" />}
                            </div>
                          </Link>
                        ))}

                        {anonymousViewerCount > 0 && (
                          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                              <Users className="w-5 h-5 text-white/40" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-white/60 text-sm">+{anonymousViewerCount} other viewers</span>
                              <span className="text-white/30 text-xs block">Non-Circle members (anonymous)</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  /* Activity tab — likes and shares breakdown */
                  <div className="px-4 py-3 space-y-4">
                    {loadingInsights ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
                    ) : insightsData?.likes ? (
                      <>
                        {/* Likes section */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-3.5 h-3.5 text-[#F44444]" />
                            <span className="text-xs text-white/50 font-medium">{insightsData.stats?.likes || 0} likes</span>
                          </div>
                          <div className="space-y-1">
                            {insightsData.likes.circle?.map((liker: any) => (
                              <Link key={liker.id} href={`/${liker.handle}?from=${encodeURIComponent(pathname)}`} onClick={onClose} className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity">
                                <Avatar src={liker.avatar} name={liker.name} size={32} className="ring-1 ring-white/20" />
                                <span className="text-white text-xs font-medium truncate">{liker.name}</span>
                                <Heart className="w-3 h-3 text-[#F44444] fill-[#F44444] ml-auto flex-shrink-0" />
                              </Link>
                            ))}
                            {insightsData.likes.other?.map((liker: any) => (
                              <div key={liker.id} className="flex items-center gap-2.5 py-1.5">
                                <Avatar src={liker.avatar} name={liker.name} size={32} className="ring-1 ring-white/20" />
                                <span className="text-white text-xs font-medium truncate">{liker.name}</span>
                                <Heart className="w-3 h-3 text-[#F44444] fill-[#F44444] ml-auto flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Shares section */}
                        {(insightsData.stats?.shares || 0) > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Share2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                              <span className="text-xs text-white/50 font-medium">{insightsData.stats.shares} shares</span>
                            </div>
                            <span className="text-white/30 text-[10px]">Shared via direct message</span>
                          </div>
                        )}

                        {/* Engagement rate */}
                        <div className="bg-white/5 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
                            <span className="text-xs text-white/60">Engagement rate</span>
                          </div>
                          <span className="text-lg font-bold text-white">{(insightsData.stats?.views || 0) > 0 ? Math.round(((insightsData.stats?.likes || 0) / (insightsData.stats?.views || 1)) * 100) : 0}%</span>
                          <span className="text-[10px] text-white/30 block">Based on likes / views</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Derived likes list */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-3.5 h-3.5 text-[#F44444]" />
                            <span className="text-xs text-white/50 font-medium">{story.likes} likes</span>
                          </div>
                          <div className="space-y-1">
                            {storyCircleViewers.filter(v => v.likedStory).map(viewer => (
                              <Link key={viewer.id} href={`/${viewer.handle}?from=${encodeURIComponent(pathname)}`} onClick={onClose} className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity">
                                <Avatar src={viewer.avatar} name={viewer.name} size={32} className="ring-1 ring-white/20" />
                                <span className="text-white text-xs font-medium truncate">{viewer.name}</span>
                                <Heart className="w-3 h-3 text-[#F44444] fill-[#F44444] ml-auto flex-shrink-0" />
                              </Link>
                            ))}
                            {story.likes > storyCircleViewers.filter(v => v.likedStory).length && (
                              <span className="text-white/30 text-[10px] block mt-1">+{story.likes - storyCircleViewers.filter(v => v.likedStory).length} from other viewers</span>
                            )}
                          </div>
                        </div>

                        {totalShares > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Share2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                              <span className="text-xs text-white/50 font-medium">{totalShares} shares</span>
                            </div>
                            <span className="text-white/30 text-[10px]">Shared via direct message</span>
                          </div>
                        )}

                        <div className="bg-white/5 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
                            <span className="text-xs text-white/60">Engagement rate</span>
                          </div>
                          <span className="text-lg font-bold text-white">{story.views > 0 ? Math.round((story.likes / story.views) * 100) : 0}%</span>
                          <span className="text-[10px] text-white/30 block">Based on likes / views</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Story actions — archive & delete */}
              {story?.dbId && (
                <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
                  <button onClick={handleArchiveStory} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/70">
                    <Bookmark className="w-4 h-4" />
                    <span className="text-xs font-medium">Archive</span>
                  </button>
                  <button onClick={handleDeleteStory} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F44444]/10 hover:bg-[#F44444]/20 transition-colors text-[#F44444]">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateButtons({ collapsed }: { collapsed: boolean }) {
  const { setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  const { userRole } = useContext(AuthContext);
  const [showMenu, setShowMenu] = useState(false);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("touchstart", handleClick); };
  }, [showMenu]);

  const openMenu = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top, left: rect.right + 8 });
    }
    setShowMenu(prev => !prev);
  };

  const menuPortal = showMenu && typeof document !== "undefined" && createPortal(
    <div ref={menuRef} className="fixed z-[100] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[140px]" style={{ top: menuPos.top, left: menuPos.left }}>
      <button
        onClick={() => { setShowMenu(false); setShowCreatePost(true); }}
        className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
      >
        <PenLine className="w-[18px] h-[18px] text-[#737373]" />
        <span className="text-sm font-medium">Post</span>
      </button>
      {isCircle && (
        <>
          <div className="h-px bg-[#f0f0f0]" />
          <button
            onClick={() => { setShowMenu(false); setShowStoryCreator(true); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
          >
            <CircleDashed className="w-[18px] h-[18px] text-[#737373]" />
            <span className="text-sm font-medium">Story</span>
          </button>
        </>
      )}
    </div>,
    document.body
  );

  return (
    <div className="flex flex-col items-center space-y-2 mt-4 relative">
      {!collapsed && isCircle && (
        <button onClick={() => { setShowStoryCreator(true); }} className="hidden lg:block w-40 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Story</button>
      )}
      {collapsed ? (
        <>
          {menuPortal}
          <button
            ref={buttonRef}
            onClick={openMenu}
            className="w-10 h-10 rounded-full bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-all duration-300 flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </>
      ) : (
        <>
          {menuPortal}
          {/* md: icon FAB — opens menu for Circle users, direct post otherwise */}
          <button
            ref={buttonRef}
            onClick={isCircle ? openMenu : () => setShowCreatePost(true)}
            className="w-10 h-10 rounded-full bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-all duration-300 flex items-center justify-center cursor-pointer lg:hidden"
          >
            <Plus className="w-5 h-5" />
          </button>
          {/* lg: full-width text button — direct post (Story button sits above it) */}
          <button
            onClick={() => setShowCreatePost(true)}
            className="hidden lg:flex w-40 py-2 rounded-full bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-all duration-300 items-center justify-center cursor-pointer"
          >
            Post
          </button>
        </>
      )}
    </div>
  );
}

function LeftSidebar({ setShowCircleUpgrade }: { setShowCircleUpgrade: (show: boolean) => void }) {
  const pathname = usePathname();
  const { isSignedIn, userRole, openAuthModal, currentUserId, userProfile, updateUserProfile, unreadNotifCount } = useContext(AuthContext);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const { hasActiveStory, setShowStoryViewer, setStoryViewingUserId, setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const avatarPlusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showAvatarMenu) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (avatarMenuRef.current?.contains(target) || avatarPlusRef.current?.contains(target)) return;
      setShowAvatarMenu(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => { document.removeEventListener("mousedown", handleOutside); document.removeEventListener("touchstart", handleOutside); };
  }, [showAvatarMenu]);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const isAuthor = userRole === "AUTHOR";
  const isEditor = userRole === "EDITOR";
  const canCreatePost = isCircle;
  const isNormal = userRole === "NORMAL";
  const collapsed = pathname === "/messages";

  const profileHandle = userProfile?.handle;
  const profileHref = profileHandle ? `/${profileHandle}?from=${encodeURIComponent(pathname)}` : "/profile";

  const navRoutes = navItems.map(item => ({
    ...item,
    href: item.label === "Profile" ? profileHref : item.href,
    active: item.label === "Profile"
      ? (profileHandle ? pathname === `/${profileHandle}` : pathname === "/profile")
      : (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)),
  }));

  return (
    <>
      <aside className={`hidden md:flex flex-col items-center px-2 py-4 border-r border-[#e5e5e5] overflow-y-auto flex-shrink-0 bg-white transition-all duration-300 ease-out ${collapsed ? "w-20" : "md:w-20 lg:w-72 lg:items-stretch lg:px-4"
        }`}>
        {isSignedIn && isCircle ? (
          <>
            <div className="flex flex-col items-center mb-4">
              <div className="relative mb-2">
                {hasActiveStory ? (
                  <div>
                    <button onClick={() => { setStoryViewingUserId(currentUserId); setShowStoryViewer(true); }} className="cursor-pointer">
                      <div className={`story-ring-wrapper ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                        <div className="story-ring-gradient" />
                        <div className="story-ring-gap" />
                        <div className={`rounded-full overflow-hidden relative ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                          <Avatar src={userProfile?.avatar} name={userProfile?.name} size={96} className="!w-full !h-full" />
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); document.getElementById("avatar-upload-circle")?.click(); }}
                      className={`absolute inset-0 rounded-full cursor-pointer ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}
                      title="Change profile picture"
                    />
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => document.getElementById("avatar-upload-circle")?.click()}
                      className={`rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 cursor-pointer ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}
                      title="Change profile picture"
                    >
                      <Avatar src={userProfile?.avatar} name={userProfile?.name} size={96} className="!w-full !h-full" />
                    </button>
                  </div>
                )}
                {!collapsed && (
                  <div className="hidden lg:flex absolute bottom-1 -right-1 z-10">
                    <button
                      ref={avatarPlusRef}
                      onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(prev => !prev); }}
                      className="w-7 h-7 rounded-full bg-[#F44444] flex items-center justify-center hover:bg-[#d64d3c] transition-colors cursor-pointer ring-2 ring-white shadow-md"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                    {showAvatarMenu && (
                      <div ref={avatarMenuRef} className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[130px] z-50">
                        <button
                          onClick={() => { setShowAvatarMenu(false); setShowCreatePost(true); }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                        >
                          <PenLine className="w-[15px] h-[15px] text-[#737373]" />
                          <span className="text-sm font-medium">Post</span>
                        </button>
                        <div className="h-px bg-[#f0f0f0]" />
                        <button
                          onClick={() => { setShowAvatarMenu(false); setShowStoryCreator(true); }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                        >
                          <CircleDashed className="w-[15px] h-[15px] text-[#737373]" />
                          <span className="text-sm font-medium">Story</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <input
                  id="avatar-upload-circle"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const input = e.target;
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setCropImageSrc(reader.result as string);
                      input.value = "";
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
              {!collapsed && (
                <>
                  <div className="hidden lg:flex items-center gap-1.5">
                    <span className="font-semibold">{userProfile?.name || "User"}</span>
                    {userProfile?.verified && <VerifiedBadge />}
                  </div>
                  <span className="hidden lg:block text-[#737373] text-sm">{userProfile?.title}</span>
                </>
              )}
            </div>
            {!collapsed && (
              <div className="hidden lg:flex items-center justify-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF0F0] text-[#F44444] text-xs font-semibold leading-none"><AlbizLogo size={10} /> Circle</span>
                <span className="w-px h-4 bg-[#e5e5e5]" />
                <button
                  onClick={() => { if (hasActiveStory) { setStoryViewingUserId(currentUserId); setShowStoryViewer(true); } }}
                  disabled={!hasActiveStory}
                  className={`text-sm leading-none transition-colors ${hasActiveStory ? "text-[#737373] hover:text-[#0a0a0a] cursor-pointer" : "text-[#d5d5d5] cursor-not-allowed"}`}
                >My Stories</button>
              </div>
            )}
          </>
        ) : isSignedIn && isNormal ? (
          <>
            <div className="flex flex-col items-center mb-4">
              <div className="relative mb-2">
                <button
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  className={`w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 cursor-pointer ${collapsed ? "" : "lg:w-24 lg:h-24"}`}
                  title="Change profile picture"
                >
                  <Avatar src={userProfile?.avatar} name={userProfile?.name} size={96} className="!w-full !h-full" />
                </button>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const input = e.target;
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setCropImageSrc(reader.result as string);
                      input.value = "";
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
              {!collapsed && (
                <>
                  <div className="hidden lg:flex items-center gap-1.5">
                    <span className="font-semibold text-sm">{userProfile?.name || "User"}</span>
                  </div>
                  {userProfile?.title && <span className="hidden lg:block text-[#737373] text-xs">{userProfile.title}</span>}
                  <span className="hidden lg:inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#f5f5f5] text-[#737373] text-[10px] font-medium">
                    Free account
                  </span>
                </>
              )}
            </div>
            {!collapsed && (
              <div className="hidden lg:block mx-3 mb-4">
                <div className="rounded-xl border border-[#e5e5e5] p-3 bg-[#fafafa]">
                  <p className="text-xs text-[#525252] mb-2">Unlock messaging, analytics, and more</p>
                  <button
                    onClick={() => setShowCircleUpgrade(true)}
                    className="w-full py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
                  >
                    Upgrade to Circle
                  </button>
                </div>
              </div>
            )}
          </>
        ) : isSignedIn && isAuthor ? (
          <>
            <div className="flex flex-col items-center mb-4">
              <div className="relative mb-2">
                <Link href="/authors">
                  <div className={`w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 cursor-pointer hover:ring-[#F44444]/40 ${collapsed ? "" : "lg:w-24 lg:h-24"}`}>
                    <Avatar src={userProfile?.avatar} name={userProfile?.name} size={96} className="!w-full !h-full" />
                  </div>
                </Link>
              </div>
              {!collapsed && (
                <>
                  <div className="hidden lg:flex items-center gap-1.5">
                    <span className="font-semibold text-sm">{userProfile?.name || "Author"}</span>
                  </div>
                  {userProfile?.title && <span className="hidden lg:block text-[#737373] text-xs">{userProfile.title}</span>}
                  <span className="hidden lg:inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#F5F3FF] text-[#8B5CF6] text-[10px] font-medium">
                    Author
                  </span>
                </>
              )}
            </div>
            {!collapsed && (
              <div className="hidden lg:block mx-3 mb-4">
                <Link
                  href="/authors"
                  className="flex items-center justify-center gap-2 w-full py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors"
                >
                  <PenLine className="w-3 h-3" />
                  Author Studio
                </Link>
              </div>
            )}
          </>
        ) : isSignedIn && isEditor ? (
          <>
            <div className="flex flex-col items-center mb-4">
              <div className="relative mb-2">
                <Link href="/editor">
                  <div className={`w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 cursor-pointer hover:ring-[#0EA5E9]/40 ${collapsed ? "" : "lg:w-24 lg:h-24"}`}>
                    <Avatar src={userProfile?.avatar} name={userProfile?.name} size={96} className="!w-full !h-full" />
                  </div>
                </Link>
              </div>
              {!collapsed && (
                <>
                  <div className="hidden lg:flex items-center gap-1.5">
                    <span className="font-semibold text-sm">{userProfile?.name || "Editor"}</span>
                  </div>
                  {userProfile?.title && <span className="hidden lg:block text-[#737373] text-xs">{userProfile.title}</span>}
                  <span className="hidden lg:inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#0EA5E9] text-[10px] font-medium">
                    Editor
                  </span>
                </>
              )}
            </div>
            {!collapsed && (
              <div className="hidden lg:block mx-3 mb-4">
                <Link
                  href="/editor"
                  className="flex items-center justify-center gap-2 w-full py-1.5 rounded-full bg-[#0EA5E9] text-white text-xs font-medium hover:bg-[#0284c7] transition-colors"
                >
                  <PenLine className="w-3 h-3" />
                  Editor Studio
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center mb-4">
            <div className="relative mb-2 cursor-pointer" onClick={() => openAuthModal("signin")}>
              <div className={`w-12 h-12 rounded-full bg-[#f0f0f0] ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 flex items-center justify-center hover:ring-[#F44444]/40 ${collapsed ? "" : "lg:w-24 lg:h-24"}`}>
                <User className={`text-[#a3a3a3] ${collapsed ? "w-5 h-5" : "w-5 h-5 lg:w-10 lg:h-10"}`} />
              </div>
            </div>
            {!collapsed && (
              <div className="hidden lg:flex flex-col items-center gap-2 mt-1">
                <span className="text-sm text-[#737373]">Not signed in</span>
                <div className="flex gap-2">
                  <button onClick={() => openAuthModal("signin")} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Sign in</button>
                  <button onClick={() => openAuthModal("signup")} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#0a0a0a] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Sign up</button>
                </div>
              </div>
            )}
          </div>
        )}

        <nav className="flex flex-col items-center space-y-1">
          {navRoutes.map((item) => {
            if (!isCircle && (item.label === "Messages" || item.label === "Profile" || item.label === "Analytics")) return null;
            if (!isSignedIn && (item.label === "Saved" || item.label === "Settings" || item.label === "Notifications")) return null;
            const isNotif = item.label === "Notifications";
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`w-10 flex items-center justify-center gap-3 p-2 rounded-full transition-all duration-200 ${collapsed ? "" : "lg:w-40 lg:justify-start lg:px-4 lg:py-2"
                  } ${item.active ? "bg-[#f0f0f0] text-[#0a0a0a]" : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"}`}
              >
                <div className={isNotif ? "relative" : undefined}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {isNotif && unreadNotifCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#F44444]" />}
                </div>
                {!collapsed && <span className="hidden lg:block font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {canCreatePost && (
          <CreateButtons collapsed={collapsed} />
        )}


        <div className="flex-1" />
        <div className="flex flex-col items-center flex-shrink-0 mt-6">
          <AlbizLogo size={40} />
        </div>
      </aside>
      <AvatarCropModal
        isOpen={!!cropImageSrc}
        imageSrc={cropImageSrc}
        onClose={() => setCropImageSrc(null)}
        onCropComplete={async (blob) => {
          const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
          const uploadRes = await api.uploadAvatar(file);
          if (uploadRes.url) {
            await api.updateAvatar(uploadRes.url);
            if (userProfile) {
              updateUserProfile({ ...userProfile, avatar: uploadRes.url });
            }
          }
        }}
      />
    </>
  );
}

function MobileHeader({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { isSignedIn, userRole } = useContext(AuthContext);
  const pathname = usePathname();
  const isSettings = pathname === "/settings";
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [hideForChat, setHideForChat] = useState(false);

  useEffect(() => {
    const handleHide = (e: any) => setHideForChat(e.detail);
    window.addEventListener('albiz-chat-visibility', handleHide);
    return () => window.removeEventListener('albiz-chat-visibility', handleHide);
  }, []);

  if (hideForChat) return null;

  return (
    <header className="md:hidden flex-shrink-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#f0f0f0] px-4 h-12 pt-safe relative flex items-center justify-between">
      <button onClick={onOpenDrawer} className="z-10 p-1 -ml-1 rounded-full hover:bg-[#f5f5f5] active:scale-95 transition-all min-touch-target">
        <AlbizLogo size={24} />
      </button>
      <div className="flex items-center gap-0.5 z-10">
        {isSignedIn && <Link href="/notifications" className="p-2 hover:bg-[#f5f5f5] rounded-full min-touch-target"><Bell className="w-[18px] h-[18px] text-[#525252]" /></Link>}
        {isSignedIn && !isSettings && <Link href="/settings" className="p-2 hover:bg-[#f5f5f5] rounded-full min-touch-target"><Settings className="w-[18px] h-[18px] text-[#525252]" /></Link>}
      </div>
    </header>
  );
}

function MobileDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { userRole, isSignedIn, openAuthModal, userProfile } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  const isNormal = userRole === "NORMAL";

  // Items NOT in bottom nav
  const bottomNavLabels = ["Activities", "Explore", "Messages", "Profile"];
  const drawerItems = navItems.filter((item) => {
    if (bottomNavLabels.includes(item.label)) return false;
    if (!isCircle && (item.label === "Analytics")) return false;
    if (!isSignedIn && (item.label === "Saved" || item.label === "Settings" || item.label === "Notifications")) return false;
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ right: 0, left: 0.5 }}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.x < -50 || velocity.x < -500) {
                onClose();
              }
            }}
            className="md:hidden fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-white z-[70] shadow-2xl flex flex-col pt-safe overflow-hidden"
          >
            <div className="p-5 border-b border-[#f0f0f0] flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <Avatar src={userProfile?.avatar} name={userProfile?.name} size={56} className="ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" />
                <button onClick={onClose} className="p-2 -mr-2 text-[#a3a3a3] hover:text-[#0a0a0a] transition-colors rounded-full hover:bg-[#f5f5f5]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[17px] text-[#0a0a0a]">{userProfile?.name || "Welcome"}</span>
                  {userProfile?.verified && <VerifiedBadge />}
                </div>
                {userProfile?.handle && <span className="text-[#737373] text-[15px]">@{userProfile.handle}</span>}
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">
              {drawerItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 active:scale-[0.98] ${isActive ? "bg-[#f5f5f5] text-[#0a0a0a]" : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"
                      }`}
                  >
                    <item.icon className="w-[22px] h-[22px] flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`text-[16px] ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {!isSignedIn && (
              <div className="p-4 border-t border-[#f0f0f0] flex flex-col gap-3">
                <button onClick={() => { onClose(); openAuthModal("signin"); }} className="w-full py-3 rounded-full bg-[#F44444] text-white font-bold text-[15px] active:scale-95 transition-all">Sign in</button>
                <button onClick={() => { onClose(); openAuthModal("signup"); }} className="w-full py-3 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-bold text-[15px] active:scale-95 transition-all hover:bg-[#fafafa]">Sign up</button>
              </div>
            )}
            {isSignedIn && isNormal && (
              <div className="p-4 border-t border-[#f0f0f0]">
                <div className="rounded-xl border border-[#e5e5e5] p-3 bg-[#fafafa]">
                  <p className="text-xs text-[#525252] mb-2 font-medium">Unlock messaging, analytics, and more</p>
                  <button
                    onClick={() => { onClose(); window.dispatchEvent(new Event("albiz-circle-upgrade")); }}
                    className="w-full py-2 rounded-full bg-[#F44444] text-white text-xs font-bold hover:bg-[#d64d3c] active:scale-95 transition-all"
                  >
                    Upgrade to Circle
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SwipeablePageContainer({ children, isCircle, isSignedIn, profileHref }: any) {
  const pathname = usePathname();
  const router = useRouter();
  const controls = useAnimation();
  const x = useMotionValue(0);
  const [isMobile, setIsMobile] = useState(false);

  const lastPathname = useRef(pathname);
  const swipeDirection = useRef(0); // -1 = sliding left (next), 1 = sliding right (prev)

  useEffect(() => {
    setIsMobile(isNative || window.innerWidth < 1024);
  }, []);

  // When pathname changes, animate the new page in from the correct side
  useEffect(() => {
    if (pathname !== lastPathname.current) {
      if (swipeDirection.current === -1) {
        // Came from a left swipe (next tab), so new page enters from the right
        controls.set({ x: window.innerWidth });
        controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 40 } });
      } else if (swipeDirection.current === 1) {
        // Came from a right swipe (prev tab), so new page enters from the left
        controls.set({ x: -window.innerWidth });
        controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 40 } });
      } else {
        // Regular click navigation
        controls.set({ x: 0 });
      }
      lastPathname.current = pathname;
      swipeDirection.current = 0; // reset
    }
  }, [pathname, controls]);

  const handleDragEnd = async (e: any, info: any) => {
    const threshold = window.innerWidth * 0.25; // 25% of screen width to trigger
    const velocityThreshold = 500;
    const isSwipeLeft = info.offset.x < -threshold || info.velocity.x < -velocityThreshold;
    const isSwipeRight = info.offset.x > threshold || info.velocity.x > velocityThreshold;

    if (!isSwipeLeft && !isSwipeRight) {
      // Snap back
      controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 40 } });
      return;
    }

    // Determine adjacent route
    const routes = ["/", "/explore"];
    if (isCircle) {
      if (isSignedIn) routes.push("/messages");
      routes.push(profileHref);
    } else {
      routes.push("/circle", "/shorts");
      if (isSignedIn) routes.push("/saved");
      routes.push(profileHref);
    }

    let currentIndex = -1;
    if (pathname === "/") currentIndex = 0;
    else if (pathname.startsWith("/explore")) currentIndex = 1;
    else if (pathname.startsWith("/circle")) currentIndex = routes.indexOf("/circle");
    else if (pathname.startsWith("/shorts")) currentIndex = routes.indexOf("/shorts");
    else if (pathname.startsWith("/messages")) currentIndex = routes.indexOf("/messages");
    else if (pathname.startsWith("/saved")) currentIndex = routes.indexOf("/saved");
    else if (pathname === profileHref) currentIndex = routes.indexOf(profileHref);

    if (currentIndex === -1) {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
      return;
    }

    let targetRoute = null;
    if (isSwipeLeft && currentIndex < routes.length - 1) targetRoute = routes[currentIndex + 1];
    if (isSwipeRight && currentIndex > 0) targetRoute = routes[currentIndex - 1];

    if (!targetRoute) {
      // Snap back if we are at the end/beginning
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
      return;
    }

    // Prefetch target route
    haptic.light();
    router.prefetch(targetRoute);

    // Record direction for the incoming page animation
    swipeDirection.current = isSwipeLeft ? -1 : 1;

    // Animate current page off screen horizontally
    const screenWidth = window.innerWidth;
    await controls.start({
      x: isSwipeLeft ? -screenWidth : screenWidth,
      transition: { type: "spring", stiffness: 400, damping: 40 }
    });

    // Actually navigate
    router.push(targetRoute);
    // When pathname changes, the useEffect above will reset x to the other side and animate in.
  };

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // If scrolling vertically more than horizontally, ignore swipe
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    // Stop propagation if inside a horizontal scrolling container
    let target = e.target as HTMLElement | null;
    while (target && target !== document.body) {
      if (target.scrollWidth > target.clientWidth) {
        const overflowX = window.getComputedStyle(target).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return;
      }
      const zIndex = window.getComputedStyle(target).zIndex;
      if (zIndex && zIndex !== 'auto' && parseInt(zIndex) >= 50) return;
      target = target.parentElement;
    }

    isDragging.current = true;
    x.set(deltaX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaX = x.get();
    const velocityX = deltaX * 2; // rough estimation for velocity
    handleDragEnd(e, { offset: { x: deltaX }, velocity: { x: velocityX } });
  };

  if (!isMobile) return <>{children}</>;

  return (
    <motion.div
      animate={controls}
      style={{ x, width: "100%", height: "100%", touchAction: "pan-y" }}
      className="flex-1 w-full bg-white relative flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </motion.div>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const { userRole, isSignedIn, openAuthModal, userProfile } = useContext(AuthContext);
  const { setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [visible, setVisible] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => {
      const isNative = document.documentElement.classList.contains('native-app');
      setVisible(isNative || window.innerWidth < 1024);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!showCreateMenu) return;
    function handleTap(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (showCreateMenu && menuRef.current && !menuRef.current.contains(target)) setShowCreateMenu(false);
    }
    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap);
    return () => { document.removeEventListener("mousedown", handleTap); document.removeEventListener("touchstart", handleTap); };
  }, [showCreateMenu]);

  const [hideForChat, setHideForChat] = useState(false);

  useEffect(() => {
    const handleHide = (e: any) => setHideForChat(e.detail);
    window.addEventListener('albiz-chat-visibility', handleHide);
    return () => window.removeEventListener('albiz-chat-visibility', handleHide);
  }, []);

  if (!visible || hideForChat) return null;

  const profileHref = userProfile?.handle ? `/${userProfile.handle}` : "/profile";
  const profileActive = userProfile?.handle ? pathname === `/${userProfile.handle}` : false;

  const navLink = (href: string, icon: any, active: boolean) => (
    <Link href={href} onClick={() => haptic.light()} className={`flex flex-col items-center justify-center transition-colors active:scale-90 min-touch-target ${active ? "text-[#0a0a0a]" : "text-[#a3a3a3]"}`}>
      {icon}
    </Link>
  );

  return (
    <nav className="md:hidden flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-[#f0f0f0] z-[45] pb-safe">
      <div className="flex items-center justify-between px-2 h-[56px] relative">
        <div className="flex-1 flex justify-center">
          {navLink("/", <Activity className="w-[24px] h-[24px]" strokeWidth={pathname === "/" ? 2.5 : 2} />, pathname === "/")}
        </div>
        <div className="flex-1 flex justify-center">
          {navLink("/explore", <Search className="w-[24px] h-[24px]" strokeWidth={pathname.startsWith("/explore") ? 2.5 : 2} />, pathname.startsWith("/explore"))}
        </div>

        {/* Center Item: FAB for Circle, Circle icon for others */}
        <div className="flex-1 flex justify-center relative" ref={menuRef}>
          {isCircle ? (
            <>
              {showCreateMenu && (
                <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[140px] z-50">
                  <button
                    onClick={() => { setShowCreateMenu(false); setShowCreatePost(true); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors active:bg-[#f0f0f0]"
                  >
                    <PenLine className="w-5 h-5 text-[#737373]" />
                    <span className="text-[15px] font-bold">Post</span>
                  </button>
                  <div className="h-px bg-[#f0f0f0] mx-4" />
                  <button
                    onClick={() => { setShowCreateMenu(false); setShowStoryCreator(true); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors active:bg-[#f0f0f0]"
                  >
                    <CircleDashed className="w-5 h-5 text-[#737373]" />
                    <span className="text-[15px] font-bold">Story</span>
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowCreateMenu(prev => !prev)}
                className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-[#F44444] to-[#ff6b6b] flex items-center justify-center shadow-lg shadow-[#F44444]/30 active:scale-95 transition-transform text-white -mt-5 ring-[3px] ring-white"
              >
                <Plus className={`w-6 h-6 transition-transform duration-200 ${showCreateMenu ? "rotate-45" : ""}`} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            navLink("/circle", <Users className="w-[24px] h-[24px]" strokeWidth={pathname.startsWith("/circle") ? 2.5 : 2} />, pathname.startsWith("/circle"))
          )}
        </div>

        {/* Shorts Item: For normal and anonymous users */}
        {!isCircle && (
          <div className="flex-1 flex justify-center">
            {navLink("/shorts", <Play className="w-[24px] h-[24px]" strokeWidth={pathname.startsWith("/shorts") ? 2.5 : 2} />, pathname.startsWith("/shorts"))}
          </div>
        )}

        {/* 5th Item: Messages for Circle, Saved for Normal */}
        {isSignedIn && (
          <div className="flex-1 flex justify-center">
            {isCircle ? (
              navLink("/messages", <Mail className="w-[24px] h-[24px]" strokeWidth={pathname.startsWith("/messages") ? 2.5 : 2} />, pathname.startsWith("/messages"))
            ) : (
              navLink("/saved", <Bookmark className="w-[24px] h-[24px]" strokeWidth={pathname.startsWith("/saved") ? 2.5 : 2} />, pathname.startsWith("/saved"))
            )}
          </div>
        )}
        <div className="flex-1 flex justify-center">
          {isSignedIn ? (
            <Link
              href={profileHref}
              onClick={() => haptic.light()}
              className="flex items-center justify-center active:scale-90 transition-transform"
            >
              <Avatar src={userProfile?.avatar} name={userProfile?.name} alt="Profile" size={26} className={profileActive ? "ring-2 ring-[#0a0a0a] ring-offset-1" : "ring-1 ring-[#e5e5e5]"} />
            </Link>
          ) : (
            <button
              onClick={() => { haptic.light(); openAuthModal("signin"); }}
              className="flex items-center justify-center active:scale-90 transition-transform"
            >
              <div className="w-[26px] h-[26px] rounded-full bg-[#f0f0f0] ring-1 ring-[#e5e5e5] flex items-center justify-center">
                <User className="w-4 h-4 text-[#a3a3a3]" />
              </div>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function SignInModal({ onClose, onSwitch, onShowOnboard, context }: { onClose: () => void; onSwitch: () => void; onShowOnboard?: () => void; context?: InteractionContext }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [view, setView] = useState<"form" | "forgot" | "forgot-sent" | "2fa">("form");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [resendingCode, setResendingCode] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const { isMobile } = useContext(MobileContext);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const { update } = useSession();

  useEffect(() => {
    if (!isNative) return;

    // Using simple window height detection for better compatibility or Capacitor listeners if available
    const handleResize = () => {
      // In Capacitor, the window height changes when the keyboard opens
      const isKeyboard = window.innerHeight < window.screen.height * 0.7;
      setIsKeyboardOpen(isKeyboard);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Shared by the password step and the 2FA step — both end in the same NextAuth call.
  const completeSignIn = async (loginData: any, code?: string) => {
    const result = await nextAuthSignIn("credentials", {
      redirect: false,
      email,
      password,
      ...(code ? { twoFactorCode: code } : {}),
    });

    if (result?.ok) {
      await update(); // Force session update so UI reflects signed-in state immediately

      // /api/auth/login returns the user as `id`, not `userId`.
      const userId = loginData.id;
      const fromEmailVerification = sessionStorage.getItem('fromEmailVerification');

      if (userId) {
        if (fromEmailVerification === 'true') {
          // Always show onboarding after email verification
          sessionStorage.removeItem('fromEmailVerification');
          onShowOnboard?.();
        } else {
          // Otherwise show onboarding only if the user has no interests yet
          fetch(`/api/interests?userId=${userId}`)
            .then(res => res.json())
            .then(d => {
              const interests = Array.isArray(d) ? d : d?.interests;
              if (!interests || interests.length === 0) {
                onShowOnboard?.();
              }
            })
            .catch(() => { });
        }
      }
      onClose();
    } else {
      setError("Sign in failed — try again");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailError("");
    setPasswordError("");

    let hasError = false;

    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      hasError = true;
    }

    if (hasError) return;
    setLoading(true);
    try {
      // Login or auto-create user
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiresVerification) {
          setError(`Your account is not verified. Please check your email (${data.email}) and verify your account to sign in.`);
        } else {
          setError(data.error || "Something went wrong");
        }
        return;
      }

      if (data.requires2FA) {
        setTwoFactorError("");
        setTwoFactorCode("");
        setView("2fa");
        return;
      }

      await completeSignIn(data);
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) { setTwoFactorError("Enter the code we emailed you"); return; }
    setTwoFactorError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, twoFactorCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setTwoFactorError(data.error || "Invalid or expired code");
        return;
      }

      await completeSignIn(data, twoFactorCode);
    } catch {
      setTwoFactorError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendingCode(true);
    setResendMessage("");
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setResendMessage("A new code has been sent.");
    } catch {
      setResendMessage("Couldn't resend — try again.");
    } finally {
      setResendingCode(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail || email }),
      });
      setView("forgot-sent");
    } catch {
      // still show sent screen
      setView("forgot-sent");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-white w-full md:max-w-md md:mx-4 overflow-hidden flex flex-col max-h-[95dvh] md:max-h-[90dvh] ${isMobile
          ? "rounded-t-3xl animate-slide-up"
          : "rounded-2xl shadow-2xl animate-scale-in"
          }`}
      >

        {view === "form" && (
          <div className="overflow-y-auto">
            <div className={`px-8 pt-8 pb-6 transition-all duration-300 ${isNative && isKeyboardOpen ? 'pt-4' : 'pt-8'}`}>
              {!(isNative && isKeyboardOpen) && (
                <div className="flex justify-center mb-6 animate-in fade-in zoom-in duration-300">
                  <AlbizLogo size={48} />
                </div>
              )}
              <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Welcome back</h2>
              <p className="text-sm text-[#737373] text-center mb-6">{getAuthSubtitle("signin", context)}</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); setEmailError(""); }} placeholder="you@example.com" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" autoFocus />
                  {emailError && <p className="text-xs text-[#F44444] mt-1">{emailError}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#525252]">Password</label>
                    <button type="button" onClick={() => { setForgotEmail(email); setView("forgot"); }} className="text-xs text-[#737373] hover:text-[#F44444] transition-colors cursor-pointer">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); setError(""); setPasswordError(""); }} placeholder="Enter your password" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && <p className="text-xs text-[#F44444] mt-1">{passwordError}</p>}
                </div>
                {error && <p className="text-xs text-[#F44444] text-center mt-2">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign in
                </button>
              </form>
              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-[#e5e5e5]"></div>
                <span className="px-3 text-xs text-[#a3a3a3] font-medium">OR</span>
                <div className="flex-1 h-px bg-[#e5e5e5]"></div>
              </div>
              <button type="button" disabled={socialLoading !== null} onClick={async () => { setSocialLoading("google"); const r = await signInWithGoogle("/"); if (!r.ok && r.error) setError(r.error); else if (r.ok) { await update(); onClose(); if (r.showOnboard) onShowOnboard?.(); } setSocialLoading(null); }} className="w-full py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-[#0a0a0a] font-semibold hover:bg-[#fafafa] hover:border-[#d5d5d5] hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50">
                {socialLoading === "google" ? <Loader2 className="w-5 h-5 animate-spin text-[#737373]" /> : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </button>
              <button type="button" disabled={socialLoading !== null} onClick={async () => { setSocialLoading("apple"); const r = await signInWithApple("/"); if (!r.ok && r.error) setError(r.error); else if (r.ok) { await update(); onClose(); if (r.showOnboard) onShowOnboard?.(); } setSocialLoading(null); }} className="w-full mt-3 py-2.5 rounded-xl bg-[#0a0a0a] text-white font-semibold hover:bg-[#1a1a1a] hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50">
                {socialLoading === "apple" ? <Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" /> : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.23-3.91-1.22-1.78-3.11-2.02-3.78-2.05-1.61-.16-3.14.95-3.96.95-.81 0-2.07-.93-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.81 3.15-.46 7.81 1.3 10.37.86 1.25 1.89 2.66 3.23 2.61 1.29-.05 1.78-.84 3.34-.84 1.56 0 2 .84 3.37.81 1.39-.02 2.27-1.28 3.12-2.54.98-1.46 1.39-2.87 1.41-2.95-.03-.01-2.71-1.04-2.74-4.13zM14.6 4.39c.71-.87 1.2-2.07 1.06-3.27-1.03.04-2.27.69-3.01 1.55-.66.76-1.24 1.98-1.08 3.15 1.15.09 2.32-.58 3.03-1.43z" />
                  </svg>
                )}
                Continue with Apple
              </button>
            </div>
            <div className="px-8 pt-5 pb-8 bg-[#fafafa] border-t border-[#f0f0f0] text-center">
              <span className="text-sm text-[#737373]">Don&apos;t have an account? </span>
              <button onClick={onSwitch} className="text-sm text-[#F44444] font-semibold hover:text-[#d64d3c] cursor-pointer transition-colors">Sign up</button>
            </div>
          </div>
        )}

        {view === "forgot" && (
          <div className="px-8 pt-8 pb-12" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <button type="button" onClick={() => setView("form")} className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#0a0a0a] mb-6 transition-colors cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            {!(isNative && isKeyboardOpen) && (
              <div className="flex justify-center mb-6 animate-in fade-in zoom-in duration-300">
                <AlbizLogo size={40} />
              </div>
            )}
            <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Forgot your password?</h2>
            <p className="text-sm text-[#737373] text-center mb-6">Enter your email and we&apos;ll send you a reset link.</p>
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" autoFocus />
              </div>
              <button type="submit" disabled={forgotLoading || !forgotEmail.trim()} className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send reset link
              </button>
            </form>
          </div>
        )}

        {view === "forgot-sent" && (
          <div className="px-8 pt-8 pb-12 text-center" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>
            {!(isNative && isKeyboardOpen) && (
              <div className="flex justify-center mb-6 animate-in fade-in zoom-in duration-300">
                <AlbizLogo size={40} />
              </div>
            )}
            <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Check your email</h2>
            <p className="text-sm text-[#737373] mb-6">If an account exists for <span className="text-[#0a0a0a] font-medium">{forgotEmail || email}</span>, you&apos;ll receive a password reset link shortly.</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#0a0a0a] text-white font-medium hover:bg-[#262626] transition-colors cursor-pointer">Done</button>
          </div>
        )}

        {view === "2fa" && (
          <div className="px-8 pt-8 pb-12" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <button type="button" onClick={() => setView("form")} className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#0a0a0a] mb-6 transition-colors cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            {!(isNative && isKeyboardOpen) && (
              <div className="flex justify-center mb-6 animate-in fade-in zoom-in duration-300">
                <AlbizLogo size={40} />
              </div>
            )}
            <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Enter verification code</h2>
            <p className="text-sm text-[#737373] text-center mb-6">We sent a 6-digit code to <span className="text-[#0a0a0a] font-medium">{email}</span>.</p>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1.5">Code</label>
                <input type="text" inputMode="numeric" maxLength={6} value={twoFactorCode} onChange={e => { setTwoFactorCode(e.target.value.replace(/\D/g, "")); setTwoFactorError(""); }} placeholder="123456" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm tracking-[0.3em] text-center outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" autoFocus />
                {twoFactorError && <p className="text-xs text-[#F44444] mt-1">{twoFactorError}</p>}
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify
              </button>
              <div className="text-center">
                <button type="button" onClick={handleResendCode} disabled={resendingCode} className="text-xs text-[#737373] hover:text-[#F44444] transition-colors cursor-pointer disabled:opacity-50">
                  {resendingCode ? "Sending..." : "Resend code"}
                </button>
                {resendMessage && <p className="text-xs text-[#a3a3a3] mt-1">{resendMessage}</p>}
              </div>
            </form>
          </div>
        )}

        {!(isNative && isKeyboardOpen) && (
          <button
            onClick={onClose}
            className={`absolute z-10 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg animate-in fade-in duration-300 top-4`}
          >
            <X className="w-5 h-5 text-[#737373]" />
          </button>
        )}
      </div>

    </div>
  );
}

function SignUpModal({ onClose, onSwitch, onShowOnboard, context }: { onClose: () => void; onSwitch: () => void; onShowOnboard?: () => void; context?: InteractionContext }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [view, setView] = useState<"form" | "sent">("form");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const { isMobile } = useContext(MobileContext);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    const handleResize = () => {
      const isKeyboard = window.innerHeight < window.screen.height * 0.7;
      setIsKeyboardOpen(isKeyboard);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      // Account created — show the persistent "check your email" screen.
      // Do NOT sign the user in here. They must verify via email first.
      setView("sent");
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendLoading) return;
    setResendLoading(true);
    setResendMessage("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendMessage("Verification email sent. Check your inbox.");
      } else {
        const data = await res.json().catch(() => ({}));
        setResendMessage(data.error || "Couldn't resend. Try again later.");
      }
    } catch {
      setResendMessage("Connection error — try again");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full md:max-w-md md:mx-4 overflow-hidden flex flex-col max-h-[95dvh] md:max-h-[90dvh] ${isMobile
        ? "rounded-t-3xl animate-slide-up"
        : "rounded-2xl shadow-2xl animate-scale-in"
        }`}>

        {view === "form" && (
          <div className="overflow-y-auto">
            <div className={`px-8 pt-8 pb-6 transition-all duration-300 ${isNative && isKeyboardOpen ? 'pt-4' : 'pt-8'}`}>
              {!(isNative && isKeyboardOpen) && (
                <div className="flex justify-center mb-6 animate-in fade-in zoom-in duration-300">
                  <AlbizLogo size={48} />
                </div>
              )}
              <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Create your account</h2>
              <p className="text-sm text-[#737373] text-center mb-6">{getAuthSubtitle("signup", context)}</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); setError(""); }}
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(""); }}
                      placeholder="At least 6 characters"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-xs text-[#F44444] text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create account
                </button>
              </form>
              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-[#e5e5e5]"></div>
                <span className="px-3 text-xs text-[#a3a3a3] font-medium">OR</span>
                <div className="flex-1 h-px bg-[#e5e5e5]"></div>
              </div>
              <button
                type="button"
                disabled={socialLoading !== null}
                onClick={async () => { setSocialLoading("google"); const r = await signInWithGoogle("/"); if (!r.ok && r.error) setError(r.error); else if (r.ok) { await update(); onClose(); if (r.showOnboard) onShowOnboard?.(); } setSocialLoading(null); }}
                className="w-full py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-[#0a0a0a] font-semibold hover:bg-[#fafafa] hover:border-[#d5d5d5] hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {socialLoading === "google" ? <Loader2 className="w-5 h-5 animate-spin text-[#737373]" /> : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </button>
              <button type="button" disabled={socialLoading !== null} onClick={async () => { setSocialLoading("apple"); const r = await signInWithApple("/"); if (!r.ok && r.error) setError(r.error); else if (r.ok) { await update(); onClose(); if (r.showOnboard) onShowOnboard?.(); } setSocialLoading(null); }} className="w-full mt-3 py-2.5 rounded-xl bg-[#0a0a0a] text-white font-semibold hover:bg-[#1a1a1a] hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50">
                {socialLoading === "apple" ? <Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" /> : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.23-3.91-1.22-1.78-3.11-2.02-3.78-2.05-1.61-.16-3.14.95-3.96.95-.81 0-2.07-.93-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.81 3.15-.46 7.81 1.3 10.37.86 1.25 1.89 2.66 3.23 2.61 1.29-.05 1.78-.84 3.34-.84 1.56 0 2 .84 3.37.81 1.39-.02 2.27-1.28 3.12-2.54.98-1.46 1.39-2.87 1.41-2.95-.03-.01-2.71-1.04-2.74-4.13zM14.6 4.39c.71-.87 1.2-2.07 1.06-3.27-1.03.04-2.27.69-3.01 1.55-.66.76-1.24 1.98-1.08 3.15 1.15.09 2.32-.58 3.03-1.43z" />
                  </svg>
                )}
                Continue with Apple
              </button>
            </div>
            <div className="px-8 pt-5 pb-8 bg-[#fafafa] border-t border-[#f0f0f0] text-center">
              <span className="text-sm text-[#737373]">Already have an account? </span>
              <button onClick={onSwitch} className="text-sm text-[#F44444] font-semibold hover:text-[#d64d3c] cursor-pointer transition-colors">Sign in</button>
            </div>
          </div>
        )}

        {view === "sent" && (
          <div className="px-8 pt-8 pb-8 text-center">
            <div className="flex justify-center mb-6"><AlbizLogo size={40} /></div>
            <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Check your email</h2>
            <p className="text-sm text-[#737373] mb-6">
              We sent a verification link to <span className="text-[#0a0a0a] font-medium">{email}</span>. Click the link in the email to activate your account before signing in.
            </p>
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
            >
              {resendLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {resendLoading ? "Sending…" : "Resend verification email"}
            </button>
            <button
              onClick={onSwitch}
              className="w-full py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-[#0a0a0a] font-medium hover:bg-[#f5f5f5] transition-colors cursor-pointer"
            >
              Back to sign in
            </button>
            {resendMessage && (
              <p className="text-xs text-[#737373] mt-3">{resendMessage}</p>
            )}
            <p className="text-xs text-[#a3a3a3] mt-4">
              The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
            </p>
          </div>
        )}

        {!(isNative && isKeyboardOpen) && (
          <button
            onClick={onClose}
            className={`absolute z-10 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg animate-in fade-in duration-300 top-4`}
          >
            <X className="w-5 h-5 text-[#737373]" />
          </button>
        )}
      </div>
    </div>
  );
}

function StoryCreator({ onClose, onPublish }: { onClose: () => void; onPublish: () => void }) {
  const { currentUserId, userProfile } = useContext(AuthContext);
  const [visibility, setVisibility] = useState<"public" | "circle">("public");
  const [textOverlay, setTextOverlay] = useState("");
  const [textStyle, setTextStyle] = useState({ bold: false, italic: false, align: "center" as "left" | "center" | "right" });
  const [textColor, setTextColor] = useState("#ffffff");
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [storyLocation, setStoryLocation] = useState("");
  // Image position/scale within the frame
  const [imgPos, setImgPos] = useState({ x: 0, y: 0, scale: 1 });
  const [imgFit, setImgFit] = useState<"contain" | "cover">("contain");
  const imgDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const storyFileRef = useRef<HTMLInputElement>(null);
  const [activeStickers, setActiveStickers] = useState<string[]>([]);
  const [elementPositions, setElementPositions] = useState<Record<string, { x: number; y: number; scale: number; rotation: number; opacity: number; zIndex: number }>>({
    text: { x: 50, y: 85, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    poll: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    question: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    location: { x: 20, y: 75, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    hashtag: { x: 80, y: 70, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    time: { x: 85, y: 8, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    mention: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    link: { x: 50, y: 60, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
    music: { x: 15, y: 90, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
  });
  // Real content for each sticker type — separate from position/transform state.
  const [stickerContent, setStickerContent] = useState<Record<string, any>>({
    poll: { question: "", options: ["", ""] },
    question: { prompt: "" },
    mention: { userId: null, handle: "", name: "", avatar: null },
    hashtag: { tag: "" },
    link: { url: "" },
    music: { title: "", artist: "" },
  });
  const updateStickerContent = (id: string, patch: Record<string, any>) => {
    setStickerContent(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showHashtagPicker, setShowHashtagPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [textBackgroundColor, setTextBackgroundColor] = useState<string | null>(null);
  const [locationGeo, setLocationGeo] = useState<{ lat: number; lng: number; placeId: string } | null>(null);
  // True while a sticker gesture (drag or pinch) is actively in progress —
  // lets the separate background-image pan system (handleImgDragMove) know
  // to stay out of the way, without needing a rendered "which element" id.
  const stickerGestureActive = useRef(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const toggleSticker = (sticker: string) => {
    setActiveStickers(prev => prev.includes(sticker) ? prev.filter(s => s !== sticker) : [...prev, sticker]);
  };

  // Instagram-style transform gestures — one finger drags to reposition, two
  // fingers pinch to resize and rotate simultaneously (mouse users get drag
  // only, same as Story creation on a real Instagram desktop web client,
  // which has no rotate affordance either). `filterTaps: true` means a tap
  // never reaches onDrag at all — the wrapper's own onClick handles
  // tap-to-select, so a still-finger tap can never be misread as a
  // near-zero-distance drag/rotation.
  const bindGesture = useGesture(
    {
      onDrag: ({ args: [id], first, last, movement: [mx, my], memo, event }) => {
        if (first) { event.stopPropagation(); setSelectedElement(id); }
        const canvas = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-story-canvas]");
        const state = first
          ? { rect: canvas?.getBoundingClientRect() ?? null, base: elementPositions[id] ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1, zIndex: 20 } }
          : memo;
        if (last) stickerGestureActive.current = false;
        else stickerGestureActive.current = true;
        if (!state?.rect) return state;
        const x = Math.max(5, Math.min(95, state.base.x + (mx / state.rect.width) * 100));
        const y = Math.max(5, Math.min(95, state.base.y + (my / state.rect.height) * 100));
        setElementPositions(prev => ({ ...prev, [id]: { ...prev[id], x, y } }));
        return state;
      },
      onPinch: ({ args: [id], first, last, da: [d, a], memo }) => {
        if (first) setSelectedElement(id);
        stickerGestureActive.current = !last;
        const state = first
          ? { d0: d, a0: a, scale: elementPositions[id]?.scale ?? 1, rotation: elementPositions[id]?.rotation ?? 0 }
          : memo;
        const scale = Math.max(0.5, Math.min(2, state.scale * (d / state.d0)));
        const rotation = state.rotation + (a - state.a0);
        setElementPositions(prev => ({ ...prev, [id]: { ...prev[id], scale, rotation } }));
        return state;
      },
    },
    { drag: { filterTaps: true }, pinch: { rubberband: true } }
  );
  const setElementOpacity = (elementId: string, val: number) => {
    setElementPositions(prev => ({ ...prev, [elementId]: { ...prev[elementId], opacity: val } }));
  };
  const reorderElement = (elementId: string, dir: "front" | "back") => {
    setElementPositions(prev => {
      const zs = Object.values(prev).map(p => p.zIndex ?? 20);
      const z = dir === "front" ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
      return { ...prev, [elementId]: { ...prev[elementId], zIndex: z } };
    });
  };

  const textColors = ["#ffffff", "#0a0a0a", "#F44444", "#FFD700", "#00D4FF", "#9B59B6"];
  const stickers = [
    { id: "poll", label: "Poll", icon: BarChart3 }, { id: "question", label: "Question", icon: MessageCircle },
    { id: "mention", label: "Mention", icon: AtSign }, { id: "hashtag", label: "Hashtag", icon: Hash },
    { id: "link", label: "Link", icon: Link2 },
    { id: "time", label: "Time", icon: Clock }, { id: "music", label: "Music", icon: Activity },
  ];

  // Real file upload to Azure blob storage
  const handleStoryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const result = await api.uploadFile(file, currentUserId, "stories");
        setUploadedMedia(prev => [...prev, result.url]);
      }
    } catch (err) {
      console.error("Story upload failed:", err);
      setUploadError("Upload failed. Please try again.");
      setTimeout(() => setUploadError(null), 4000);
    } finally {
      setUploading(false);
      if (storyFileRef.current) storyFileRef.current.value = "";
    }
  };

  // Draft management
  const [savingDraft, setSavingDraft] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  // Load drafts on mount
  const refreshDrafts = () => {
    api.getStories(currentUserId, "draft").then((data: any) => {
      const all = (data.storyUsers || []).flatMap((su: any) => su.stories);
      setDrafts(all);
    }).catch(() => { });
  };
  useEffect(() => { refreshDrafts(); }, [currentUserId]);

  // Load a draft into the editor
  const handleEditDraft = (draft: any) => {
    setEditingDraftId(draft.id);
    setUploadedMedia([draft.imageUrl]);
    setTextOverlay(draft.textOverlay || "");
    setTextColor(draft.textColor || "#ffffff");
    setTextStyle({
      bold: draft.textBold ?? false,
      italic: draft.textItalic ?? false,
      align: (draft.textAlign ?? "center") as "left" | "center" | "right",
    });
    setTextBackgroundColor(draft.textBackgroundColor ?? null);
    setStoryLocation(draft.location || "");
    setLocationGeo(
      draft.locationLat != null && draft.locationLng != null
        ? { lat: draft.locationLat, lng: draft.locationLng, placeId: draft.locationPlaceId ?? "" }
        : null
    );
    setImgPos({ x: draft.imgPosX ?? 0, y: draft.imgPosY ?? 0, scale: draft.imgScale ?? 1 });
    setImgFit(draft.imgFit || "contain");
    setVisibility(draft.visibility === "circle" ? "circle" : "public");

    // Restore element positions + real content from the normalized sticker
    // array — handles both the current shape and an older, pre-upgrade draft.
    const elements = normalizeStoryStickers(draft.stickers);
    setActiveStickers(elements.map((el) => el.id));
    setElementPositions((prev) => ({
      ...prev,
      text: { x: draft.textPosX ?? 50, y: draft.textPosY ?? 50, scale: draft.textScale ?? 1, rotation: draft.textRotation ?? 0, opacity: draft.textOpacity ?? 1, zIndex: 20 },
      location: { x: draft.locPosX ?? 50, y: draft.locPosY ?? 20, scale: 1, rotation: 0, opacity: 1, zIndex: 20 },
      ...elements.reduce((acc, el) => ({ ...acc, [el.id]: { x: el.x, y: el.y, scale: el.scale, rotation: el.rotation, opacity: el.opacity, zIndex: el.zIndex } }), {} as Record<string, any>),
    }));
    setStickerContent((prev) => ({
      ...prev,
      ...elements.reduce((acc, el) => {
        if (el.type === "poll") return { ...acc, poll: { question: el.data.question ?? "", options: el.data.options ?? ["", ""] } };
        if (el.type === "question") return { ...acc, question: { prompt: el.data.prompt ?? "" } };
        if (el.type === "mention") return { ...acc, mention: { userId: el.data.userId ?? null, handle: el.data.handle ?? "", name: el.data.name ?? "", avatar: el.data.avatar ?? null } };
        if (el.type === "hashtag") return { ...acc, hashtag: { tag: el.data.tag ?? "" } };
        if (el.type === "link") return { ...acc, link: { url: el.data.url ?? "" } };
        if (el.type === "music") return { ...acc, music: { title: el.data.title ?? "", artist: el.data.artist ?? "" } };
        return acc;
      }, {} as Record<string, any>),
    }));
    setShowDrafts(false);
  };

  // Save as new draft or update existing draft
  // Shared by save-draft and publish — one array element per active sticker,
  // real content included. Stickers with no real content yet (e.g. a poll
  // toggled on but never given a question) are dropped rather than sent, so
  // an incomplete sticker can't fail the whole post.
  const buildStickerData = () => {
    if (activeStickers.length === 0) return undefined;
    return activeStickers
      .map((id) => {
        const pos = elementPositions[id] ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1, zIndex: 20 };
        let data: Record<string, any> = {};
        if (id === "poll") data = { question: stickerContent.poll.question.trim(), options: stickerContent.poll.options.map((o: string) => o.trim()).filter(Boolean) };
        else if (id === "question") data = { prompt: stickerContent.question.prompt.trim() };
        else if (id === "mention") data = stickerContent.mention.userId ? { ...stickerContent.mention } : {};
        else if (id === "hashtag") data = { tag: stickerContent.hashtag.tag.trim() };
        else if (id === "link") data = { url: stickerContent.link.url.trim() };
        else if (id === "music") data = { ...stickerContent.music, title: stickerContent.music.title.trim(), artist: stickerContent.music.artist.trim() };
        return { id, type: id, x: pos.x, y: pos.y, scale: pos.scale, rotation: pos.rotation, opacity: pos.opacity, zIndex: pos.zIndex, data };
      })
      .filter((el) => {
        if (el.type === "poll") return !!el.data.question && el.data.options.length >= 2;
        if (el.type === "question") return !!el.data.prompt;
        if (el.type === "mention") return !!el.data.userId;
        if (el.type === "hashtag") return !!el.data.tag;
        if (el.type === "link") return !!el.data.url;
        if (el.type === "music") return !!el.data.title;
        return true; // time
      });
  };

  const handleSaveDraft = async () => {
    if (!uploadedMedia.length || savingDraft) return;
    setSavingDraft(true);
    const stickerData = buildStickerData();
    try {
      if (editingDraftId) {
        await api.deleteStory(editingDraftId, currentUserId);
      }
      for (const imageUrl of uploadedMedia) {
        await api.createStory(currentUserId, imageUrl, {
          textOverlay: textOverlay || undefined,
          textColor: textColor || undefined,
          textBold: textStyle.bold,
          textItalic: textStyle.italic,
          textAlign: textStyle.align,
          textPosX: elementPositions.text?.x ?? 50,
          textPosY: elementPositions.text?.y ?? 50,
          textScale: elementPositions.text?.scale ?? 1,
          textRotation: elementPositions.text?.rotation ?? 0,
          textOpacity: elementPositions.text?.opacity ?? 1,
          textBackgroundColor: textBackgroundColor ?? undefined,
          location: storyLocation || undefined,
          locationLat: locationGeo?.lat,
          locationLng: locationGeo?.lng,
          locationPlaceId: locationGeo?.placeId,
          locPosX: elementPositions.location?.x ?? 50,
          locPosY: elementPositions.location?.y ?? 20,
          imgPosX: imgPos.x,
          imgPosY: imgPos.y,
          imgScale: imgPos.scale,
          imgFit,
          stickers: stickerData,
          visibility,
          status: "draft",
        });
      }
      if (isNative) {
        Toast.show({ text: "Draft saved" });
        onClose();
      } else {
        setEditingDraftId(null);
        setDraftSaved(true);
        refreshDrafts();
        setTimeout(() => setDraftSaved(false), 2000);
      }
    } catch { }
    setSavingDraft(false);
  };

  // Delete a draft
  const handleDeleteDraft = async (draftId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteStory(draftId, currentUserId).catch(() => { });
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    if (editingDraftId === draftId) setEditingDraftId(null);
  };

  const handlePostStory = async () => {
    if (!uploadedMedia.length || posting) return;
    setPosting(true);
    setPostError(null);
    const stickerData = buildStickerData();
    try {
      if (editingDraftId) {
        await api.deleteStory(editingDraftId, currentUserId).catch(() => { });
      }
      for (const imageUrl of uploadedMedia) {
        await api.createStory(currentUserId, imageUrl, {
          textOverlay: textOverlay || undefined,
          textColor: textColor || undefined,
          textBold: textStyle.bold,
          textItalic: textStyle.italic,
          textAlign: textStyle.align,
          textPosX: elementPositions.text?.x ?? 50,
          textPosY: elementPositions.text?.y ?? 50,
          textScale: elementPositions.text?.scale ?? 1,
          textRotation: elementPositions.text?.rotation ?? 0,
          textOpacity: elementPositions.text?.opacity ?? 1,
          textBackgroundColor: textBackgroundColor ?? undefined,
          location: storyLocation || undefined,
          locationLat: locationGeo?.lat,
          locationLng: locationGeo?.lng,
          locationPlaceId: locationGeo?.placeId,
          locPosX: elementPositions.location?.x ?? 50,
          locPosY: elementPositions.location?.y ?? 20,
          imgPosX: imgPos.x,
          imgPosY: imgPos.y,
          imgScale: imgPos.scale,
          imgFit,
          stickers: stickerData,
          visibility,
        });
      }
      onPublish();
      onClose();
    } catch (err) {
      console.error("Story post failed:", err);
      setPostError("Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  // Image drag within frame (for repositioning)
  const handleImgDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    imgDragRef.current = { startX: clientX, startY: clientY, startPosX: imgPos.x, startPosY: imgPos.y };
  };
  const handleImgDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    const ref = imgDragRef.current;
    if (!ref || stickerGestureActive.current) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const newX = ref.startPosX + (clientX - ref.startX);
    const newY = ref.startPosY + (clientY - ref.startY);
    setImgPos(prev => ({ ...prev, x: newX, y: newY }));
  };
  const handleImgDragEnd = () => { imgDragRef.current = null; };
  const handleImgWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    setImgPos(prev => ({ ...prev, scale: Math.max(0.5, Math.min(3, prev.scale + (e.deltaY > 0 ? -0.05 : 0.05))) }));
  };

  // Real place search (Google Places, server-proxied) — replaces the old
  // hardcoded city-pill list. `placeSessionToken` groups one search session
  // per Places' own billing/session model.
  const [placeSuggestions, setPlaceSuggestions] = useState<{ placeId: string; description: string; mainText: string; secondaryText: string }[]>([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  // "not-configured" (server has no Google Places API key) is a distinct,
  // clearly-labeled state from "failed" (a transient request/network error)
  // — collapsing both into one generic message would hide a real
  // configuration gap behind "temporarily unavailable".
  const [placeSearchStatus, setPlaceSearchStatus] = useState<"idle" | "ok" | "not-configured" | "failed">("idle");
  const placeSessionToken = useRef(Math.random().toString(36).slice(2));
  const placeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!storyLocation.trim()) {
      setPlaceSuggestions([]);
      setPlaceSearchStatus("idle");
      return;
    }
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
    placeDebounceRef.current = setTimeout(() => {
      setPlaceSearchLoading(true);
      api.searchPlaces(storyLocation.trim(), placeSessionToken.current)
        .then((res) => {
          setPlaceSuggestions(res.suggestions ?? []);
          setPlaceSearchStatus(res.notConfigured ? "not-configured" : res.error ? "failed" : "ok");
        })
        .catch(() => { setPlaceSuggestions([]); setPlaceSearchStatus("failed"); })
        .finally(() => setPlaceSearchLoading(false));
    }, 300);
    return () => { if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current); };
  }, [storyLocation]);

  const selectPlace = (suggestion: { placeId: string; description: string }) => {
    setStoryLocation(suggestion.description);
    setPlaceSuggestions([]);
    api.getPlaceDetails(suggestion.placeId)
      .then((details) => {
        if (details.lat != null && details.lng != null) {
          setLocationGeo({ lat: details.lat, lng: details.lng, placeId: suggestion.placeId });
        }
      })
      .catch(() => {});
  };

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  const stickerEl = (id: string, content: React.ReactNode, className: string, forceShow = false) => {
    if (!forceShow && !activeStickers.includes(id)) return null;
    const pos = elementPositions[id] ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1, zIndex: 20 };
    const isSelected = selectedElement === id;
    // Rotation/opacity/layering aren't persisted for the location badge (no
    // schema support), so its toolbar only ever shows the scale row.
    const showTransform = id !== "location";
    return (
      <div
        className={`absolute touch-none cursor-move ${isSelected ? "ring-[1.5px] ring-white/80 shadow-2xl" : ""} ${className}`}
        style={{
          left: `${pos.x}%`, top: `${pos.y}%`,
          transform: `translate(-50%, -50%) rotate(${pos.rotation}deg) scale(${isSelected ? pos.scale * 1.04 : pos.scale})`,
          opacity: pos.opacity, zIndex: 20 + pos.zIndex,
          willChange: "transform",
        }}
        {...bindGesture(id)}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setSelectedElement(id); }}
      >
        {content}
        {isSelected && (
          <StoryElementToolbar
            opacity={pos.opacity}
            showTransform={showTransform}
            onOpacityChange={(val) => setElementOpacity(id, val)}
            onReorder={(dir) => reorderElement(id, dir)}
          />
        )}
      </div>
    );
  };

  // Real, tap-to-edit-in-place content for each sticker type — shared between
  // the mobile and desktop preview canvases so there's one editing UI, not two.
  const renderStickerBody = (id: string): React.ReactNode => {
    const isSelected = selectedElement === id;
    const stopDrag = (e: React.SyntheticEvent) => e.stopPropagation();
    switch (id) {
      case "poll": {
        const c = stickerContent.poll;
        if (!isSelected) {
          return (
            <div className="min-w-[180px]">
              <div className="bg-[#F44444] px-4 py-3">
                <p className="text-sm font-semibold text-white text-center">{c.question || "What do you think?"}</p>
              </div>
              <div className="bg-white px-3 pb-3 pt-2 space-y-1.5">
                {(c.options.length ? c.options : ["Option 1", "Option 2"]).map((o: string, i: number) => (
                  <div key={i} className="bg-[#f5f5f5] rounded-full px-3 py-2 text-sm text-center font-medium text-[#0a0a0a]">{o || `Option ${i + 1}`}</div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div className="min-w-[200px]" onMouseDown={stopDrag} onTouchStart={stopDrag} onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#F44444] px-4 py-3">
              <input
                value={c.question}
                onChange={(e) => updateStickerContent("poll", { question: e.target.value })}
                placeholder="Ask a question..."
                autoFocus
                className="w-full text-sm font-semibold text-white text-center bg-transparent outline-none placeholder:text-white/50"
              />
            </div>
            <div className="bg-white px-3 pb-3 pt-2 space-y-1.5">
              {c.options.map((o: string, i: number) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    value={o}
                    onChange={(e) => updateStickerContent("poll", { options: c.options.map((x: string, j: number) => (j === i ? e.target.value : x)) })}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-[#f5f5f5] rounded-full px-3 py-2 text-sm outline-none text-center font-medium text-[#0a0a0a] placeholder:text-[#a3a3a3]"
                  />
                  {c.options.length > 2 && (
                    <button type="button" onClick={() => updateStickerContent("poll", { options: c.options.filter((_: string, j: number) => j !== i) })} className="text-[#a3a3a3] hover:text-[#F44444] flex-shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {c.options.length < 4 && (
                <button type="button" onClick={() => updateStickerContent("poll", { options: [...c.options, ""] })} className="w-full rounded-full px-3 py-2 text-sm text-center text-[#a3a3a3] border border-dashed border-[#d5d5d5] font-medium">
                  Add another option...
                </button>
              )}
            </div>
          </div>
        );
      }
      case "question": {
        const c = stickerContent.question;
        if (!isSelected) {
          return (
            <div className="min-w-[180px]">
              <div className="bg-[#F44444] px-4 py-3">
                <p className="text-sm font-semibold text-white text-center">{c.prompt || "Ask me anything"}</p>
              </div>
              <div className="bg-white px-3 pb-3 pt-2">
                <div className="bg-[#f5f5f5] rounded-full px-3 py-2 text-sm text-[#a3a3a3] text-center">Reply below...</div>
              </div>
            </div>
          );
        }
        return (
          <div className="min-w-[200px]" onMouseDown={stopDrag} onTouchStart={stopDrag} onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#F44444] px-4 py-3">
              <input
                value={c.prompt}
                onChange={(e) => updateStickerContent("question", { prompt: e.target.value })}
                placeholder="Ask me anything"
                autoFocus
                className="w-full text-sm font-semibold text-white text-center bg-transparent outline-none placeholder:text-white/50"
              />
            </div>
            <div className="bg-white px-3 pb-3 pt-2">
              <div className="bg-[#f5f5f5] rounded-full px-3 py-2 text-sm text-[#a3a3a3] text-center">Reply below...</div>
            </div>
          </div>
        );
      }
      case "hashtag": {
        const c = stickerContent.hashtag;
        if (!isSelected) return <span className="text-[#F44444] text-xs font-semibold">#{c.tag || "trending"}</span>;
        return (
          <span className="relative" onMouseDown={stopDrag} onTouchStart={stopDrag}>
            <button type="button" onClick={() => setShowHashtagPicker(true)} className="text-[#F44444] text-xs font-semibold">
              #{c.tag || "trending"}
            </button>
            {showHashtagPicker && (
              <HashtagPicker
                value={c.tag}
                onSelect={(tag) => { updateStickerContent("hashtag", { tag }); setShowHashtagPicker(false); }}
                onClose={() => setShowHashtagPicker(false)}
              />
            )}
          </span>
        );
      }
      case "link": {
        const c = stickerContent.link;
        if (!isSelected) return (<><Link2 className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium text-[#0a0a0a]">Link</span></>);
        return (
          <span className="flex items-center gap-1" onMouseDown={stopDrag} onTouchStart={stopDrag}>
            <Link2 className="w-3 h-3 text-[#F44444] flex-shrink-0" />
            <input
              value={c.url}
              onChange={(e) => updateStickerContent("link", { url: e.target.value })}
              placeholder="https://..."
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-32 bg-transparent text-xs font-medium text-[#0a0a0a] outline-none"
            />
          </span>
        );
      }
      case "music": {
        const c = stickerContent.music;
        if (!isSelected) return (<><Activity className="w-3 h-3 text-white" /><span className="text-xs font-medium text-white">{c.title ? `${c.title}${c.artist ? ` — ${c.artist}` : ""}` : "Add music"}</span></>);
        return (
          <span className="relative" onMouseDown={stopDrag} onTouchStart={stopDrag}>
            <button type="button" onClick={() => setShowMusicPicker(true)} className="flex items-center gap-1.5 text-xs font-medium text-white">
              <Activity className="w-3 h-3 flex-shrink-0" />
              {c.title ? `${c.title}${c.artist ? ` — ${c.artist}` : ""}` : "Choose music"}
            </button>
            {showMusicPicker && (
              <MusicPicker
                onSelect={(data) => { updateStickerContent("music", data); setShowMusicPicker(false); }}
                onClose={() => setShowMusicPicker(false)}
              />
            )}
          </span>
        );
      }
      case "mention": {
        const c = stickerContent.mention;
        if (c.handle) return <span className="text-xs font-medium text-[#0a0a0a]">@{c.handle}</span>;
        if (!isSelected) return <span className="text-xs font-medium text-[#0a0a0a]">@username</span>;
        return (
          <span className="relative" onMouseDown={stopDrag} onTouchStart={stopDrag}>
            <button type="button" onClick={() => setShowMentionPicker(true)} className="text-xs font-medium text-[#0a0a0a]">Tag someone</button>
            {showMentionPicker && (
              <MentionPicker
                excludeUserId={currentUserId}
                onSelect={(u) => { updateStickerContent("mention", { userId: u.id, handle: u.handle, name: u.name, avatar: u.avatar }); setShowMentionPicker(false); }}
                onClose={() => setShowMentionPicker(false)}
              />
            )}
          </span>
        );
      }
      case "time":
        return <span className="text-[#0a0a0a] text-xs font-semibold">{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>;
      default:
        return null;
    }
  };

  const [activePanel, setActivePanel] = useState<"text" | "stickers" | "location" | null>(null);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col md:flex-row md:items-center md:justify-center md:bg-black/40 md:backdrop-blur-sm md:p-4">
      <input ref={storyFileRef} type="file" accept="image/*" multiple onChange={handleStoryFileSelect} className="hidden" tabIndex={-1} aria-hidden="true" />

      {/* ── MOBILE: Full-screen story canvas ── */}
      <div className="flex-1 md:hidden flex flex-col relative">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-3 pb-8" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)" }}>
          <button onClick={onClose} className="p-2 rounded-full bg-black/30 backdrop-blur-sm"><X className="w-5 h-5 text-white" /></button>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setActivePanel(activePanel === "text" ? null : "text")} className={`p-2 rounded-full backdrop-blur-sm ${activePanel === "text" ? "bg-white text-[#0a0a0a]" : "bg-black/30 text-white"}`}>
              <Bold className="w-5 h-5" />
            </button>
            <button onClick={() => setActivePanel(activePanel === "stickers" ? null : "stickers")} className={`p-2 rounded-full backdrop-blur-sm ${activePanel === "stickers" ? "bg-white text-[#0a0a0a]" : "bg-black/30 text-white"}`}>
              <Smile className="w-5 h-5" />
            </button>
            <button onClick={() => setActivePanel(activePanel === "location" ? null : "location")} className={`p-2 rounded-full backdrop-blur-sm ${activePanel === "location" || storyLocation ? "bg-white text-[#0a0a0a]" : "bg-black/30 text-white"}`}>
              <MapPin className="w-5 h-5" />
            </button>
            <button onClick={() => storyFileRef.current?.click()} className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white">
              <ImagePlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          data-story-canvas
          className="flex-1 relative select-none overflow-hidden"
          onMouseMove={handleImgDragMove}
          onMouseUp={handleImgDragEnd}
          onMouseLeave={handleImgDragEnd}
          onTouchMove={handleImgDragMove}
          onTouchEnd={handleImgDragEnd}
          onWheel={handleImgWheel}
          onClick={() => { setSelectedElement(null); setActivePanel(null); }}
        >
          {uploadedMedia.length > 0 ? (
            <div
              className="absolute inset-0 cursor-grab active:cursor-grabbing bg-black"
              onMouseDown={handleImgDragStart}
              onTouchStart={handleImgDragStart}
            >
              <Image
                src={uploadedMedia[0]}
                alt="Story"
                fill
                unoptimized
                className={`${imgFit === "contain" ? "object-contain" : "object-cover"} pointer-events-none`}
                style={{ transform: `translate(${imgPos.x}px, ${imgPos.y}px) scale(${imgPos.scale})` }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#667eea] via-[#64b3f4] to-[#f093fb] flex flex-col items-center justify-center gap-3">
              {uploading ? (
                <Loader2 className="w-10 h-10 text-white/70 animate-spin" />
              ) : (
                <button onClick={(e) => { e.stopPropagation(); storyFileRef.current?.click(); }} className="flex flex-col items-center gap-2">
                  <ImagePlus className="w-10 h-10 text-white/70" />
                  <span className="text-white/70 text-sm font-medium">Tap to add photo</span>
                </button>
              )}
            </div>
          )}

          {/* Stickers on canvas */}
          {stickerEl("poll", renderStickerBody("poll"), "rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.22)]")}
          {stickerEl("question", renderStickerBody("question"), "rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.22)]")}
          {storyLocation && stickerEl("location", <><MapPin className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium text-[#0a0a0a]">{storyLocation}</span></>, "bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]", true)}
          {stickerEl("time", renderStickerBody("time"), "bg-white rounded-full px-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
          {stickerEl("hashtag", renderStickerBody("hashtag"), "bg-white rounded-full px-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
          {stickerEl("mention", renderStickerBody("mention"), "bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
          {stickerEl("link", renderStickerBody("link"), "bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
          {stickerEl("music", renderStickerBody("music"), "bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.35)]")}

          {textOverlay && (
            <div
              className={`absolute touch-none cursor-move px-2 py-1 rounded ${selectedElement === "text" ? "ring-2 ring-white/50 bg-black/20" : ""}`}
              style={{
                left: `${elementPositions.text?.x || 50}%`, top: `${elementPositions.text?.y || 50}%`,
                transform: `translate(-50%, -50%) rotate(${elementPositions.text?.rotation ?? 0}deg) scale(${elementPositions.text?.scale || 1})`,
                textAlign: textStyle.align, opacity: elementPositions.text?.opacity ?? 1,
                zIndex: 20 + (elementPositions.text?.zIndex ?? 20),
                minWidth: "220px", willChange: "transform",
                ...(textBackgroundColor ? { backgroundColor: textBackgroundColor } : {}),
              }}
              {...bindGesture("text")}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setSelectedElement("text"); }}
            >
              <p className={`w-full text-lg drop-shadow-lg ${textStyle.bold ? "font-bold" : "font-medium"} ${textStyle.italic ? "italic" : ""}`} style={{ color: textColor, textAlign: textStyle.align }}>{textOverlay}</p>
              {selectedElement === "text" && (
                <StoryElementToolbar
                  opacity={elementPositions.text?.opacity ?? 1}
                  showTransform
                  onOpacityChange={(val) => setElementOpacity("text", val)}
                  onReorder={(dir) => reorderElement("text", dir)}
                />
              )}
            </div>
          )}
        </div>

        {/* Text panel (slides up) */}
        {activePanel === "text" && (
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-3 overflow-x-auto">
              <button onClick={() => setTextStyle(s => ({ ...s, bold: !s.bold }))} className={`p-2 rounded-lg ${textStyle.bold ? "bg-white text-[#0a0a0a]" : "text-white/70"}`}><Bold className="w-4 h-4" /></button>
              <button onClick={() => setTextStyle(s => ({ ...s, italic: !s.italic }))} className={`p-2 rounded-lg ${textStyle.italic ? "bg-white text-[#0a0a0a]" : "text-white/70"}`}><Italic className="w-4 h-4" /></button>
              <div className="w-px h-5 bg-white/20 mx-1" />
              <button onClick={() => setTextStyle(s => ({ ...s, align: "left" }))} className={`p-2 rounded-lg ${textStyle.align === "left" ? "bg-white text-[#0a0a0a]" : "text-white/70"}`}><AlignLeft className="w-4 h-4" /></button>
              <button onClick={() => setTextStyle(s => ({ ...s, align: "center" }))} className={`p-2 rounded-lg ${textStyle.align === "center" ? "bg-white text-[#0a0a0a]" : "text-white/70"}`}><AlignCenter className="w-4 h-4" /></button>
              <button onClick={() => setTextStyle(s => ({ ...s, align: "right" }))} className={`p-2 rounded-lg ${textStyle.align === "right" ? "bg-white text-[#0a0a0a]" : "text-white/70"}`}><AlignRight className="w-4 h-4" /></button>
              <div className="w-px h-5 bg-white/20 mx-1" />
              {textColors.map(color => (
                <button key={color} onClick={() => setTextColor(color)} className={`w-7 h-7 rounded-full border-2 ${textColor === color ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center gap-1 mb-3 overflow-x-auto">
              <span className="text-white/50 text-[10px] font-medium flex-shrink-0 mr-1">Background</span>
              <button onClick={() => setTextBackgroundColor(null)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${!textBackgroundColor ? "border-white" : "border-white/30"}`}>
                <div className="w-full h-full rounded-full bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#F44444_2px,#F44444_3px)]" />
              </button>
              {textColors.map(color => (
                <button key={color} onClick={() => setTextBackgroundColor(color)} className={`w-6 h-6 rounded-full border-2 ${textBackgroundColor === color ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: color }} />
              ))}
            </div>
            <textarea
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              placeholder="Add text..."
              autoFocus
              className="w-full bg-white/10 text-white text-sm rounded-xl px-3 py-2.5 resize-none outline-none placeholder:text-white/40 min-h-[60px]"
            />
          </div>
        )}

        {/* Stickers panel (slides up) */}
        {activePanel === "stickers" && (
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-4 gap-2">
              {stickers.map(sticker => (
                <button key={sticker.id} onClick={() => toggleSticker(sticker.id)} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${activeStickers.includes(sticker.id) ? "bg-[#F44444] text-white" : "bg-white/10 text-white/70"}`}>
                  <sticker.icon className="w-5 h-5" /><span className="text-[10px] font-medium">{sticker.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Location panel (slides up) */}
        {activePanel === "location" && (
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={storyLocation}
              onChange={(e) => { setStoryLocation(e.target.value); setLocationGeo(null); }}
              placeholder="Search for a location..."
              autoFocus
              className="w-full bg-white/10 text-white text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-white/40 mb-3"
            />
            {placeSearchLoading ? (
              <div className="flex justify-center py-3">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : placeSearchStatus === "not-configured" ? (
              <p className="text-white/50 text-xs text-center py-2">Location search isn't set up yet — you can still type a location manually.</p>
            ) : placeSearchStatus === "failed" ? (
              <p className="text-white/50 text-xs text-center py-2">Location search is temporarily unavailable — you can still type it manually.</p>
            ) : placeSuggestions.length > 0 ? (
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {placeSuggestions.map((s) => (
                  <button key={s.placeId} onClick={() => { selectPlace(s); setActivePanel(null); }} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/15 text-left transition-colors">
                    <MapPin className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                    <span className="text-white text-xs truncate">{s.description}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {storyLocation && (
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => setActivePanel(null)} className="flex-1 py-2 rounded-full bg-[#F44444] text-white text-xs font-medium">Done</button>
                <button onClick={() => { setStoryLocation(""); setLocationGeo(null); }} className="px-3 py-2 rounded-full bg-white/10 text-white/70 text-xs">Clear</button>
              </div>
            )}
          </div>
        )}

        {/* Image controls — show when image is loaded and no panel is open */}
        {uploadedMedia.length > 0 && !activePanel && !selectedElement && (
          <div className="absolute left-3 bottom-16 z-30 flex flex-col gap-1.5">
            <button onClick={() => setImgFit(f => f === "contain" ? "cover" : "contain")} className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-[9px] font-bold ${imgFit === "cover" ? "bg-white text-[#0a0a0a]" : "bg-black/40 text-white"}`}>
              {imgFit === "contain" ? "Fill" : "Fit"}
            </button>
            <button onClick={() => setImgPos(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.15) }))} className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-lg font-bold">+</button>
            <button onClick={() => setImgPos(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.15) }))} className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-lg font-bold">−</button>
            <button onClick={() => { setImgPos({ x: 0, y: 0, scale: 1 }); setImgFit("contain"); }} className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-[10px] font-medium">1:1</button>
          </div>
        )}

        {/* Bottom bar */}
        {!activePanel && (
          <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-safe pt-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)", background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}>
            {(uploadError || postError) && (
              <p className="text-white/90 bg-black/50 rounded-lg px-3 py-1.5 text-xs mb-2">{uploadError || postError}</p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setVisibility(v => v === "public" ? "circle" : "public")} className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white text-xs font-medium">
                  {visibility === "public" ? "Public" : "Circle"}
                </button>
                <button onClick={() => { refreshDrafts(); setShowDrafts(v => !v); }} className={`px-3 py-1.5 rounded-full backdrop-blur-sm text-xs font-medium ${drafts.length > 0 ? "bg-white/30 text-white" : "bg-black/30 text-white/50"}`}>
                  Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {uploadedMedia.length > 0 && (
                  <button onClick={handleSaveDraft} disabled={savingDraft} className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium disabled:opacity-40">
                    {draftSaved ? "Saved!" : savingDraft ? "Saving..." : "Save Draft"}
                  </button>
                )}
                <button onClick={handlePostStory} disabled={!uploadedMedia.length || posting} className="px-5 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium disabled:opacity-40 flex items-center gap-1.5">
                  {posting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {uploading ? "Uploading..." : posting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>

            {/* Drafts drawer */}
            {showDrafts && (
              <div className="mt-3 bg-black/80 backdrop-blur-md rounded-xl p-3 max-h-[200px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-xs font-semibold">Your Drafts</span>
                  <button onClick={() => setShowDrafts(false)} className="text-white/50 text-xs">Close</button>
                </div>
                {drafts.length === 0 ? (
                  <p className="text-white/40 text-xs text-center py-4">No drafts yet. Use "Save Draft" to save your story for later.</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto">
                    {drafts.map(d => (
                      <div key={d.id} className="flex-shrink-0 relative w-16 h-24 rounded-lg overflow-hidden group">
                        <button onClick={() => handleEditDraft(d)} className="w-full h-full">
                          <img src={d.imageUrl} alt="" className="object-cover w-full h-full" />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-center gap-1">
                            <Pencil className="w-3.5 h-3.5 text-white" />
                            <span className="text-[8px] text-white font-medium">Edit</span>
                          </div>
                        </button>
                        <button onClick={(e) => handleDeleteDraft(d.id, e)} className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DESKTOP: Split panel layout ── */}
      <div className="hidden md:flex relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#f0f0f0] flex-shrink-0">
          <span className="text-lg font-semibold text-[#0a0a0a]">{editingDraftId ? "Edit Draft" : "Create Story"}</span>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"><X className="w-5 h-5 text-[#737373]" /></button>
        </div>
        <div className="flex flex-row flex-1 overflow-hidden">
          <div className="w-[360px] flex-shrink-0 p-6">
            <div
              data-story-canvas
              className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black select-none cursor-grab active:cursor-grabbing"
              onMouseMove={handleImgDragMove}
              onMouseUp={handleImgDragEnd}
              onMouseLeave={handleImgDragEnd}
              onMouseDown={uploadedMedia.length > 0 ? handleImgDragStart : undefined}
              onWheel={handleImgWheel}
              onClick={() => setSelectedElement(null)}
            >
              {uploadedMedia.length > 0 ? (
                <Image src={uploadedMedia[0]} alt="Story background" fill sizes="100vw" unoptimized className={`${imgFit === "contain" ? "object-contain" : "object-cover"} pointer-events-none`} style={{ transform: `translate(${imgPos.x}px, ${imgPos.y}px) scale(${imgPos.scale})` }} />
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-[#667eea] via-[#64b3f4] to-[#f093fb]" />
                  <button onClick={() => storyFileRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 cursor-pointer">
                    {uploading ? <Loader2 className="w-8 h-8 text-white/70 animate-spin" /> : <><ImagePlus className="w-8 h-8 text-white/70" /><span className="text-white/70 text-xs font-medium">Click to add photo</span></>}
                  </button>
                </>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
                <Avatar src={userProfile?.avatar} name={userProfile?.name} size={32} className="ring-2 ring-white/50" />
                <div><div className="flex items-center gap-0.5"><span className="text-white text-xs font-semibold drop-shadow-md">{userProfile?.name || "You"}</span>{userProfile?.verified && <VerifiedBadge className="scale-50" />}</div></div>
              </div>
              {stickerEl("poll", renderStickerBody("poll"), "rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.22)]")}
              {stickerEl("question", renderStickerBody("question"), "rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.22)]")}
              {storyLocation && stickerEl("location", <><MapPin className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium text-[#0a0a0a]">{storyLocation}</span></>, "bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]", true)}
              {stickerEl("time", renderStickerBody("time"), "bg-white rounded-full px-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
              {stickerEl("hashtag", renderStickerBody("hashtag"), "bg-white rounded-full px-3 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
              {stickerEl("mention", renderStickerBody("mention"), "bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
              {stickerEl("link", renderStickerBody("link"), "bg-white rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.18)]")}
              {stickerEl("music", renderStickerBody("music"), "bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.35)]")}
              {textOverlay && (
                <div
                  className={`absolute touch-none cursor-move px-1.5 py-0.5 rounded ${selectedElement === "text" ? "ring-2 ring-white/50 bg-black/20" : ""}`}
                  style={{
                    left: `${elementPositions.text?.x || 50}%`, top: `${elementPositions.text?.y || 50}%`,
                    transform: `translate(-50%, -50%) rotate(${elementPositions.text?.rotation ?? 0}deg) scale(${elementPositions.text?.scale || 1})`,
                    textAlign: textStyle.align, opacity: elementPositions.text?.opacity ?? 1,
                    zIndex: 20 + (elementPositions.text?.zIndex ?? 20),
                    minWidth: "220px", willChange: "transform",
                    ...(textBackgroundColor ? { backgroundColor: textBackgroundColor } : {}),
                  }}
                  {...bindGesture("text")}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setSelectedElement("text"); }}
                >
                  <p className={`w-full text-sm drop-shadow-lg ${textStyle.bold ? "font-bold" : "font-medium"} ${textStyle.italic ? "italic" : ""}`} style={{ color: textColor, textAlign: textStyle.align }}>{textOverlay}</p>
                  {selectedElement === "text" && (
                    <StoryElementToolbar
                      opacity={elementPositions.text?.opacity ?? 1}
                      showTransform
                      onOpacityChange={(val) => setElementOpacity("text", val)}
                      onReorder={(dir) => reorderElement("text", dir)}
                    />
                  )}
                </div>
              )}
            </div>
            {/* Image position controls — below preview */}
            {uploadedMedia.length > 0 && (
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setImgFit(f => f === "contain" ? "cover" : "contain")} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${imgFit === "cover" ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb]"}`}>
                    {imgFit === "contain" ? "Fill" : "Fit"}
                  </button>
                  <button onClick={() => { setImgPos({ x: 0, y: 0, scale: 1 }); setImgFit("contain"); }} className="px-3 py-1 text-xs font-medium rounded-full bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb]">
                    Reset
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setImgPos(prev => ({ ...prev, scale: Math.max(0.3, prev.scale - 0.15) }))} className="w-7 h-7 rounded-full bg-[#f5f5f5] hover:bg-[#ebebeb] flex items-center justify-center text-[#525252] text-sm font-bold">−</button>
                  <span className="text-xs text-[#737373] w-10 text-center">{Math.round(imgPos.scale * 100)}%</span>
                  <button onClick={() => setImgPos(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.15) }))} className="w-7 h-7 rounded-full bg-[#f5f5f5] hover:bg-[#ebebeb] flex items-center justify-center text-[#525252] text-sm font-bold">+</button>
                </div>
              </div>
            )}
            {!uploadedMedia.length && <p className="text-xs text-[#a3a3a3] text-center mt-2">Upload a photo to start</p>}
            {uploadedMedia.length > 0 && <p className="text-[10px] text-[#a3a3a3] text-center mt-1.5">Drag to reposition, scroll to zoom</p>}
          </div>
          <div className="flex-1 p-6 overflow-y-auto border-l border-[#f0f0f0]">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Media</h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => storyFileRef.current?.click()} className="w-24 h-20 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-1 text-[#737373] cursor-pointer">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ImagePlus className="w-5 h-5" /><span className="text-xs">Add media</span></>}
                </button>
                {uploadedMedia.map((media, index) => (
                  <div key={index} className="relative w-24 h-20 rounded-xl overflow-hidden ring-2 ring-[#F44444]">
                    <img src={media} alt="" className="object-cover w-full h-full" />
                    <button onClick={() => setUploadedMedia(prev => prev.filter((_, i) => i !== index))} className="absolute top-1 right-1 w-5 h-5 bg-[#525252] hover:bg-[#737373] rounded-full flex items-center justify-center cursor-pointer"><X className="w-3 h-3 text-white" /></button>
                  </div>
                ))}
              </div>
              {uploadError && <p className="text-xs text-[#F44444] mt-2">{uploadError}</p>}
            </div>
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Text Overlay</h3>
              <div className="flex items-center gap-1 mb-3 flex-wrap">
                <button onClick={() => setTextStyle(s => ({ ...s, bold: !s.bold }))} className={`p-2 rounded-lg ${textStyle.bold ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><Bold className="w-4 h-4" /></button>
                <button onClick={() => setTextStyle(s => ({ ...s, italic: !s.italic }))} className={`p-2 rounded-lg ${textStyle.italic ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><Italic className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
                <button onClick={() => setTextStyle(s => ({ ...s, align: "left" }))} className={`p-2 rounded-lg ${textStyle.align === "left" ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><AlignLeft className="w-4 h-4" /></button>
                <button onClick={() => setTextStyle(s => ({ ...s, align: "center" }))} className={`p-2 rounded-lg ${textStyle.align === "center" ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><AlignCenter className="w-4 h-4" /></button>
                <button onClick={() => setTextStyle(s => ({ ...s, align: "right" }))} className={`p-2 rounded-lg ${textStyle.align === "right" ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><AlignRight className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
                {textColors.map(color => (
                  <button key={color} onClick={() => setTextColor(color)} className={`w-6 h-6 rounded-full border-2 ${textColor === color ? "border-[#F44444] scale-110" : "border-transparent"}`} style={{ backgroundColor: color, boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #e5e5e5" : undefined }} />
                ))}
              </div>
              <div className="flex items-center gap-1 mb-3 flex-wrap">
                <span className="text-[#a3a3a3] text-[11px] font-medium mr-1">Background</span>
                <button onClick={() => setTextBackgroundColor(null)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!textBackgroundColor ? "border-[#F44444]" : "border-[#e5e5e5]"}`}>
                  <div className="w-full h-full rounded-full bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#F44444_2px,#F44444_3px)]" />
                </button>
                {textColors.map(color => (
                  <button key={color} onClick={() => setTextBackgroundColor(color)} className={`w-5 h-5 rounded-full border-2 ${textBackgroundColor === color ? "border-[#F44444] scale-110" : "border-transparent"}`} style={{ backgroundColor: color, boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #e5e5e5" : undefined }} />
                ))}
              </div>
              <textarea value={textOverlay} onChange={(e) => setTextOverlay(e.target.value)} placeholder="Add text to your story..." className="w-full bg-[#f8f9fa] rounded-xl p-4 text-sm resize-none outline-none min-h-[80px]" style={{ textAlign: textStyle.align }} />
            </div>
            {/* Location */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Location</h3>
              <input
                type="text"
                value={storyLocation}
                onChange={(e) => { setStoryLocation(e.target.value); setLocationGeo(null); }}
                placeholder="Search for a location..."
                className="w-full bg-[#f8f9fa] rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#a3a3a3] mb-2"
              />
              {placeSearchLoading ? (
                <div className="flex justify-center py-2">
                  <div className="w-4 h-4 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
                </div>
              ) : placeSearchStatus === "not-configured" ? (
                <p className="text-[#a3a3a3] text-xs">Location search isn't set up yet — you can still type a location manually.</p>
              ) : placeSearchStatus === "failed" ? (
                <p className="text-[#a3a3a3] text-xs">Location search is temporarily unavailable — you can still type it manually.</p>
              ) : placeSuggestions.length > 0 ? (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {placeSuggestions.map((s) => (
                    <button key={s.placeId} onClick={() => selectPlace(s)} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#f8f9fa] text-left transition-colors">
                      <MapPin className="w-3.5 h-3.5 text-[#a3a3a3] flex-shrink-0" />
                      <span className="text-xs text-[#0a0a0a] truncate">{s.description}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Stickers & Elements</h3>
              <div className="grid grid-cols-4 gap-2">
                {stickers.map(sticker => (
                  <button key={sticker.id} onClick={() => toggleSticker(sticker.id)} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all cursor-pointer ${activeStickers.includes(sticker.id) ? "bg-[#F44444] text-white" : "bg-[#f8f9fa] text-[#525252] hover:bg-[#f0f0f0]"}`}>
                    <sticker.icon className="w-5 h-5" /><span className="text-xs font-medium">{sticker.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setVisibility("public")} className={`px-4 py-2 text-sm font-medium rounded-full transition-all cursor-pointer ${visibility === "public" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5]"}`}>Public</button>
            <button onClick={() => setVisibility("circle")} className={`px-4 py-2 text-sm font-medium rounded-full transition-all cursor-pointer ${visibility === "circle" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5]"}`}>Circle only</button>
          </div>
          <div className="flex items-center gap-2">
            {(uploadError || postError) && (
              <span className="text-xs text-[#F44444]">{uploadError || postError}</span>
            )}
            {draftSaved && (
              <span className="text-xs text-[#22c55e] font-medium">Draft saved</span>
            )}
            <button onClick={() => { refreshDrafts(); setShowDrafts(v => !v); }} className={`px-3 py-2 text-sm font-medium rounded-full cursor-pointer transition-colors ${drafts.length > 0 ? "text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]" : "text-[#a3a3a3] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>
              Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] cursor-pointer">Cancel</button>
            {uploadedMedia.length > 0 && (
              <button onClick={handleSaveDraft} disabled={savingDraft} className="px-4 py-2 text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
                {savingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {draftSaved ? "Saved!" : savingDraft ? "Saving..." : "Save Draft"}
              </button>
            )}
            <button onClick={handlePostStory} disabled={!uploadedMedia.length || posting} className="px-5 py-2 text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d64d3c] cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
              {posting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {posting ? "Posting..." : "Post Story"}
            </button>
          </div>
        </div>

        {/* Drafts panel — desktop */}
        {showDrafts && (
          <div className="px-6 py-3 border-t border-[#f0f0f0] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#0a0a0a]">Drafts</span>
              <button onClick={() => setShowDrafts(false)} className="text-xs text-[#737373] hover:text-[#0a0a0a]">Close</button>
            </div>
            {drafts.length === 0 ? (
              <p className="text-[#a3a3a3] text-xs text-center py-4">No drafts yet. Upload an image and click "Save Draft" to save for later.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {drafts.map(d => (
                  <div key={d.id} className={`flex-shrink-0 relative w-20 h-28 rounded-xl overflow-hidden group cursor-pointer border transition-colors ${editingDraftId === d.id ? "border-[#F44444] ring-2 ring-[#F44444]/20" : "border-[#e5e5e5] hover:border-[#F44444]"}`}>
                    <button onClick={() => handleEditDraft(d)} className="w-full h-full">
                      <img src={d.imageUrl} alt="" className="object-cover w-full h-full" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center gap-1">
                        <Pencil className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                      </div>
                    </button>
                    <button onClick={(e) => handleDeleteDraft(d.id, e)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3 text-white" />
                    </button>
                    {d.textOverlay && <span className="absolute bottom-1 left-1 right-1 text-[8px] text-white truncate drop-shadow pointer-events-none">{d.textOverlay}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const HASHTAG_SUGGESTIONS = [
  "article", "news", "technology", "business", "sports", "politics",
  "entertainment", "health", "science", "travel", "food", "finance",
  "startup", "culture", "education", "environment", "innovation",
  "lifestyle", "trending", "breaking", "opinion", "analysis",
  "interview", "exclusive", "world", "economy", "markets", "climate",
  "design", "developer", "ai", "crypto", "investing", "marketing",
];

function extractHashtags(html: string): string[] {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent || div.innerText || "";
  const matches = text.match(/#(\w+)/g) || [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

function CreatePostModal({ onClose }: { onClose: () => void }) {
  const { currentUserId, userProfile } = useContext(AuthContext);
  const [postContent, setPostContent] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [hashtagQuery, setHashtagQuery] = useState<{ search: string } | null>(null);
  const [hashtagIndex, setHashtagIndex] = useState(0);
  const [visibility, setVisibility] = useState<"public" | "circle">("public");
  const [contentScope, setContentScope] = useState<"GLOBAL" | "REGIONAL" | "LOCAL">("GLOBAL");
  const [showScopeMenu, setShowScopeMenu] = useState(false);
  const scopeMenuRef = useRef<HTMLDivElement>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const maxChars = 1000;
  const maxFiles = 10;

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropAspect, setCropAspect] = useState(1);
  const [cropPixelArea, setCropPixelArea] = useState<Area | null>(null);
  const [cropProcessing, setCropProcessing] = useState(false);

  // Close scope menu on outside click
  useEffect(() => {
    if (!showScopeMenu) return;
    const handler = (e: MouseEvent) => {
      if (scopeMenuRef.current && !scopeMenuRef.current.contains(e.target as Node)) {
        setShowScopeMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showScopeMenu]);

  // Walk backward from cursor inside a text node to find current #word
  const getHashAtCursor = (): string | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const node = range.endContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent || "";
    const pos = range.endOffset;
    // Walk back to find start of the current word
    let start = pos;
    while (start > 0 && !/[\s\n]/.test(text[start - 1])) start--;
    const word = text.slice(start, pos);
    if (word.startsWith("#")) return word.slice(1); // search term after #
    return null;
  };

  // Sync contentEditable text to state + detect hashtag trigger
  const handleEditorInput = () => {
    const el = editorRef.current;
    if (!el) return;
    setCharCount((el.innerText || "").length);
    setPostContent(el.innerHTML);
    const search = getHashAtCursor();
    if (search !== null) {
      setHashtagQuery({ search });
      setHashtagIndex(0);
    } else {
      setHashtagQuery(null);
    }
  };

  // Rich text commands
  const execFormat = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const insertTextAtCursor = (text: string) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, text);
  };

  const selectHashtag = (tag: string) => {
    setHashtagQuery(null);
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.endContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent || "";
    const pos = range.endOffset;
    // Same backward-walk as getHashAtCursor
    let start = pos;
    while (start > 0 && !/[\s\n]/.test(text[start - 1])) start--;
    if (text[start] !== "#") return;
    // Select from # to cursor and replace
    const newRange = document.createRange();
    newRange.setStart(node, start);
    newRange.setEnd(node, pos);
    sel.removeAllRanges();
    sel.addRange(newRange);
    document.execCommand("insertText", false, `#${tag} `);
    setCharCount((el.innerText || "").length);
    setPostContent(el.innerHTML);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hashtagQuery) return;
    const filtered = HASHTAG_SUGGESTIONS.filter(t =>
      t.startsWith(hashtagQuery.search.toLowerCase())
    );
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHashtagIndex(i => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHashtagIndex(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectHashtag(filtered[hashtagIndex] ?? filtered[0]);
    } else if (e.key === "Escape") {
      setHashtagQuery(null);
    }
  };

  const suggestedLocations = [
    "San Francisco, CA", "New York, NY", "London, UK", "Bangalore, India",
    "Mumbai, India", "Dubai, UAE", "Singapore", "Tokyo, Japan",
    "Berlin, Germany", "Austin, TX", "Seattle, WA", "Toronto, Canada",
    "Paris, France", "Sydney, Australia", "Los Angeles, CA",
  ];
  const filteredLocations = locationSearch.trim()
    ? suggestedLocations.filter(l => l.toLowerCase().includes(locationSearch.toLowerCase()))
    : suggestedLocations;

  const selectLocation = (loc: string) => {
    setLocation(loc);
    setShowLocationInput(false);
    setLocationSearch("");
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const firstFile = files[0];
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (firstFile.type.startsWith("image/")) {
      if (firstFile.size > 10 * 1024 * 1024) {
        setUploadError("Image must be 10 MB or smaller.");
        setTimeout(() => setUploadError(null), 4000);
        return;
      }
      const src = URL.createObjectURL(firstFile);
      setCropSrc(src);
      setCropPos({ x: 0, y: 0 });
      setCropZoom(1);
      setCropAspect(1);
      setCropPixelArea(null);
      return;
    }

    // Videos upload directly without crop
    const oversized = Array.from(files).find(f => f.size > 100 * 1024 * 1024);
    if (oversized) {
      setUploadError("Video must be 100 MB or smaller.");
      setTimeout(() => setUploadError(null), 4000);
      return;
    }
    setUploading(true);
    try {
      const remaining = maxFiles - uploadedImages.length;
      const toUpload = Array.from(files).slice(0, remaining);
      const urls: string[] = [];
      for (const file of toUpload) {
        const result = await api.uploadFile(file, currentUserId, "videos");
        urls.push(result.url);
      }
      setUploadedImages(prev => [...prev, ...urls]);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleCropConfirm = async () => {
    if (!cropSrc || !cropPixelArea) return;
    setCropProcessing(true);
    try {
      const blob = await getCroppedBlob(cropSrc, cropPixelArea);
      setUploading(true);
      const result = await api.uploadFile(
        new File([blob], "post.jpg", { type: "image/jpeg" }),
        currentUserId,
        "posts"
      );
      setUploadedImages(prev => [...prev, result.url]);
    } catch (err) {
      console.error("Crop/upload failed:", err);
    } finally {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setCropPixelArea(null);
      setCropProcessing(false);
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropPixelArea(null);
  };

  const getPlainText = () => editorRef.current?.innerText?.trim() || "";
  const getHtml = () => editorRef.current?.innerHTML || "";

  const handlePost = async () => {
    const text = getPlainText();
    const html = getHtml();
    if ((!text && !uploadedImages.length) || posting) return;
    setPosting(true);
    try {
      if (editingDraftId) {
        await api.editPost(editingDraftId, { content: html, image: uploadedImages[0] || undefined, status: "published" });
      } else {
        await api.createPost({
          userId: currentUserId,
          type: "post",
          content: html,
          description: location || undefined,
          image: uploadedImages[0] || undefined,
          tags: extractHashtags(html),
          contentScope,
        });
      }
      window.dispatchEvent(new Event("albiz-post-created"));
      onClose();
    } catch {
      onClose();
    } finally {
      setPosting(false);
    }
  };

  const handleSaveDraft = async () => {
    const text = getPlainText();
    const html = getHtml();
    if (!text && !uploadedImages.length) { onClose(); return; }
    try {
      if (editingDraftId) {
        await api.editPost(editingDraftId, { content: html, image: uploadedImages[0] || undefined });
      } else {
        await api.createPost({
          userId: currentUserId,
          type: "post",
          content: html,
          description: location || undefined,
          image: uploadedImages[0] || undefined,
          tags: [],
          status: "draft",
          contentScope,
        });
      }
    } catch { }
    onClose();
  };

  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch(`/api/posts?status=drafts&userId=${currentUserId}`);
      if (res.ok) setDrafts(await res.json());
    } catch { }
    setLoadingDrafts(false);
  };

  const toggleDrafts = () => {
    if (!showDrafts) loadDrafts();
    setShowDrafts(!showDrafts);
  };

  const loadDraft = (draft: any) => {
    setPostContent(draft.content || "");
    if (editorRef.current) editorRef.current.innerHTML = draft.content || "";
    if (draft.image) setUploadedImages([draft.image]);
    else setUploadedImages([]);
    setEditingDraftId(draft.id);
    setShowDrafts(false);
  };

  const deleteDraft = async (draftId: number) => {
    await api.deletePost(draftId).catch(() => { });
    setDrafts(prev => prev.filter(d => d.id !== draftId));
  };

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  if (cropSrc) {
    const CROP_ASPECTS = [
      { label: "1:1", value: 1 },
      { label: "4:5", value: 0.8 },
      { label: "16:9", value: 16 / 9 },
    ] as const;

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/75">
        <div className="w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl">
          {/* Crop area */}
          <div className="relative w-full bg-[#fafafa]" style={{ height: 420 }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${cropSrc})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(20px)",
                transform: "scale(1.1)",
                opacity: 0.15,
              }}
            />
            <Cropper
              image={cropSrc}
              crop={cropPos}
              zoom={cropZoom}
              aspect={cropAspect}
              onCropChange={setCropPos}
              onZoomChange={setCropZoom}
              onCropComplete={(_, px) => setCropPixelArea(px)}
              showGrid={false}
              style={{
                containerStyle: { background: "transparent" },
                cropAreaStyle: { border: "2px solid #F44444", boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" },
              }}
            />
          </div>

          {/* Controls */}
          <div className="px-5 pt-4 pb-5 border-t border-[#f0f0f0]">
            <div className="flex items-center justify-center gap-2 mb-4">
              {CROP_ASPECTS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { setCropAspect(opt.value); setCropPos({ x: 0, y: 0 }); setCropZoom(1); }}
                  className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${Math.abs(cropAspect - opt.value) < 0.01 ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#737373] hover:bg-[#ebebeb]"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={handleCropCancel} className="px-4 py-2 rounded-xl text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors">Cancel</button>
              <button
                onClick={handleCropConfirm}
                disabled={!cropPixelArea || cropProcessing}
                className="px-6 py-2 rounded-full bg-[#F44444] text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2 hover:bg-[#d63c3c] transition-colors"
              >
                {cropProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                Choose
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto animate-scale-in">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />

        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-5 border-b border-[#f0f0f0]">
          <span className="text-lg md:text-xl font-semibold text-[#0a0a0a]">{editingDraftId ? "Edit Draft" : "Create Post"}</span>
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#737373]" />
          </button>
        </div>

        {/* User Info + Drafts */}
        <div className="flex items-center justify-between px-3 md:px-5 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Avatar src={userProfile?.avatar} name={userProfile?.name} size={48} className="!w-full !h-full" />
            </div>
            <span className="font-semibold text-sm md:text-base text-[#0a0a0a]">{userProfile?.name || "You"}</span>
          </div>
          <button onClick={toggleDrafts} className="text-[#F44444] font-medium text-xs md:text-sm hover:underline flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Drafts
          </button>
        </div>

        {/* Drafts Panel */}
        {showDrafts && (
          <div className="px-3 md:px-5 pb-3">
            <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
              {loadingDrafts ? (
                <div className="py-6 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" /></div>
              ) : drafts.length > 0 ? (
                <div className="divide-y divide-[#f0f0f0] max-h-[200px] overflow-y-auto">
                  {drafts.map(d => (
                    <div key={d.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-[#fafafa] transition-colors group">
                      <button onClick={() => loadDraft(d)} className="flex-1 min-w-0 text-left">
                        <p className="text-xs text-[#0a0a0a] truncate">{d.content || d.title || "Untitled draft"}</p>
                        <p className="text-[10px] text-[#a3a3a3] mt-0.5">{d.date}</p>
                      </button>
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => loadDraft(d)} className="p-1 hover:bg-[#e5e5e5] rounded transition-colors" title="Edit">
                          <Pencil className="w-3 h-3 text-[#525252]" />
                        </button>
                        <button onClick={() => deleteDraft(d.id)} className="p-1 hover:bg-[#FFE5E5] rounded transition-colors" title="Delete">
                          <Trash2 className="w-3 h-3 text-[#F44444]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#a3a3a3] text-center py-4">No drafts saved yet</p>
              )}
            </div>
          </div>
        )}

        {/* Formatting Toolbar */}
        <div className="px-3 md:px-5 pb-2">
          <div className="flex items-center gap-0.5 md:gap-1">
            <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat("bold")} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Bold">
              <Bold className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat("italic")} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Italic">
              <Italic className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => setShowLinkInput(!showLinkInput)} className={`p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors ${showLinkInput ? "text-[#F44444] bg-[#f5f5f5]" : "text-[#525252]"}`} title="Link">
              <LinkIcon className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat("insertUnorderedList")} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Bullet List">
              <List className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => execFormat("insertOrderedList")} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Numbered List">
              <ListOrdered className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          {showLinkInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#e5e5e5] bg-[#fafafa] outline-none focus:border-[#F44444]"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && linkUrl.trim()) { execFormat("createLink", linkUrl.trim()); setLinkUrl(""); setShowLinkInput(false); } if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); } }}
              />
              <button onClick={() => { if (linkUrl.trim()) { execFormat("createLink", linkUrl.trim()); setLinkUrl(""); setShowLinkInput(false); } }} className="px-3 py-1.5 text-xs font-medium bg-[#F44444] text-white rounded-lg hover:bg-[#d63c3c]">Add</button>
              <button onClick={() => { setShowLinkInput(false); setLinkUrl(""); }} className="px-2 py-1.5 text-xs text-[#737373] hover:text-[#0a0a0a]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="bg-[#f5f5f5] rounded-xl p-3 md:p-4 min-h-[100px] md:min-h-[120px]">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onKeyDown={handleEditorKeyDown}
              onBlur={() => setTimeout(() => setHashtagQuery(null), 150)}
              data-placeholder="What's on your mind?"
              className="w-full bg-transparent text-[#262626] text-sm md:text-base outline-none min-h-[80px] md:min-h-[100px] empty:before:content-[attr(data-placeholder)] empty:before:text-[#c5c5c5] empty:before:pointer-events-none [&_b]:font-bold [&_i]:italic [&_a]:text-[#F44444] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            />
          </div>
        </div>

        {/* Hashtag autocomplete — inline, no position math */}
        {hashtagQuery && (() => {
          const filtered = HASHTAG_SUGGESTIONS.filter(t =>
            t.startsWith(hashtagQuery.search.toLowerCase())
          );
          if (!filtered.length) return null;
          return (
            <div className="px-3 md:px-5 pb-2">
              <div
                className="bg-white rounded-xl border border-[#e5e5e5] shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden"
                onMouseDown={e => e.preventDefault()}
              >
                {filtered.slice(0, 6).map((tag, i) => (
                  <button
                    key={tag}
                    onClick={() => selectHashtag(tag)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2.5 border-b border-[#f5f5f5] last:border-0 ${i === hashtagIndex ? "bg-[#fafafa] text-[#0a0a0a]" : "text-[#262626] hover:bg-[#fafafa]"}`}
                  >
                    <span className="text-[#F44444] font-semibold text-sm">#</span>
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Image Upload Section */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="flex gap-2 md:gap-3 flex-wrap">
            {uploadedImages.map((img, index) => (
              <div key={index} className="relative w-24 h-20 md:w-32 md:h-28 rounded-xl overflow-hidden">
                <Image src={img} alt={`Upload ${index + 1}`} width={128} height={112} className="object-cover w-full h-full" unoptimized />
                <button onClick={() => removeImage(index)} className="absolute top-1 right-1 md:top-2 md:right-2 w-5 h-5 md:w-6 md:h-6 bg-[#525252] hover:bg-[#737373] rounded-full flex items-center justify-center transition-colors">
                  <X className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="w-24 h-20 md:w-32 md:h-28 rounded-xl border-2 border-[#e5e5e5] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
              </div>
            )}
            {!uploading && uploadedImages.length < maxFiles && (
              <button onClick={() => fileInputRef.current?.click()} className="w-24 h-20 md:w-32 md:h-28 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-1 text-[#737373] cursor-pointer">
                <ImagePlus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[10px] md:text-xs">{uploadedImages.length ? "Add More" : "Add Image"}</span>
              </button>
            )}
          </div>
          {uploadError
            ? <p className="text-[10px] md:text-xs text-[#F44444] mt-2">{uploadError}</p>
            : uploadedImages.length > 0
              ? <p className="text-[10px] md:text-xs text-[#737373] mt-2">{uploadedImages.length}/{maxFiles} files added</p>
              : <p className="text-[10px] md:text-xs text-[#a3a3a3] mt-1.5">Supports JPG, PNG and WebP up to 10 MB</p>
          }
        </div>

        {/* Action Icons */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Upload Image">
              <ImagePlus className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => setShowLocationInput(!showLocationInput)} className={`p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors ${location || showLocationInput ? "text-[#F44444]" : "text-[#737373]"}`} title="Location">
              <MapPin className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                editorRef.current?.focus();
                insertTextAtCursor("#");
                // execCommand fires input async in some browsers; nudge the dropdown immediately
                setHashtagQuery({ search: "" });
                setHashtagIndex(0);
              }}
              className={`p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors ${hashtagQuery !== null ? "text-[#F44444]" : "text-[#737373]"}`}
              title="Hashtag"
            >
              <Hash className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          {/* Selected location chip */}
          {location && !showLocationInput && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F44444]/5 text-[#F44444] text-xs font-medium">
                <MapPin className="w-3 h-3" />
                {location}
                <button onClick={() => setLocation("")} className="ml-0.5 hover:text-[#d63c3c]"><X className="w-3 h-3" /></button>
              </span>
            </div>
          )}
          {/* Location picker */}
          {showLocationInput && (
            <div className="mt-2 rounded-xl border border-[#e5e5e5] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f0f0f0]">
                <MapPin className="w-3.5 h-3.5 text-[#a3a3a3] flex-shrink-0" />
                <input
                  value={locationSearch}
                  onChange={e => setLocationSearch(e.target.value)}
                  placeholder="Search location..."
                  className="flex-1 text-xs outline-none bg-transparent text-[#0a0a0a] placeholder:text-[#c5c5c5]"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter" && locationSearch.trim()) { selectLocation(locationSearch.trim()); }
                    if (e.key === "Escape") { setShowLocationInput(false); setLocationSearch(""); }
                  }}
                />
                <button onClick={() => { setShowLocationInput(false); setLocationSearch(""); }} className="text-[#a3a3a3] hover:text-[#525252]"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="max-h-[140px] overflow-y-auto">
                {filteredLocations.map(loc => (
                  <button key={loc} onClick={() => selectLocation(loc)} className="w-full text-left px-3 py-2 text-xs text-[#262626] hover:bg-[#fafafa] transition-colors flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-[#a3a3a3] flex-shrink-0" />
                    {loc}
                  </button>
                ))}
                {locationSearch.trim() && !filteredLocations.includes(locationSearch.trim()) && (
                  <button onClick={() => selectLocation(locationSearch.trim())} className="w-full text-left px-3 py-2 text-xs text-[#F44444] hover:bg-[#fafafa] transition-colors flex items-center gap-2">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    Use "{locationSearch.trim()}"
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 md:px-5 py-3 md:py-4 border-t border-[#f0f0f0]">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <button onClick={() => setVisibility("public")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${visibility === "public" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Public</button>
            <button onClick={() => setVisibility("circle")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${visibility === "circle" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Circle only</button>
            {/* Distribution scope picker */}
            <div className="relative" ref={scopeMenuRef}>
              <button
                onClick={() => setShowScopeMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-[#737373]" />
                <span>{contentScope === "GLOBAL" ? "Everywhere" : contentScope === "REGIONAL" ? "My region" : "My country"}</span>
                <ChevronDown className="w-3 h-3 text-[#a3a3a3]" />
              </button>
              {showScopeMenu && (
                <div className="absolute bottom-full mb-2 left-0 w-44 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1 z-50">
                  {([
                    { value: "GLOBAL", label: "Everywhere", sub: "All countries" },
                    { value: "REGIONAL", label: "My region", sub: "Nearby countries" },
                    { value: "LOCAL", label: "My country", sub: "Your country only" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setContentScope(opt.value); setShowScopeMenu(false); }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-[#f5f5f5] transition-colors ${contentScope === opt.value ? "text-[#0a0a0a]" : "text-[#525252]"}`}
                    >
                      <div className="text-xs font-medium">{opt.label}</div>
                      <div className="text-[11px] text-[#a3a3a3] mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2 md:gap-3">
            <span className={`text-xs md:text-sm tabular-nums ${charCount > maxChars ? "text-[#F44444] font-medium" : charCount > maxChars * 0.9 ? "text-[#F59E0B]" : "text-[#737373]"}`}>{charCount}/{maxChars}</span>
            <button onClick={handleSaveDraft} className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors cursor-pointer">Save draft</button>
            <button onClick={handlePost} disabled={posting || charCount > maxChars} className="px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
              {posting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverlayAdManager() {
  const { currentUserId } = useContext(AuthContext);
  const [ad, setAd] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const impressionFired = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("overlay_ad_dismissed")) return;
    fetch("/api/ads/serve?zone_type=overlay")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const first = data?.ads?.[0];
        if (!first) return;
        setAd(first);
        timerRef.current = setTimeout(() => setVisible(true), 2500);
      })
      .catch(() => { });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (!visible || !ad || impressionFired.current) return;
    impressionFired.current = true;
    fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: ad.campaignId, creativeId: ad.creativeId, type: "IMPRESSION", placement: ad.placement, userId: currentUserId || null }),
    }).catch(() => { });
  }, [visible, ad, currentUserId]);

  const dismiss = () => {
    setVisible(false);
    if (typeof window !== "undefined") sessionStorage.setItem("overlay_ad_dismissed", "1");
  };

  const handleCta = () => {
    fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: ad.campaignId, creativeId: ad.creativeId, type: "CLICK", placement: ad.placement, userId: currentUserId || null }),
    }).catch(() => { });
    if (ad.ctaUrl) window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
    dismiss();
  };

  if (!ad) return null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[300] bg-black/55 backdrop-blur-sm"
            onClick={dismiss}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, duration: 0.15 }}
            className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-[340px] pointer-events-auto">
              <button
                onClick={dismiss}
                className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
              <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-black/35 backdrop-blur-sm">
                <span className="text-[10px] text-white/80 font-medium tracking-wide">Sponsored</span>
              </div>

              {ad.image ? (
                <div className="relative h-44">
                  <Image src={ad.image} alt={ad.title} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              ) : (
                <div className="h-20 bg-[#f5f5f5]" />
              )}

              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {ad.sponsor?.logo ? (
                    <Image src={ad.sponsor.logo} alt={ad.sponsor.name} width={18} height={18} className="rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full bg-[#f0f0f0] flex items-center justify-center text-[8px] font-bold text-[#737373] flex-shrink-0">
                      {(ad.sponsor?.name || "A").charAt(0)}
                    </div>
                  )}
                  <span className="text-xs text-[#737373] truncate">{ad.sponsor?.name}</span>
                </div>
                <p className="text-sm font-semibold text-[#0a0a0a] leading-tight mb-1.5">{ad.title}</p>
                {ad.description && <p className="text-xs text-[#737373] mb-3 line-clamp-2 leading-relaxed">{ad.description}</p>}
                <button
                  onClick={handleCta}
                  className="w-full py-2.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
                >
                  {ad.ctaText || "Learn More"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function AuthSyncWrapper({ children, onInit }: { children: React.ReactNode, onInit?: () => void }) {
  const { data: session, status } = useSession();
  const { signIn, signOut } = useContext(AuthContext);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const u = session.user as any;

      if (u.role && u.id) {
        const profile: UserProfile = {
          name: u.name || "",
          avatar: u.avatar || u.image || "",
          title: u.title || "",
          handle: u.handle || "",
          verified: u.verified || false,
          isPremium: u.isPremium || false,
          email: u.email || "",
          circleWelcomeSeen: u.circleWelcomeSeen ?? true,
        };
        signIn(u.role, u.id, u.canPost, profile);
      }
    } else if (status === "unauthenticated") {

      signOut({ skipNextAuth: true });
    }

    if (status !== "loading") {
      onInit?.();
    }
     
  }, [status, session]);

  if (status === "loading") {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse">
          <AlbizLogo size={48} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function PushNotificationsSetup() {
  const { isSignedIn, currentUserId } = useContext(AuthContext);
  usePushNotifications(isSignedIn && currentUserId > 0);
  return null;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRoleType>(null);
  const [currentUserId, setCurrentUserId] = useState(0);
  const [canPost, setCanPost] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [authModal, setAuthModal] = useState<{ mode: "signin" | "signup"; context?: InteractionContext } | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);

  // Show onboarding only once per user — guard against re-shows
  useEffect(() => {
    if (showOnboard && currentUserId > 0 && localStorage.getItem(`albiz_onboarded_${currentUserId}`)) {
      setShowOnboard(false);
    }
  }, [showOnboard, currentUserId]);
  const [following, setFollowing] = useState<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [hasClosedAuthModal, setHasClosedAuthModal] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const touchStartX = useRef(0);
  const router = useRouter();
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isCircle && touchStartX.current < 20 && e.touches[0].clientX - touchStartX.current > 50) {
      setIsMobileDrawerOpen(true);
    }
  };

  // Check for verified=true URL parameter to trigger onboarding
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const verified = urlParams.get('verified');

      if (verified === 'true') {
        // Store verification state in sessionStorage
        sessionStorage.setItem('fromEmailVerification', 'true');
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);

        if (isSignedIn && currentUserId > 0) {
          // User is signed in, check for interests
          fetch(`/api/interests?userId=${currentUserId}`)
            .then(res => res.json())
            .then(data => {
              const interests = Array.isArray(data) ? data : data?.interests;
              if (!interests || interests.length === 0) {
                setShowOnboard(true);
              }
            })
            .catch(() => { });
          // Clear the session storage
          sessionStorage.removeItem('fromEmailVerification');
        } else {
          // User not signed in, show sign-in modal
          setAuthModal({ mode: "signin" });
        }
      }
    }
  }, [isSignedIn, currentUserId]);

  // Initialize native app (Capacitor)
  useEffect(() => {
    if (isNative) {
      initNativeApp();
      document.documentElement.classList.add('native-app');
    }
  }, []);

  // Mobile detection with debounced resize
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;

    const checkMobile = () => {
      // Use 1024px threshold so tablets (e.g. 800px wide) always get mobile nav
      const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();
      setIsMobile(isNative || window.innerWidth < 1024);
    };

    const debouncedCheckMobile = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkMobile, 100);
    };

    checkMobile();
    window.addEventListener('resize', debouncedCheckMobile);

    return () => {
      window.removeEventListener('resize', debouncedCheckMobile);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Load follows from DB on mount
  useEffect(() => {
    if (isSignedIn && currentUserId > 0) {
      api.getFollowing(currentUserId).then(ids => setFollowing(new Set(ids))).catch(() => { });
    }
  }, []);

  // Poll unread notification count every 30s
  useEffect(() => {
    if (!isSignedIn || !currentUserId) return;
    const fetchCount = () => {
      fetch(`/api/notifications?userId=${currentUserId}`)
        .then(r => r.json())
        .then((notifs: any[]) => {
          if (Array.isArray(notifs)) setUnreadNotifCount(notifs.filter(n => n.unread).length);
        })
        .catch(() => { });
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, [isSignedIn, currentUserId]);

  // Ping presence on load and every 5 minutes so lastSeenAt stays current for DAU/MAU
  useEffect(() => {
    if (!isSignedIn || !currentUserId) return;
    const ping = () => {
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isSignedIn, currentUserId]);

  // Auto show sign-in modal for anonymous users on mobile (only if they haven't closed it)
  useEffect(() => {
    if (isMobile && authInitialized && !isSignedIn && !authModal && !hasClosedAuthModal) {
      // Add a small delay to ensure the page has loaded
      const timer = setTimeout(() => {
        setAuthModal({ mode: "signin" });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isMobile, authInitialized, isSignedIn, authModal, hasClosedAuthModal]);

  // Reset the flag when user signs in
  useEffect(() => {
    if (isSignedIn) {
      setHasClosedAuthModal(false);

      // Check if user came from email verification
      const fromEmailVerification = sessionStorage.getItem('fromEmailVerification');
      if (fromEmailVerification === 'true' && currentUserId > 0) {
        // Check for interests and show onboarding if needed
        fetch(`/api/interests?userId=${currentUserId}`)
          .then(res => res.json())
          .then(data => {
            const interests = Array.isArray(data) ? data : data?.interests;
            if (!interests || interests.length === 0) {
              setShowOnboard(true);
            }
          })
          .catch(() => { });
        // Clear the session storage
        sessionStorage.removeItem('fromEmailVerification');
      }
    }
  }, [isSignedIn, currentUserId]);


  // Visit beacon — fires once per page load
  useEffect(() => {
    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: window.location.pathname, referrer: document.referrer || null }),
    }).catch(() => { });
  }, []);
  const [hasActiveStory, setHasActiveStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewingUserId, setStoryViewingUserId] = useState<number | null>(null);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [storyCreatorKey, setStoryCreatorKey] = useState(0);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [adStory, setAdStory] = useState<any | null>(null);

  // Sync hasActiveStory with real DB stories
  useEffect(() => {
    if (!isSignedIn || !currentUserId) return;
    api.getStories(currentUserId).then((data: any) => {
      const count = (data.storyUsers || []).reduce((sum: number, su: any) => sum + su.stories.length, 0);
      setHasActiveStory(count > 0);
    }).catch(() => { });
  }, [currentUserId, isSignedIn, showStoryCreator, showStoryViewer]);

  const toggleFollow = useCallback((rawUserId: number | string) => {
    const userId = Number(rawUserId);
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        api.unfollow(currentUserId, userId).catch(() => { });
      } else {
        next.add(userId);
        api.follow(currentUserId, userId).catch(() => { });
      }
      return next;
    });
  }, [currentUserId]);

  const authValue = useMemo(() => ({
    isSignedIn,
    userRole,
    currentUserId,
    canPost,
    unreadNotifCount,
    signOut: async (options?: { callbackUrl?: string, skipNextAuth?: boolean }) => {
      setIsSignedIn(false);
      setUserRole(null);
      setCurrentUserId(0);
      setCanPost(false);
      setUserProfile(null);
      setFollowing(new Set());
      if (!options?.skipNextAuth) {
        try {
          const { getFirebaseAuth } = await import("@/lib/firebase-client");
          await getFirebaseAuth().signOut();
        } catch (err) {
          console.warn("[Auth] Firebase signout failed:", err);
        }
        await nextAuthSignOut({ redirect: true, callbackUrl: options?.callbackUrl || "/" });
      }
    },
    signIn: (role: UserRoleType = "CIRCLE", userId: number = 1, userCanPost = true, profile: UserProfile = null) => {
      setIsSignedIn(true); setUserRole(role); setCurrentUserId(userId);
      setCanPost(role === "CIRCLE" || role === "ADMIN" ? true : userCanPost);
      if (profile) setUserProfile(profile);
      api.getFollowing(userId).then(ids => setFollowing(new Set(ids))).catch(() => setFollowing(new Set()));
    },
    userProfile,
    openAuthModal: (mode: "signin" | "signup", context?: InteractionContext) => {
      setAuthModal({ mode, context });
      setHasClosedAuthModal(false);
    },
    requireGuestAuth: (context: InteractionContext, callback: () => void) => {
      if (!isSignedIn) {
        setAuthModal({ mode: "signup", context });
        setHasClosedAuthModal(false);
        return;
      }
      callback();
    },
    updateUserProfile: (profile: UserProfile) => {
      setUserProfile(profile);
    },
  }), [isSignedIn, userRole, currentUserId, canPost, unreadNotifCount, userProfile]);

  const mobileValue = useMemo(() => ({ isMobile }), [isMobile]);

  const pathname = usePathname();
  const isMessages = pathname === "/messages";
  const [domainChecked, setDomainChecked] = useState(false);
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [domainLoaderVisible, setDomainLoaderVisible] = useState(true);
  const [showCircleUpgrade, setShowCircleUpgrade] = useState(false);
  const [showCircleUpgradeSuccess, setShowCircleUpgradeSuccess] = useState(false);

  useEffect(() => {
    const handleUpgrade = () => setShowCircleUpgrade(true);
    window.addEventListener("albiz-circle-upgrade", handleUpgrade);
    return () => window.removeEventListener("albiz-circle-upgrade", handleUpgrade);
  }, []);

  useEffect(() => {
    const host = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    const isCustomDomainParam = urlParams.get("_customDomain") === "1";
    const allowedDomains = process.env.NEXT_PUBLIC_ALLOWED_DOMAINS?.split(",") || ["localhost", "localhost:3000", "albizmedia.com", "www.albizmedia.com"];
    // Also allow IP addresses (for Capacitor dev) and native apps
    const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    const isNativeApp = typeof (window as any).Capacitor !== 'undefined';
    const isCustom = (!allowedDomains.includes(host) && !allowedDomains.includes(window.location.host) && !host.endsWith(".vercel.app") && !isIP && !isNativeApp) || isCustomDomainParam;
    setIsCustomDomain(isSignedIn ? false : isCustom);
    setDomainChecked(true);
    if (!isCustom || isSignedIn) setDomainLoaderVisible(false);
  }, [isSignedIn]);

  // Fade out the loader once the profile content has had time to render
  useEffect(() => {
    if (!isCustomDomain || !domainChecked) return;
    const timer = setTimeout(() => setDomainLoaderVisible(false), 1200);
    return () => clearTimeout(timer);
  }, [isCustomDomain, domainChecked]);

  // Listen for user profile updates from settings page
  useEffect(() => {
    const handleUserUpdate = (event: CustomEvent) => {
      const { field, value } = event.detail;
      if (userProfile && (field === "name" || field === "handle")) {
        setUserProfile({ ...userProfile, [field]: value });
      }
    };

    const handleInterestsUpdated = () => {
      if (currentUserId && currentUserId > 0) {
        api.getFollowing(currentUserId).then(ids => setFollowing(new Set(ids))).catch(() => { });
      }
    };

    window.addEventListener("albiz-user-updated", handleUserUpdate as EventListener);
    window.addEventListener("albiz-interests-updated", handleInterestsUpdated as EventListener);
    return () => {
      window.removeEventListener("albiz-user-updated", handleUserUpdate as EventListener);
      window.removeEventListener("albiz-interests-updated", handleInterestsUpdated as EventListener);
    };
  }, [userProfile, currentUserId]);

  // Wrap setShowStoryCreator so opening it always increments the key (fresh state)
  const openStoryCreator = useCallback((open: boolean) => {
    if (open) setStoryCreatorKey(k => k + 1);
    setShowStoryCreator(open);
  }, []);

  const handleCircleUpgrade = async (formData: FormData) => {
    try {
      if (!currentUserId) {
        throw new Error('You must be logged in to submit a Circle upgrade request.');
      }

      formData.append('userId', currentUserId.toString());

      const response = await fetch('/api/circle-upgrade', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        const error: any = new Error(result.message || 'Failed to submit upgrade request');
        if (result.fieldErrors) {
          error.fieldErrors = result.fieldErrors;
        }
        throw error;
      }

      setShowCircleUpgrade(false);
      setShowCircleUpgradeSuccess(true);
    } catch (error) {
      console.error('Circle upgrade error:', error);
      throw error;
    }
  };

  const storyValue = useMemo(() => ({ hasActiveStory, setHasActiveStory, showStoryViewer, setShowStoryViewer, storyViewingUserId, setStoryViewingUserId, showStoryCreator, setShowStoryCreator: openStoryCreator, showCreatePost, setShowCreatePost, adStory, setAdStory }), [hasActiveStory, showStoryViewer, storyViewingUserId, showStoryCreator, openStoryCreator, showCreatePost, adStory]);
  const followingContextValue = useMemo(() => ({ following, toggleFollow }), [following, toggleFollow]);

  // Block all internal navigation on custom domain — only the profile page should be visible
  useEffect(() => {
    if (!isCustomDomain || isSignedIn) return;
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("http://") || href.startsWith("https://")) return;
      if (href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isCustomDomain]);

  // Before domain check completes, show the loader (prevents sidebar flash on web)
  if (!domainChecked && !isNative) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse">
          <AlbizLogo size={48} />
        </div>
      </div>
    );
  }

  if (isCustomDomain && !isSignedIn) {
    return (
      <SessionProvider>
        <AuthContext.Provider value={authValue}>
          <FollowingContext.Provider value={followingContextValue}>
            <MobileContext.Provider value={mobileValue}>
              <AuthSyncWrapper onInit={() => setAuthInitialized(true)}>
                <div className="h-screen bg-white overflow-y-auto relative">
                  {authInitialized ? children : null}
                  {/* Branded loading overlay */}
                  <div
                    className={`fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center transition-opacity duration-500 ${domainLoaderVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                  >
                    <div className="relative flex flex-col items-center gap-5">
                      <div className="relative">
                        <AlbizLogo size={52} />
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            animation: "domainLoaderPing 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                          }}
                        >
                          <AlbizLogo size={52} />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-[#F44444]"
                            style={{
                              animation: "domainLoaderDot 1s ease-in-out infinite",
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <style>{`
                @keyframes domainLoaderPing {
                  0% { opacity: 0.6; transform: scale(1); }
                  50% { opacity: 0; transform: scale(1.6); }
                  100% { opacity: 0; transform: scale(1.6); }
                }
                @keyframes domainLoaderDot {
                  0%, 100% { opacity: 0.3; transform: scale(0.8); }
                  50% { opacity: 1; transform: scale(1); }
                }
              `}</style>
                  </div>
                </div>
              </AuthSyncWrapper>
            </MobileContext.Provider>
          </FollowingContext.Provider>
        </AuthContext.Provider>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider>
      <AuthContext.Provider value={authValue}>
        <FollowingContext.Provider value={followingContextValue}>
          <MobileContext.Provider value={mobileValue}>
            <StoryContext.Provider value={storyValue}>
              <AuthSyncWrapper onInit={() => setAuthInitialized(true)}>
                <PushNotificationsSetup />
                <div
                  className={`fixed inset-0 bg-white flex flex-col overflow-hidden ${isMessages ? "" : "md:px-4 lg:px-8 xl:px-16"}`}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                >
                  <PushPromptBanner />
                  <MobileHeader onOpenDrawer={() => setIsMobileDrawerOpen(true)} />
                  {isCircle && !isMobileDrawerOpen && (
                    <button
                      onClick={() => setIsMobileDrawerOpen(true)}
                      className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-[45] bg-white/90 backdrop-blur-md shadow-[4px_0_12px_rgba(0,0,0,0.1)] border border-[#f0f0f0] border-l-0 rounded-r-xl py-3 px-1.5 flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <ChevronRight className="w-5 h-5 text-[#F44444]" />
                    </button>
                  )}
                  <div className={`mx-auto flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden w-full ${isMessages ? "" : "max-w-[1280px]"}`}>
                    <LeftSidebar setShowCircleUpgrade={setShowCircleUpgrade} />
                    <SwipeablePageContainer isCircle={isCircle} isSignedIn={isSignedIn} profileHref={userProfile?.handle ? `/${userProfile.handle}` : "/profile"}>
                      {authInitialized ? children : null}
                    </SwipeablePageContainer>
                  </div>
                  <MobileBottomNav />
                  <MobileDrawer isOpen={isMobileDrawerOpen} onClose={() => setIsMobileDrawerOpen(false)} />
                  {authModal?.mode === "signin" && <SignInModal onClose={() => { setAuthModal(null); setHasClosedAuthModal(true); }} onSwitch={() => setAuthModal({ mode: "signup", context: authModal.context })} onShowOnboard={() => setShowOnboard(true)} context={authModal.context} />}
                  {authModal?.mode === "signup" && <SignUpModal onClose={() => { setAuthModal(null); setHasClosedAuthModal(true); }} onSwitch={() => setAuthModal({ mode: "signin", context: authModal.context })} onShowOnboard={() => setShowOnboard(true)} context={authModal.context} />}
                  {showOnboard && <OnboardModal isOpen={showOnboard} onClose={() => { setShowOnboard(false); if (currentUserId > 0) localStorage.setItem(`albiz_onboarded_${currentUserId}`, '1'); }} />}
                  {showStoryViewer && <StoryViewer onClose={() => { setShowStoryViewer(false); setStoryViewingUserId(null); }} viewingUserId={storyViewingUserId} isAuthModalOpen={!!authModal} />}
                  {adStory && <AdStoryViewer ad={adStory} onClose={() => setAdStory(null)} />}
                  {showStoryCreator && <StoryCreator key={storyCreatorKey} onClose={() => setShowStoryCreator(false)} onPublish={() => { setHasActiveStory(true); }} />}
                  {showCreatePost && <CreatePostModal onClose={() => setShowCreatePost(false)} />}
                  {showCircleUpgrade && <CircleUpgradeForm onSubmit={handleCircleUpgrade} onClose={() => setShowCircleUpgrade(false)} />}
                  <OverlayAdManager />

                  {/* Circle Upgrade Success Modal */}
                  {showCircleUpgradeSuccess && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center">
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCircleUpgradeSuccess(false)} />
                      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
                        <div className="px-8 pt-8 pb-6 text-center">
                          <div className="w-16 h-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Upgrade Request Submitted!</h2>
                          <p className="text-sm text-[#737373] mb-6">
                            Your Circle upgrade request has been submitted successfully. You'll receive an email confirmation shortly.
                          </p>
                          <button
                            onClick={() => setShowCircleUpgradeSuccess(false)}
                            className="w-full py-2.5 rounded-xl bg-[#22c55e] text-white font-medium hover:bg-[#16a34a] transition-colors cursor-pointer"
                          >
                            Got it!
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <CircleWelcomeModal
                    isOpen={userRole === "CIRCLE" && userProfile?.circleWelcomeSeen === false}
                    onClose={() => {
                      if (userProfile) {
                        setUserProfile({ ...userProfile, circleWelcomeSeen: true });
                      }
                    }}
                  />
                </div>
              </AuthSyncWrapper>
            </StoryContext.Provider>
          </MobileContext.Provider>
        </FollowingContext.Provider>
      </AuthContext.Provider>
    </SessionProvider>
  );
}
