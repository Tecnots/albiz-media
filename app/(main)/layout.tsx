"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useContext, createContext } from "react";
import { createPortal } from "react-dom";
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Search, Users, Bell, Mail, Bookmark, BarChart3, Settings, User,
  Plus, PenLine, CircleDashed, Eye, EyeOff, X, ChevronLeft, ChevronRight, Heart, Send, MessageCircle,
  Bold, Italic, Link as LinkIcon, Link2, List, ListOrdered, Smile, MapPin, Hash, AtSign,
  Clock, ImagePlus, Menu as MenuIcon, Play, Loader2, FileText, Pencil, Trash2,
  Share2, TrendingUp, ChevronUp,
} from "lucide-react";
import { FollowingContext, CreatePostContext, CreateStoryContext, AuthContext, StoryContext, type UserRoleType, type UserProfile } from "@/app/lib/contexts";
import { CircleUpgradeFormData } from "@/types/circle-upgrade";
import { users, navItems } from "@/app/lib/data";
import { AlbizLogo, VerifiedBadge } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";
import OnboardModal from "@/app/components/OnboardModal";
import CircleUpgradeForm from "@/components/CircleUpgradeForm";

// Demo story data
// Story viewers — Circle users show profile, Normal users are anonymous
const storyViewers = [
  { id: 2, type: "CIRCLE" as const },
  { id: 3, type: "CIRCLE" as const },
  { id: 4, type: "CIRCLE" as const },
  { id: 7, type: "CIRCLE" as const },
  { id: 8, type: "CIRCLE" as const },
  { id: 0, type: "NORMAL" as const }, // anonymous
  { id: 0, type: "NORMAL" as const },
  { id: 0, type: "NORMAL" as const },
  { id: 0, type: "NORMAL" as const },
  { id: 0, type: "NORMAL" as const },
  { id: 0, type: "NORMAL" as const },
  { id: 0, type: "NORMAL" as const },
];

// Generate stories per user — each user gets unique story images based on their id
function generateUserStories(userId: number) {
  const count = 2 + (userId % 3); // 2-4 stories per user
  const times = ["1h ago", "2h ago", "4h ago", "8h ago"];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    image: `https://picsum.photos/seed/story-${userId}-${i}/400/700`,
    time: times[i % times.length],
    views: 50 + ((userId * 37 + i * 89) % 300),
    likes: 10 + ((userId * 23 + i * 47) % 80),
  }));
}

function StoryViewer({ onClose, viewingUserId }: { onClose: () => void; viewingUserId?: number | null }) {
  const { currentUserId, userRole } = useContext(AuthContext);
  const { following } = useContext(FollowingContext);
  const isCircleUser = userRole === "CIRCLE" || userRole === "ADMIN";

  // Fetch real stories from DB — no placeholders
  const [dbStories, setDbStories] = useState<Record<number, any[]>>({});
  const [dbUsers, setDbUsers] = useState<Record<number, any>>({});
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const refreshStories = () => {
    const targetUserId = viewingUserId || currentUserId;
    api.getStories(targetUserId).then((data: any) => {
      const map: Record<number, any[]> = {};
      const userMap: Record<number, any> = {};
      for (const su of (data.storyUsers || [])) {
        map[su.user.id] = su.stories;
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
  const [insightsTab, setInsightsTab] = useState<"viewers" | "activity">("viewers");
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");

  const storyOwnerId = storyUsersList[userIndex]?.id || currentUserId || 1;
  const storyOwner = dbUsers[storyOwnerId] || users.find(u => u.id === storyOwnerId) || users[0];

  // Map DB stories — ordered oldest first (API returns asc)
  const rawStories = dbStories[storyOwnerId] || [];
  const userStories = rawStories.map((s: any) => ({
    id: s.id,
    image: s.imageUrl,
    time: new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    views: s.views,
    likes: s.likes,
    dbId: s.id,
    textOverlay: s.textOverlay || null,
    textColor: s.textColor || "#ffffff",
    textPosX: s.textPosX ?? 50,
    textPosY: s.textPosY ?? 50,
    textScale: s.textScale ?? 1,
    location: s.location || null,
    locPosX: s.locPosX ?? 50,
    locPosY: s.locPosY ?? 20,
    imgPosX: s.imgPosX ?? 0,
    imgPosY: s.imgPosY ?? 0,
    imgScale: s.imgScale ?? 1,
    imgFit: s.imgFit || "contain",
  }));

  const isOwnStory = storyOwnerId === currentUserId;
  const story = userStories[current] || userStories[0];

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
    }).catch(() => {});
  };

  // Archive current story
  const handleArchiveStory = () => {
    if (!story?.dbId) return;
    api.updateStory(story.dbId, currentUserId, "archive").then(() => {
      refreshStories();
      if (current > 0) setCurrent(c => c - 1);
      else if (userStories.length <= 1) onClose();
      setShowInsights(false);
    }).catch(() => {});
  };

  // Generate per-story viewer data (deterministic based on story owner + story index)
  const seed = storyOwnerId * 1000 + current;
  const otherUsers = users.filter(u => u.id !== storyOwnerId);
  const circleUsers = otherUsers.filter(u => u.role === "CIRCLE" || u.role === "ADMIN" || u.role === "AUTHOR");
  const viewerCount = Math.min(circleUsers.length, 2 + (seed % 4));
  const storyCircleViewers = circleUsers.slice(0, viewerCount).map(u => ({
    ...u,
    likedStory: (u.id * 13 + seed) % 3 === 0,
    viewedAt: ["Just now", "2m ago", "15m ago", "1h ago", "3h ago"][(u.id + seed) % 5],
  }));
  const anonymousViewerCount = 3 + (seed % 15);
  const totalShares = (seed % 5);

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
    if (paused || showInsights) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (current < userStories.length - 1) {
            setCurrent(c => c + 1);
            return 0;
          } else {
            // Auto-advance to next user
            advanceToNextUser();
            return 0;
          }
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [current, paused, showInsights, userIndex, userStories.length]);

  const goNext = () => {
    if (current < userStories.length - 1) {
      setCurrent(c => c + 1);
      setProgress(0);
      setShowInsights(false);
    } else {
      advanceToNextUser();
    }
  };

  const goPrev = () => {
    if (current > 0) {
      setCurrent(c => c - 1);
      setProgress(0);
      setShowInsights(false);
    } else {
      retreatToPrevUser();
    }
  };

  const toggleLike = () => {
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
      api.storyAction(story.dbId, wasLiked ? "unlike" : "like", currentUserId).catch(() => {});
    }
  };

  const openInsights = () => {
    setPaused(true);
    setShowInsights(true);
    setInsightsTab("viewers");
  };

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  // Track views for real DB stories — skip own stories
  useEffect(() => {
    if (story?.dbId && !isOwnStory) {
      api.storyAction(story.dbId, "view", currentUserId).catch(() => {});
    }
  }, [current, userIndex]);

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
        <Link href={`/${storyOwner.handle}`} onClick={onClose} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/50">
            <Image src={storyOwner.avatar} alt={storyOwner.name} width={40} height={40} className="object-cover w-full h-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white text-sm font-semibold">{storyOwner.name}</span>
              {storyOwner.verified && <VerifiedBadge className="scale-75" />}
            </div>
            <span className="text-white/60 text-xs">{story.time}</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setPaused(p => !p)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            {paused ? (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            ) : (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            )}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Forward / Backward buttons — hidden on mobile, tap areas handle nav */}
      <button
        onClick={goPrev}
        disabled={current === 0}
        className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full items-center justify-center transition-all ${
          current === 0 ? "opacity-0 pointer-events-none" : "bg-white/15 hover:bg-white/25 backdrop-blur-sm"
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
              className="absolute z-10 px-2 max-w-[90%]"
              style={{
                left: `${story.textPosX ?? 50}%`,
                top: `${story.textPosY ?? 50}%`,
                transform: `translate(-50%, -50%) scale(${story.textScale ?? 1})`,
              }}
            >
              <p className="text-xl font-bold drop-shadow-lg text-center whitespace-nowrap" style={{ color: story.textColor || "#ffffff" }}>{story.textOverlay}</p>
            </div>
          )}

          {/* Location badge — at saved position */}
          {story.location && (
            <div
              className="absolute z-10 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1"
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
        </div>

        {/* Gradients — outside the keyed container so they don't flash */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Bottom section — different for own vs others */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
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
                  {storyCircleViewers.slice(0, 3).map(v => (
                    <div key={v.id} className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-black/80">
                      <Image src={v.avatar} alt={v.name} width={28} height={28} className="object-cover w-full h-full" />
                    </div>
                  ))}
                  {story.views > 3 && (
                    <div className="w-7 h-7 rounded-full bg-white/20 ring-2 ring-black/80 flex items-center justify-center">
                      <span className="text-[9px] text-white font-semibold">+{story.views - 3}</span>
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
                  /* Circle user — full reply input that sends to messages */
                  <div className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2.5 border border-white/20">
                    {replySent ? (
                      <span className="flex-1 text-sm text-white/70 text-center">Sent to {storyOwner.name.split(" ")[0]}</span>
                    ) : (
                      <>
                        <input
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder={`Reply to ${storyOwner.name.split(" ")[0]}...`}
                          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                          onFocus={() => setPaused(true)}
                          onBlur={() => { if (!replyText) setPaused(false); }}
                          onKeyDown={e => {
                            if (e.key === "Enter" && replyText.trim()) {
                              api.sendMessage(storyOwnerId, replyText.trim(), story.image).catch(() => {});
                              setReplyText(""); setReplySent(true); setPaused(false);
                              setTimeout(() => setReplySent(false), 2000);
                            }
                          }}
                        />
                        {replyText && (
                          <button onClick={() => {
                            api.sendMessage(storyOwnerId, replyText.trim(), story.image).catch(() => {});
                            setReplyText(""); setReplySent(true); setPaused(false);
                            setTimeout(() => setReplySent(false), 2000);
                          }} className="text-[#F44444] text-xs font-semibold">Send</button>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
                <button onClick={toggleLike} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Heart className={`w-6 h-6 ${liked.has(current) ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
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
                    <span className="text-xl font-bold text-white block">{story.views}</span>
                    <span className="text-[10px] text-white/40">Views</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <Heart className="w-4 h-4 text-white/50 mx-auto mb-1" />
                    <span className="text-xl font-bold text-white block">{story.likes}</span>
                    <span className="text-[10px] text-white/40">Likes</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <Share2 className="w-4 h-4 text-white/50 mx-auto mb-1" />
                    <span className="text-xl font-bold text-white block">{totalShares}</span>
                    <span className="text-[10px] text-white/40">Shares</span>
                  </div>
                </div>

                {/* Reach summary */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 mb-3">
                  <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-xs text-white/70">
                    <span className="text-[#22c55e] font-semibold">{storyCircleViewers.length} Circle members</span> and <span className="text-white/90 font-semibold">{anonymousViewerCount} others</span> reached
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
              </div>

              {/* Tab content */}
              <div className="overflow-y-auto max-h-[35vh]">
                {insightsTab === "viewers" ? (
                  <div className="px-2 py-2">
                    {/* Circle member viewers with profiles */}
                    {storyCircleViewers.map(viewer => (
                      <Link key={viewer.id} href={`/${viewer.handle}`} onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                        <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/20 flex-shrink-0">
                          <Image src={viewer.avatar} alt={viewer.name} width={40} height={40} className="object-cover w-full h-full" />
                        </div>
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

                    {/* Anonymous viewers */}
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
                  </div>
                ) : (
                  /* Activity tab — likes and shares breakdown */
                  <div className="px-4 py-3 space-y-4">
                    {/* Likes section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-3.5 h-3.5 text-[#F44444]" />
                        <span className="text-xs text-white/50 font-medium">{story.likes} likes</span>
                      </div>
                      <div className="space-y-1">
                        {storyCircleViewers.filter(v => v.likedStory).map(viewer => (
                          <Link key={viewer.id} href={`/${viewer.handle}`} onClick={onClose} className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity">
                            <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/20 flex-shrink-0">
                              <Image src={viewer.avatar} alt={viewer.name} width={32} height={32} className="object-cover w-full h-full" />
                            </div>
                            <span className="text-white text-xs font-medium truncate">{viewer.name}</span>
                            <Heart className="w-3 h-3 text-[#F44444] fill-[#F44444] ml-auto flex-shrink-0" />
                          </Link>
                        ))}
                        {story.likes > storyCircleViewers.filter(v => v.likedStory).length && (
                          <span className="text-white/30 text-[10px] block mt-1">+{story.likes - storyCircleViewers.filter(v => v.likedStory).length} from other viewers</span>
                        )}
                      </div>
                    </div>

                    {/* Shares section */}
                    {totalShares > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Share2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                          <span className="text-xs text-white/50 font-medium">{totalShares} shares</span>
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
                      <span className="text-lg font-bold text-white">{story.views > 0 ? Math.round((story.likes / story.views) * 100) : 0}%</span>
                      <span className="text-[10px] text-white/30 block">Based on likes / views</span>
                    </div>
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

  return (
    <div className="flex flex-col items-center space-y-2 mt-4 relative">
      {!collapsed && isCircle && (
        <button onClick={() => { setShowStoryCreator(true); }} className="hidden lg:block w-40 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Story</button>
      )}
      {collapsed ? (
        <>
          {showMenu && typeof document !== "undefined" && createPortal(
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
          )}
          <button
            ref={buttonRef}
            onClick={openMenu}
            className="w-10 h-10 rounded-full bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-all duration-300 flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </>
      ) : (
        <button onClick={() => setShowCreatePost(true)} className="w-10 h-10 lg:w-40 lg:h-auto lg:py-2 rounded-full bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-all duration-300 flex items-center justify-center cursor-pointer">
          <Plus className="w-5 h-5 lg:hidden" />
          <span className="hidden lg:block">Post</span>
        </button>
      )}
    </div>
  );
}

function LeftSidebar({ setShowCircleUpgrade }: { setShowCircleUpgrade: (show: boolean) => void }) {
  const pathname = usePathname();
  const { isSignedIn, userRole, canPost, openAuthModal, currentUserId, userProfile } = useContext(AuthContext);
  const { hasActiveStory, setShowStoryViewer, setStoryViewingUserId, setShowStoryCreator } = useContext(StoryContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const isAuthor = userRole === "AUTHOR";
  const canCreatePost = isCircle || canPost;
  const isNormal = userRole === "NORMAL";
  const collapsed = pathname === "/messages";

  const profileHandle = userProfile?.handle;
  const profileHref = profileHandle ? `/${profileHandle}` : "/profile";

  const navRoutes = navItems.map(item => ({
    ...item,
    href: item.label === "Profile" ? profileHref : item.href,
    active: item.label === "Profile"
      ? (profileHandle ? pathname === `/${profileHandle}` : pathname === "/profile")
      : (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)),
  }));

  return (
    <aside className={`hidden md:flex flex-col items-center px-2 py-4 border-r border-[#e5e5e5] overflow-y-auto flex-shrink-0 bg-white transition-all duration-300 ease-out ${
      collapsed ? "w-20" : "md:w-20 lg:w-72 lg:items-stretch lg:px-4"
    }`}>
      {isSignedIn && isCircle ? (
        <>
          <div className="flex flex-col items-center mb-4">
            <div className="relative mb-2">
              {hasActiveStory ? (
                <button onClick={() => { setStoryViewingUserId(currentUserId); setShowStoryViewer(true); }} className="cursor-pointer">
                  <div className={`story-ring-wrapper ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                    <div className="story-ring-gradient" />
                    <div className="story-ring-gap" />
                    <div className={`rounded-full overflow-hidden relative ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                      {userProfile?.avatar ? (
                        <Image src={userProfile.avatar} alt={userProfile.name} width={96} height={96} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><User className="w-8 h-8 text-[#a3a3a3]" /></div>
                      )}
                    </div>
                  </div>
                </button>
              ) : (
                <div className={`rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                  {userProfile?.avatar ? (
                    <Image src={userProfile.avatar} alt={userProfile.name} width={96} height={96} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><User className="w-8 h-8 text-[#a3a3a3]" /></div>
                  )}
                </div>
              )}
              {!collapsed && (
                <div className="hidden lg:flex absolute bottom-0 right-0 gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowStoryCreator(true); }}
                    className="w-6 h-6 rounded-full bg-[#F44444] items-center justify-center z-10 hover:bg-[#d64d3c] transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); document.getElementById("avatar-upload-circle")?.click(); }}
                    className="w-6 h-6 rounded-full bg-[#525252] items-center justify-center z-10 hover:bg-[#404040] transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
              <input
                id="avatar-upload-circle"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const uploadRes = await api.uploadAvatar(file);
                    if (uploadRes.url) {
                      await api.updateAvatar(uploadRes.url);
                      window.location.reload();
                    }
                  } catch (err) {
                    console.error("Upload failed:", err);
                  }
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
              <div className={`w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 ${collapsed ? "" : "lg:w-24 lg:h-24"}`}>
                {userProfile?.avatar ? (
                  <Image src={userProfile.avatar} alt={userProfile.name} width={96} height={96} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><User className="w-8 h-8 text-[#a3a3a3]" /></div>
                )}
              </div>
              <button
                onClick={() => document.getElementById("avatar-upload")?.click()}
                className={`absolute bottom-0 right-0 w-6 h-6 lg:w-8 lg:h-8 bg-[#F44444] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#d64d3c] transition-colors ${collapsed ? "w-5 h-5" : ""}`}
              >
                <ImagePlus className={`w-3 h-3 lg:w-4 lg:h-4 ${collapsed ? "w-2.5 h-2.5" : ""}`} />
              </button>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const uploadRes = await api.uploadAvatar(file);
                    if (uploadRes.url) {
                      await api.updateAvatar(uploadRes.url);
                      window.location.reload();
                    }
                  } catch (err) {
                    console.error("Upload failed:", err);
                  }
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
          if (!isCircle && (item.label === "Messages" || item.label === "Profile" || item.label === "Analytics" || item.label === "Notifications")) return null;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`w-10 flex items-center justify-center gap-3 p-2 rounded-full transition-all duration-200 ${
                collapsed ? "" : "lg:w-40 lg:justify-start lg:px-4 lg:py-2"
              } ${item.active ? "bg-[#f0f0f0] text-[#0a0a0a]" : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="hidden lg:block font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {canCreatePost && (
        <CreateButtons collapsed={collapsed} />
      )}

      {isAuthor && !canCreatePost && !collapsed && (
        <div className="hidden lg:block mt-2">
          <Link href="/admin/news" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F44444]/10 text-[#F44444] text-sm font-medium hover:bg-[#F44444]/20 transition-colors cursor-pointer">
            <PenLine className="w-4 h-4 flex-shrink-0" />
            Write Article
          </Link>
        </div>
      )}

      <div className="flex-1" />
      <div className="flex justify-center flex-shrink-0">
        <AlbizLogo size={40} />
      </div>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="md:hidden flex-shrink-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#f0f0f0] px-4 h-11 relative flex items-center justify-between">
      <div className="z-10">
        <AlbizLogo size={24} />
      </div>
      <div className="flex items-center gap-0.5 z-10">
        <Link href="/notifications" className="p-2 hover:bg-[#f5f5f5] rounded-full"><Bell className="w-[18px] h-[18px] text-[#525252]" /></Link>
        <Link href="/settings" className="p-2 hover:bg-[#f5f5f5] rounded-full"><Settings className="w-[18px] h-[18px] text-[#525252]" /></Link>
      </div>
    </header>
  );
}

function MobileMenuCreateButtons({ onClose }: { onClose: () => void }) {
  const { setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  const { userRole } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  return (
    <div className="p-3 border-t border-[#e5e5e5] flex gap-2">
      {isCircle && (
        <button onClick={() => { onClose(); setShowStoryCreator(true); }} className="flex-1 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Story</button>
      )}
      <button onClick={() => { onClose(); setShowCreatePost(true); }} className={`flex-1 py-2 rounded-full bg-[#F44444] text-white font-medium text-sm hover:bg-[#d64d3c] transition-colors cursor-pointer ${isCircle ? "" : "w-full"}`}>Post</button>
    </div>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { userRole, isSignedIn, openAuthModal, currentUserId, userProfile } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  const profileHref = userProfile?.handle ? `/${userProfile.handle}` : "/profile";

  const menuNavItems = navItems
    .filter(item => {
      if (!isCircle && (item.label === "Messages" || item.label === "Profile" || item.label === "Analytics" || item.label === "Notifications")) return false;
      return true;
    })
    .map(item => ({
      ...item,
      href: item.label === "Profile" ? profileHref : item.href,
    }));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Dropdown Menu */}
      <div
        className={`md:hidden fixed left-4 top-[52px] z-50 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden transition-all duration-200 origin-top-left ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* User Profile Section */}
        <div className="p-4 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              {userProfile?.avatar ? (
                <Image src={userProfile.avatar} alt={userProfile.name} width={48} height={48} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><User className="w-6 h-6 text-[#a3a3a3]" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{userProfile?.name || "User"}</span>
                {userProfile?.verified && <VerifiedBadge />}
              </div>
              {userProfile?.title && <span className="text-[#737373] text-xs truncate block">{userProfile.title}</span>}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 max-h-[280px] overflow-y-auto">
          {menuNavItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive ? "bg-[#f5f5f5] text-[#0a0a0a]" : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign in / Action buttons */}
        {!isSignedIn ? (
          <div className="p-3 border-t border-[#e5e5e5] flex gap-2">
            <button onClick={() => { onClose(); openAuthModal("signin"); }} className="flex-1 py-2 rounded-full bg-[#F44444] text-white font-medium text-sm hover:bg-[#d64d3c] transition-colors cursor-pointer">Sign in</button>
            <button onClick={() => { onClose(); openAuthModal("signup"); }} className="flex-1 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Sign up</button>
          </div>
        ) : isCircle ? (
          <MobileMenuCreateButtons onClose={onClose} />
        ) : null}
      </div>
    </>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const { userRole, isSignedIn, currentUserId, userProfile } = useContext(AuthContext);
  const { hasActiveStory, setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileHref = userProfile?.handle ? `/${userProfile.handle}` : "/profile";
  const profileActive = userProfile?.handle ? pathname === `/${userProfile.handle}` : false;

  // Close menus on outside tap
  useEffect(() => {
    if (!showCreateMenu && !showProfileMenu) return;
    function handleTap(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (showCreateMenu && menuRef.current && !menuRef.current.contains(target)) setShowCreateMenu(false);
      if (showProfileMenu && profileMenuRef.current && !profileMenuRef.current.contains(target)) setShowProfileMenu(false);
    }
    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap);
    return () => { document.removeEventListener("mousedown", handleTap); document.removeEventListener("touchstart", handleTap); };
  }, [showCreateMenu, showProfileMenu]);

  // Long-press handlers for profile
  const handleProfileTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowProfileMenu(true);
      longPressTimer.current = null;
    }, 400);
  };
  const handleProfileTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Long-press profile menu — only Settings/Analytics (everything else is in the nav now)
  const profileMenuItems = isCircle ? [
    { icon: Bookmark, label: "Saved", href: "/saved" },
    { icon: BarChart3, label: "Analytics", href: "/analytics" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ] : [
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  const iconSize = isCircle ? "w-[19px] h-[19px]" : "w-[21px] h-[21px]";
  const navLink = (href: string, icon: any, active: boolean) => (
    <Link href={href} className={`w-8 h-8 flex items-center justify-center transition-colors ${active ? "text-[#0a0a0a]" : "text-[#a3a3a3]"}`}>
      {icon}
    </Link>
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#f0f0f0] z-40">
      <div className="flex items-center justify-around px-2 pt-1.5 pb-1.5 pb-safe relative">
        {/* Feed */}
        {navLink("/", <Activity className={iconSize} strokeWidth={pathname === "/" ? 2 : 1.5} />, pathname === "/")}

        {/* Explore */}
        {navLink("/explore", <Search className={iconSize} strokeWidth={pathname.startsWith("/explore") ? 2 : 1.5} />, pathname.startsWith("/explore"))}

        {/* Circle */}
        {navLink("/circle", <Users className={iconSize} strokeWidth={pathname.startsWith("/circle") ? 2 : 1.5} />, pathname.startsWith("/circle"))}

        {/* Create — Circle only */}
        {isCircle && (
          <div className="relative flex items-center justify-center" ref={menuRef}>
            {showCreateMenu && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[130px] z-50">
                <button
                  onClick={() => { setShowCreateMenu(false); setShowCreatePost(true); }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  <PenLine className="w-4 h-4 text-[#737373]" />
                  <span className="text-[13px] font-medium">Post</span>
                </button>
                <div className="h-px bg-[#f0f0f0]" />
                <button
                  onClick={() => { setShowCreateMenu(false); setShowStoryCreator(true); }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  <CircleDashed className="w-4 h-4 text-[#737373]" />
                  <span className="text-[13px] font-medium">Story</span>
                </button>
              </div>
            )}
            <button
              onClick={() => setShowCreateMenu(prev => !prev)}
              className="w-9 h-9 flex items-center justify-center active:scale-95 transition-transform text-[#F44444]"
            >
              <Plus className="w-[21px] h-[21px]" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Shorts */}
        {navLink("/shorts", <Play className={iconSize} strokeWidth={pathname.startsWith("/shorts") ? 2 : 1.5} />, pathname.startsWith("/shorts"))}

        {/* Messages (Circle) or Saved (Normal) */}
        {isCircle ? (
          navLink("/messages", <Mail className={iconSize} strokeWidth={pathname.startsWith("/messages") ? 2 : 1.5} />, pathname.startsWith("/messages"))
        ) : (
          navLink("/saved", <Bookmark className={iconSize} strokeWidth={pathname.startsWith("/saved") ? 2 : 1.5} />, pathname.startsWith("/saved"))
        )}

        {/* Profile — Circle users see active ring, Normal users see basic avatar */}
        <Link href={profileHref} className="w-8 h-8 flex items-center justify-center">
          {hasActiveStory && isSignedIn ? (
            <div className="w-[22px] h-[22px] rounded-full p-[1.5px] bg-gradient-to-br from-[#F44444] to-[#FF8A8A]">
              <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1px]">
                <div className="w-full h-full rounded-full overflow-hidden">
                  {userProfile?.avatar ? <Image src={userProfile.avatar} alt="Profile" width={22} height={22} className="object-cover w-full h-full" /> : <User className="w-4 h-4 text-[#a3a3a3]" />}
                </div>
              </div>
            </div>
          ) : (
            <div className={`w-[22px] h-[22px] rounded-full overflow-hidden ${isCircle && profileActive ? "ring-[1.5px] ring-[#0a0a0a]" : "ring-[1px] ring-[#d5d5d5]"}`}>
              {userProfile?.avatar ? <Image src={userProfile.avatar} alt="Profile" width={22} height={22} className="object-cover w-full h-full" /> : <User className="w-4 h-4 text-[#a3a3a3]" />}
            </div>
          )}
        </Link>

      </div>
    </nav>
  );
}

function SignInModal({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"form" | "forgot" | "forgot-sent">("form");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

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
        setError(data.error || "Something went wrong");
        return;
      }

      // Create NextAuth session
      const result = await nextAuthSignIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.ok) {
        onClose();
      } else {
        setError("Sign in failed — try again");
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">

        {view === "form" && (
          <>
            <div className="px-8 pt-8 pb-6">
              <div className="flex justify-center mb-6"><AlbizLogo size={48} /></div>
              <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Welcome back</h2>
              <p className="text-sm text-[#737373] text-center mb-6">Sign in to your Albiz account</p>
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
              <button type="button" onClick={() => nextAuthSignIn("google", { callbackUrl: "/" })} className="w-full py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors cursor-pointer flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </div>
            <div className="px-8 py-4 bg-[#fafafa] border-t border-[#e5e5e5] text-center">
              <span className="text-sm text-[#737373]">Don&apos;t have an account? </span>
              <button onClick={onSwitch} className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] cursor-pointer">Sign up</button>
            </div>
          </>
        )}

        {view === "forgot" && (
          <div className="px-8 pt-8 pb-8">
            <button type="button" onClick={() => setView("form")} className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#0a0a0a] mb-6 transition-colors cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="flex justify-center mb-6"><AlbizLogo size={40} /></div>
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
          <div className="px-8 pt-8 pb-8 text-center">
            <div className="flex justify-center mb-6"><AlbizLogo size={40} /></div>
            <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Check your email</h2>
            <p className="text-sm text-[#737373] mb-6">If an account exists for <span className="text-[#0a0a0a] font-medium">{forgotEmail || email}</span>, you&apos;ll receive a password reset link shortly.</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#0a0a0a] text-white font-medium hover:bg-[#262626] transition-colors cursor-pointer">Done</button>
          </div>
        )}

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
      </div>
    </div>
  );
}

function SignUpModal({ onClose, onSwitch, onShowOnboard }: { onClose: () => void; onSwitch: () => void; onShowOnboard: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError("");
    try {
      // Use the signup endpoint
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

      // Auto sign-in after creation
      const result = await nextAuthSignIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.ok) {
        onClose();
        // Show onboarding modal for new users
        if (data.created) {
          onShowOnboard();
        }
      } else {
        setError("Account created but sign-in failed — try signing in");
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">

        <div className="px-8 pt-8 pb-6">
          <div className="flex justify-center mb-6"><AlbizLogo size={48} /></div>
          <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Create your account</h2>
          <p className="text-sm text-[#737373] text-center mb-6">Join the Albiz community</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Full name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => { setName(e.target.value); setError(""); }} 
                placeholder="Your name" 
                disabled={accountCreated}
                className={`w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                  accountCreated ? "border-[#e5e5e5] opacity-50 cursor-not-allowed" : "border-[#e5e5e5]"
                }`} 
                autoFocus={!accountCreated} 
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => { setEmail(e.target.value); setError(""); }} 
                placeholder="you@example.com" 
                disabled={accountCreated}
                className={`w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                  accountCreated ? "border-[#e5e5e5] opacity-50 cursor-not-allowed" : "border-[#e5e5e5]"
                }`} 
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
                  disabled={accountCreated}
                  className={`w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all pr-10 ${
                    accountCreated ? "border-[#e5e5e5] opacity-50 cursor-not-allowed" : "border-[#e5e5e5]"
                  }`} 
                />
                {!accountCreated && (
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
            {error && <p className={`text-xs text-center ${accountCreated ? "text-[#22c55e]" : "text-[#F44444]"}`}>{error}</p>}
            <button 
              type="submit" 
              disabled={loading || accountCreated} 
              className={`w-full py-2.5 rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${
                accountCreated 
                  ? "bg-[#22c55e] text-white" 
                  : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {accountCreated ? "Account Created!" : "Create account"}
            </button>
          </form>
          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-[#e5e5e5]"></div>
            <span className="px-3 text-xs text-[#a3a3a3] font-medium">OR</span>
            <div className="flex-1 h-px bg-[#e5e5e5]"></div>
          </div>
          <button 
            type="button" 
            onClick={() => nextAuthSignIn("google", { callbackUrl: "/" })} 
            disabled={accountCreated}
            className={`w-full py-2.5 rounded-xl border font-medium transition-colors flex items-center justify-center gap-2 ${
              accountCreated 
                ? "border-[#e5e5e5] bg-[#f5f5f5] text-[#a3a3a3] cursor-not-allowed" 
                : "border-[#e5e5e5] bg-white text-[#0a0a0a] hover:bg-[#fafafa] cursor-pointer"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>
        <div className="px-8 py-4 bg-[#fafafa] border-t border-[#e5e5e5] text-center">
          {accountCreated ? (
            <span className="text-sm text-[#22c55e] font-medium">Check your email to verify your account</span>
          ) : (
            <>
              <span className="text-sm text-[#737373]">Already have an account? </span>
              <button onClick={onSwitch} className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] cursor-pointer">Sign in</button>
            </>
          )}
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
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
  const [elementPositions, setElementPositions] = useState<Record<string, { x: number; y: number; scale: number }>>({
    text: { x: 50, y: 85, scale: 1 }, poll: { x: 50, y: 30, scale: 1 }, question: { x: 50, y: 30, scale: 1 },
    location: { x: 20, y: 75, scale: 1 }, hashtag: { x: 80, y: 70, scale: 1 }, time: { x: 85, y: 8, scale: 1 },
    mention: { x: 50, y: 50, scale: 1 }, link: { x: 50, y: 60, scale: 1 }, music: { x: 15, y: 90, scale: 1 },
  });
  const [dragging, setDragging] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  const toggleSticker = (sticker: string) => {
    setActiveStickers(prev => prev.includes(sticker) ? prev.filter(s => s !== sticker) : [...prev, sticker]);
  };

  const handleDragStart = (elementId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); setDragging(elementId); setSelectedElement(elementId);
  };
  const handleDrag = (e: React.MouseEvent | React.TouchEvent, containerRef: HTMLDivElement | null) => {
    if (!dragging || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    setElementPositions(prev => ({ ...prev, [dragging]: { ...prev[dragging], x, y } }));
  };
  const handleDragEnd = () => setDragging(null);
  const adjustScale = (elementId: string, delta: number) => {
    setElementPositions(prev => ({ ...prev, [elementId]: { ...prev[elementId], scale: Math.max(0.5, Math.min(2, (prev[elementId]?.scale || 1) + delta)) } }));
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
    try {
      for (const file of Array.from(files)) {
        const result = await api.uploadFile(file, currentUserId, "stories");
        setUploadedMedia(prev => [...prev, result.url]);
      }
    } catch (err) {
      console.error("Story upload failed:", err);
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
    }).catch(() => {});
  };
  useEffect(() => { refreshDrafts(); }, [currentUserId]);

  // Load a draft into the editor
  const handleEditDraft = (draft: any) => {
    setEditingDraftId(draft.id);
    setUploadedMedia([draft.imageUrl]);
    setTextOverlay(draft.textOverlay || "");
    setTextColor(draft.textColor || "#ffffff");
    setStoryLocation(draft.location || "");
    setImgPos({ x: draft.imgPosX ?? 0, y: draft.imgPosY ?? 0, scale: draft.imgScale ?? 1 });
    setImgFit(draft.imgFit || "contain");
    setVisibility(draft.visibility === "circle" ? "circle" : "public");
    // Restore element positions from draft
    setElementPositions(prev => ({
      ...prev,
      text: { x: draft.textPosX ?? 50, y: draft.textPosY ?? 50, scale: draft.textScale ?? 1 },
      location: { x: draft.locPosX ?? 50, y: draft.locPosY ?? 20, scale: 1 },
    }));
    setShowDrafts(false);
  };

  // Save as new draft or update existing draft
  const handleSaveDraft = async () => {
    if (!uploadedMedia.length || savingDraft) return;
    setSavingDraft(true);
    try {
      if (editingDraftId) {
        // Delete old draft and create updated one
        await api.deleteStory(editingDraftId, currentUserId);
      }
      for (const imageUrl of uploadedMedia) {
        await api.createStory(currentUserId, imageUrl, {
          textOverlay: textOverlay || undefined,
          textColor: textColor || undefined,
          textPosX: elementPositions.text?.x ?? 50,
          textPosY: elementPositions.text?.y ?? 50,
          textScale: elementPositions.text?.scale ?? 1,
          location: storyLocation || undefined,
          locPosX: elementPositions.location?.x ?? 50,
          locPosY: elementPositions.location?.y ?? 20,
          imgPosX: imgPos.x,
          imgPosY: imgPos.y,
          imgScale: imgPos.scale,
          imgFit,
          visibility,
          status: "draft",
        });
      }
      onClose();
    } catch {}
    setSavingDraft(false);
  };

  // Publish: if editing a draft, delete the draft first then publish
  const handlePublishDraft = async (draft: any) => {
    handleEditDraft(draft);
  };

  // Delete a draft
  const handleDeleteDraft = async (draftId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteStory(draftId, currentUserId).catch(() => {});
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    if (editingDraftId === draftId) setEditingDraftId(null);
  };

  const handlePostStory = async () => {
    if (!uploadedMedia.length || posting) return;
    setPosting(true);
    try {
      // If publishing an edited draft, delete the draft first
      if (editingDraftId) {
        await api.deleteStory(editingDraftId, currentUserId).catch(() => {});
      }
      for (const imageUrl of uploadedMedia) {
        await api.createStory(currentUserId, imageUrl, {
          textOverlay: textOverlay || undefined,
          textColor: textColor || undefined,
          textPosX: elementPositions.text?.x ?? 50,
          textPosY: elementPositions.text?.y ?? 50,
          textScale: elementPositions.text?.scale ?? 1,
          location: storyLocation || undefined,
          locPosX: elementPositions.location?.x ?? 50,
          locPosY: elementPositions.location?.y ?? 20,
          imgPosX: imgPos.x,
          imgPosY: imgPos.y,
          imgScale: imgPos.scale,
          imgFit,
          visibility,
        });
      }
      onPublish();
      onClose();
    } catch (err) {
      console.error("Story post failed:", err);
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
    if (!ref || dragging) return;
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

  const suggestedLocations = ["San Francisco, CA", "New York, NY", "London, UK", "Bangalore, India", "Mumbai, India", "Dubai, UAE", "Singapore", "Tokyo, Japan"];

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  const stickerEl = (id: string, content: React.ReactNode, className: string) => {
    if (!activeStickers.includes(id)) return null;
    const pos = elementPositions[id];
    return (
      <div
        className={`absolute z-20 cursor-move transition-shadow ${selectedElement === id ? "ring-2 ring-[#F44444] shadow-lg" : ""} ${className}`}
        style={{ left: `${pos?.x || 50}%`, top: `${pos?.y || 50}%`, transform: `translate(-50%, -50%) scale(${pos?.scale || 1})` }}
        onMouseDown={(e) => { e.stopPropagation(); handleDragStart(id, e); }}
        onTouchStart={(e) => { e.stopPropagation(); handleDragStart(id, e); }}
        onClick={(e) => e.stopPropagation()}
      >{content}</div>
    );
  };

  const [activePanel, setActivePanel] = useState<"text" | "stickers" | "location" | null>(null);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col md:flex-row md:items-center md:justify-center md:bg-black/40 md:backdrop-blur-sm md:p-4">
      <input ref={storyFileRef} type="file" accept="image/*" multiple onChange={handleStoryFileSelect} className="hidden" />

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
          className="flex-1 relative select-none overflow-hidden"
          onMouseMove={(e) => { handleDrag(e, e.currentTarget); handleImgDragMove(e); }}
          onMouseUp={() => { handleDragEnd(); handleImgDragEnd(); }}
          onMouseLeave={() => { handleDragEnd(); handleImgDragEnd(); }}
          onTouchMove={(e) => { handleDrag(e, e.currentTarget); handleImgDragMove(e); }}
          onTouchEnd={() => { handleDragEnd(); handleImgDragEnd(); }}
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
          {stickerEl("poll", <><p className="text-xs font-medium text-[#0a0a0a] mb-1.5">What do you think?</p><div className="space-y-1"><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs">Option 1</div><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs">Option 2</div></div></>, "bg-white/90 backdrop-blur-sm rounded-xl p-2")}
          {stickerEl("question", <><p className="text-xs font-medium text-[#0a0a0a] mb-1.5">Ask me anything</p><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs text-[#737373]">Type your question...</div></>, "bg-white/90 backdrop-blur-sm rounded-xl p-2")}
          {storyLocation && <div className="absolute z-20 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" style={{ left: `${elementPositions.location?.x || 20}%`, top: `${elementPositions.location?.y || 75}%`, transform: "translate(-50%, -50%)" }}><MapPin className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium">{storyLocation}</span></div>}
          {stickerEl("time", <span className="text-white text-xs font-medium">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>, "bg-black/50 backdrop-blur-sm rounded-full px-2 py-1")}
          {stickerEl("hashtag", <span className="text-white text-xs font-medium">#trending</span>, "bg-[#F44444] rounded-full px-2 py-1")}
          {stickerEl("mention", <span className="text-xs font-medium text-[#0a0a0a]">@username</span>, "bg-white/90 backdrop-blur-sm rounded-full px-2 py-1")}
          {stickerEl("link", <><Link2 className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium text-[#0a0a0a]">Link</span></>, "bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1")}
          {stickerEl("music", <><Activity className="w-3 h-3 text-white" /><span className="text-xs font-medium text-white">Song Name</span></>, "bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1")}

          {textOverlay && (
            <div
              className={`absolute z-20 cursor-move px-2 py-1 rounded ${selectedElement === "text" ? "ring-2 ring-white/50 bg-black/20" : ""}`}
              style={{ left: `${elementPositions.text?.x || 50}%`, top: `${elementPositions.text?.y || 50}%`, transform: `translate(-50%, -50%) scale(${elementPositions.text?.scale || 1})`, textAlign: textStyle.align }}
              onMouseDown={(e) => { e.stopPropagation(); handleDragStart("text", e); }}
              onTouchStart={(e) => { e.stopPropagation(); handleDragStart("text", e); }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className={`text-lg drop-shadow-lg ${textStyle.bold ? "font-bold" : "font-medium"} ${textStyle.italic ? "italic" : ""}`} style={{ color: textColor }}>{textOverlay}</p>
            </div>
          )}

          {selectedElement && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-30">
              <button onClick={(e) => { e.stopPropagation(); adjustScale(selectedElement, -0.1); }} className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/20 rounded-full"><span className="text-lg font-bold">−</span></button>
              <span className="text-white text-xs font-medium w-10 text-center">{Math.round((elementPositions[selectedElement]?.scale || 1) * 100)}%</span>
              <button onClick={(e) => { e.stopPropagation(); adjustScale(selectedElement, 0.1); }} className="w-7 h-7 flex items-center justify-center text-white hover:bg-white/20 rounded-full"><span className="text-lg font-bold">+</span></button>
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
              {textColors.map(color => (
                <button key={color} onClick={() => setTextColor(color)} className={`w-7 h-7 rounded-full border-2 ${textColor === color ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: color }} />
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
              onChange={(e) => setStoryLocation(e.target.value)}
              placeholder="Type a location..."
              autoFocus
              className="w-full bg-white/10 text-white text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-white/40 mb-3"
            />
            <div className="flex flex-wrap gap-1.5">
              {suggestedLocations.filter(l => !storyLocation || l.toLowerCase().includes(storyLocation.toLowerCase())).map(loc => (
                <button key={loc} onClick={() => { setStoryLocation(loc); setActivePanel(null); }} className="px-2.5 py-1.5 rounded-full bg-white/10 text-white/80 text-xs hover:bg-white/20 transition-colors">
                  {loc}
                </button>
              ))}
            </div>
            {storyLocation && (
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => setActivePanel(null)} className="flex-1 py-2 rounded-full bg-[#F44444] text-white text-xs font-medium">Done</button>
                <button onClick={() => { setStoryLocation(""); }} className="px-3 py-2 rounded-full bg-white/10 text-white/70 text-xs">Clear</button>
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

        {/* Location badge on canvas */}
        {storyLocation && !activePanel && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
            <MapPin className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-medium">{storyLocation}</span>
          </div>
        )}

        {/* Bottom bar */}
        {!activePanel && (
          <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-safe pt-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)", background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}>
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
                    {savingDraft ? "Saving..." : "Save Draft"}
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
              className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black select-none cursor-grab active:cursor-grabbing"
              onMouseMove={(e) => { handleDrag(e, e.currentTarget); handleImgDragMove(e); }}
              onMouseUp={() => { handleDragEnd(); handleImgDragEnd(); }}
              onMouseLeave={() => { handleDragEnd(); handleImgDragEnd(); }}
              onMouseDown={uploadedMedia.length > 0 ? handleImgDragStart : undefined}
              onWheel={handleImgWheel}
              onClick={() => setSelectedElement(null)}
            >
              {uploadedMedia.length > 0 ? (
                <Image src={uploadedMedia[0]} alt="Story background" fill unoptimized className={`${imgFit === "contain" ? "object-contain" : "object-cover"} pointer-events-none`} style={{ transform: `translate(${imgPos.x}px, ${imgPos.y}px) scale(${imgPos.scale})` }} />
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-[#667eea] via-[#64b3f4] to-[#f093fb]" />
                  <button onClick={() => storyFileRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 cursor-pointer">
                    {uploading ? <Loader2 className="w-8 h-8 text-white/70 animate-spin" /> : <><ImagePlus className="w-8 h-8 text-white/70" /><span className="text-white/70 text-xs font-medium">Click to add photo</span></>}
                  </button>
                </>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/50">{userProfile?.avatar ? <Image src={userProfile.avatar} alt="" width={32} height={32} className="object-cover w-full h-full" /> : <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><User className="w-4 h-4 text-[#a3a3a3]" /></div>}</div>
                <div><div className="flex items-center gap-0.5"><span className="text-white text-xs font-semibold drop-shadow-md">{userProfile?.name || "You"}</span>{userProfile?.verified && <VerifiedBadge className="scale-50" />}</div></div>
              </div>
              {stickerEl("poll", <><p className="text-xs font-medium text-[#0a0a0a] mb-1.5">What do you think?</p><div className="space-y-1"><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs">Option 1</div><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs">Option 2</div></div></>, "bg-white/90 backdrop-blur-sm rounded-xl p-2")}
              {stickerEl("question", <><p className="text-xs font-medium text-[#0a0a0a] mb-1.5">Ask me anything</p><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs text-[#737373]">Type your question...</div></>, "bg-white/90 backdrop-blur-sm rounded-xl p-2")}
              {storyLocation && <div className="absolute z-20 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1" style={{ left: `${elementPositions.location?.x || 20}%`, top: `${elementPositions.location?.y || 75}%`, transform: "translate(-50%, -50%)" }}><MapPin className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium">{storyLocation}</span></div>}
              {stickerEl("time", <span className="text-white text-xs font-medium">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>, "bg-black/50 backdrop-blur-sm rounded-full px-2 py-1")}
              {stickerEl("hashtag", <span className="text-white text-xs font-medium">#trending</span>, "bg-[#F44444] rounded-full px-2 py-1")}
              {stickerEl("mention", <span className="text-xs font-medium text-[#0a0a0a]">@username</span>, "bg-white/90 backdrop-blur-sm rounded-full px-2 py-1")}
              {stickerEl("link", <><Link2 className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium text-[#0a0a0a]">Link</span></>, "bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1")}
              {stickerEl("music", <><Activity className="w-3 h-3 text-white" /><span className="text-xs font-medium text-white">Song Name</span></>, "bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1")}
              {textOverlay && (
                <div className={`absolute z-20 cursor-move px-1.5 py-0.5 rounded ${selectedElement === "text" ? "ring-2 ring-white/50 bg-black/20" : ""}`} style={{ left: `${elementPositions.text?.x || 50}%`, top: `${elementPositions.text?.y || 85}%`, transform: `translate(-50%, -50%) scale(${elementPositions.text?.scale || 1})`, textAlign: textStyle.align }} onMouseDown={(e) => { e.stopPropagation(); handleDragStart("text", e); }} onClick={(e) => e.stopPropagation()}>
                  <p className={`text-sm drop-shadow-lg whitespace-nowrap ${textStyle.bold ? "font-bold" : "font-medium"} ${textStyle.italic ? "italic" : ""}`} style={{ color: textColor }}>{textOverlay}</p>
                </div>
              )}
              {selectedElement && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-30">
                  <button onClick={(e) => { e.stopPropagation(); adjustScale(selectedElement, -0.1); }} className="w-6 h-6 flex items-center justify-center text-white hover:bg-white/20 rounded-full"><span className="text-lg font-bold">−</span></button>
                  <span className="text-white text-xs font-medium w-10 text-center">{Math.round((elementPositions[selectedElement]?.scale || 1) * 100)}%</span>
                  <button onClick={(e) => { e.stopPropagation(); adjustScale(selectedElement, 0.1); }} className="w-6 h-6 flex items-center justify-center text-white hover:bg-white/20 rounded-full"><span className="text-lg font-bold">+</span></button>
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
            </div>
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Text Overlay</h3>
              <div className="flex items-center gap-1 mb-3">
                <button onClick={() => setTextStyle(s => ({ ...s, bold: !s.bold }))} className={`p-2 rounded-lg ${textStyle.bold ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><Bold className="w-4 h-4" /></button>
                <button onClick={() => setTextStyle(s => ({ ...s, italic: !s.italic }))} className={`p-2 rounded-lg ${textStyle.italic ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><Italic className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
                {textColors.map(color => (
                  <button key={color} onClick={() => setTextColor(color)} className={`w-6 h-6 rounded-full border-2 ${textColor === color ? "border-[#F44444] scale-110" : "border-transparent"}`} style={{ backgroundColor: color, boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #e5e5e5" : undefined }} />
                ))}
              </div>
              <textarea value={textOverlay} onChange={(e) => setTextOverlay(e.target.value)} placeholder="Add text to your story..." className="w-full bg-[#f8f9fa] rounded-xl p-4 text-sm resize-none outline-none min-h-[80px]" />
            </div>
            {/* Location */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Location</h3>
              <input
                type="text"
                value={storyLocation}
                onChange={(e) => setStoryLocation(e.target.value)}
                placeholder="Add a location..."
                className="w-full bg-[#f8f9fa] rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#a3a3a3] mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {suggestedLocations.filter(l => !storyLocation || l.toLowerCase().includes(storyLocation.toLowerCase())).slice(0, 6).map(loc => (
                  <button key={loc} onClick={() => setStoryLocation(loc)} className={`px-2.5 py-1 rounded-full text-xs transition-colors ${storyLocation === loc ? "bg-[#F44444] text-white" : "bg-[#f8f9fa] text-[#525252] hover:bg-[#f0f0f0]"}`}>
                    {loc}
                  </button>
                ))}
              </div>
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
            <button onClick={() => { refreshDrafts(); setShowDrafts(v => !v); }} className={`px-4 py-2 text-sm font-medium rounded-full cursor-pointer transition-colors ${drafts.length > 0 ? "text-[#F44444] border border-[#F44444]/30 hover:bg-[#FFF5F5]" : "text-[#a3a3a3] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>
              Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] cursor-pointer">Cancel</button>
            {uploadedMedia.length > 0 && (
              <button onClick={handleSaveDraft} disabled={savingDraft} className="px-4 py-2 text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
                {savingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {savingDraft ? "Saving..." : "Save Draft"}
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

function CreatePostModal({ onClose }: { onClose: () => void }) {
  const { currentUserId, userProfile } = useContext(AuthContext);
  const [postContent, setPostContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "circle">("public");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
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

  // Sync contentEditable text to state
  const handleEditorInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText || "";
    if (text.length > maxChars) {
      el.innerText = text.slice(0, maxChars);
      // Move cursor to end
      const sel = window.getSelection();
      if (sel) { sel.selectAllChildren(el); sel.collapseToEnd(); }
    }
    setPostContent(el.innerHTML);
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

  const suggestedLocations = [
    "San Francisco, CA", "New York, NY", "London, UK", "Bangalore, India",
    "Mumbai, India", "Dubai, UAE", "Singapore", "Tokyo, Japan",
    "Berlin, Germany", "Austin, TX", "Seattle, WA", "Toronto, Canada",
    "Paris, France", "Sydney, Australia", "Los Angeles, CA", "Boston, MA",
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
    setUploading(true);
    try {
      const remaining = maxFiles - uploadedImages.length;
      const toUpload = Array.from(files).slice(0, remaining);
      const urls: string[] = [];
      for (const file of toUpload) {
        const isVideo = file.type.startsWith("video/");
        const result = await api.uploadFile(file, currentUserId, isVideo ? "videos" : "posts");
        urls.push(result.url);
      }
      setUploadedImages(prev => [...prev, ...urls]);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          tags: [],
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
        });
      }
    } catch {}
    onClose();
  };

  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch(`/api/posts?status=drafts&userId=${currentUserId}`);
      if (res.ok) setDrafts(await res.json());
    } catch {}
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
    await api.deletePost(draftId).catch(() => {});
    setDrafts(prev => prev.filter(d => d.id !== draftId));
  };

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

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
              {userProfile?.avatar ? <Image src={userProfile.avatar} alt={userProfile.name} width={48} height={48} className="object-cover w-full h-full" /> : <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><User className="w-6 h-6 text-[#a3a3a3]" /></div>}
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
              data-placeholder="What's on your mind?"
              className="w-full bg-transparent text-[#262626] text-sm md:text-base outline-none min-h-[80px] md:min-h-[100px] empty:before:content-[attr(data-placeholder)] empty:before:text-[#c5c5c5] empty:before:pointer-events-none [&_b]:font-bold [&_i]:italic [&_a]:text-[#F44444] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            />
          </div>
        </div>

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
          {uploadedImages.length > 0 && <p className="text-[10px] md:text-xs text-[#737373] mt-2">{uploadedImages.length}/{maxFiles} files added</p>}
        </div>

        {/* Action Icons */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Upload Image">
              <ImagePlus className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => insertTextAtCursor(" ")} className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Emoji">
              <Smile className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => setShowLocationInput(!showLocationInput)} className={`p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors ${location || showLocationInput ? "text-[#F44444]" : "text-[#737373]"}`} title="Location">
              <MapPin className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => insertTextAtCursor("#")} className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Hashtag">
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
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <button onClick={() => setVisibility("public")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${visibility === "public" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Public</button>
            <button onClick={() => setVisibility("circle")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${visibility === "circle" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Circle only</button>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2 md:gap-3">
            <span className="text-xs md:text-sm text-[#737373]">{(editorRef.current?.innerText || "").length}/{maxChars}</span>
            <button onClick={handleSaveDraft} className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors cursor-pointer">Save draft</button>
            <button onClick={handlePost} disabled={posting} className="px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
              {posting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthSyncWrapper({ children }: { children: React.ReactNode }) {
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
        };
        signIn(u.role, u.id, u.canPost, profile);
      }
    } else if (status === "unauthenticated") {
      signOut();
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

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRoleType>(null);
  const [currentUserId, setCurrentUserId] = useState(0);
  const [canPost, setCanPost] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [authModal, setAuthModal] = useState<"signin" | "signup" | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [following, setFollowing] = useState<Set<number>>(new Set([2, 3]));

  // Load follows from DB on mount
  useEffect(() => {
    if (isSignedIn && currentUserId > 0) {
      api.getFollowing(currentUserId).then(ids => setFollowing(new Set(ids))).catch(() => {});
    }
  }, []);

  // Visit beacon — fires once per page load
  useEffect(() => {
    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: window.location.pathname, referrer: document.referrer || null }),
    }).catch(() => {});
  }, []);
  const [hasActiveStory, setHasActiveStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewingUserId, setStoryViewingUserId] = useState<number | null>(null);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [storyCreatorKey, setStoryCreatorKey] = useState(0);
  const [showCreatePost, setShowCreatePost] = useState(false);

  // Sync hasActiveStory with real DB stories
  useEffect(() => {
    if (!isSignedIn || !currentUserId) return;
    api.getStories(currentUserId).then((data: any) => {
      const count = (data.storyUsers || []).reduce((sum: number, su: any) => sum + su.stories.length, 0);
      setHasActiveStory(count > 0);
    }).catch(() => {});
  }, [currentUserId, isSignedIn, showStoryCreator, showStoryViewer]);

  const toggleFollow = (userId: number) => {
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        api.unfollow(currentUserId, userId).catch(() => {});
      } else {
        next.add(userId);
        api.follow(currentUserId, userId).catch(() => {});
      }
      return next;
    });
  };

  const authValue = {
    isSignedIn,
    userRole,
    currentUserId,
    canPost,
    signOut: () => { setIsSignedIn(false); setUserRole(null); setCurrentUserId(0); setCanPost(false); setUserProfile(null); setFollowing(new Set()); nextAuthSignOut({ redirect: false }); },
    signIn: (role: UserRoleType = "CIRCLE", userId: number = 1, userCanPost = true, profile: UserProfile = null) => {
      setIsSignedIn(true); setUserRole(role); setCurrentUserId(userId);
      setCanPost(role === "CIRCLE" || role === "ADMIN" ? true : userCanPost);
      if (profile) setUserProfile(profile);
      api.getFollowing(userId).then(ids => setFollowing(new Set(ids))).catch(() => setFollowing(new Set([2, 3])));
    },
    userProfile,
    openAuthModal: (mode: "signin" | "signup") => setAuthModal(mode),
  };

  const pathname = usePathname();
  const isMessages = pathname === "/messages";
  const [domainChecked, setDomainChecked] = useState(false);
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [domainLoaderVisible, setDomainLoaderVisible] = useState(true);
  const [showCircleUpgrade, setShowCircleUpgrade] = useState(false);
  const [showCircleUpgradeSuccess, setShowCircleUpgradeSuccess] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    const isCustom = host !== "localhost" && host !== "albizmedia.com" && host !== "www.albizmedia.com";
    setIsCustomDomain(isCustom);
    setDomainChecked(true);
    if (!isCustom) setDomainLoaderVisible(false);
  }, []);

  // Fade out the loader once the profile content has had time to render
  useEffect(() => {
    if (!isCustomDomain || !domainChecked) return;
    const timer = setTimeout(() => setDomainLoaderVisible(false), 1200);
    return () => clearTimeout(timer);
  }, [isCustomDomain, domainChecked]);

  // Wrap setShowStoryCreator so opening it always increments the key (fresh state)
  const openStoryCreator = (open: boolean) => {
    if (open) setStoryCreatorKey(k => k + 1);
    setShowStoryCreator(open);
  };

  const handleCircleUpgrade = async (formData: CircleUpgradeFormData) => {
    try {
      // Create FormData for file upload
      const submitData = new FormData();
      
      // Add basic fields
      submitData.append('fullName', formData.fullName);
      submitData.append('professionalTitle', formData.professionalTitle);
      submitData.append('location', formData.location);
      submitData.append('reason', formData.reason);
      
      // Add optional fields
      if (formData.company) submitData.append('company', formData.company);
      if (formData.website) submitData.append('website', formData.website);
      if (formData.linkedin) submitData.append('linkedin', formData.linkedin);
      if (formData.bio) submitData.append('bio', formData.bio);
      
      // Add user info
      submitData.append('userId', currentUserId?.toString() || '');
      
      // Add verification fields based on account type
      submitData.append('accountType', formData.verification.accountType);
      
      if (formData.verification.accountType === 'individual') {
        submitData.append('idType', formData.verification.idType);
        submitData.append('idNumber', formData.verification.idNumber);
        if (formData.verification.idDocument) {
          submitData.append('idDocument', formData.verification.idDocument);
        }
      } else {
        submitData.append('registrationType', formData.verification.registrationType);
        submitData.append('registrationNumber', formData.verification.registrationNumber);
        if (formData.verification.verificationDocument) {
          submitData.append('verificationDocument', formData.verification.verificationDocument);
        }
      }
      
      const response = await fetch('/api/circle-upgrade', {
        method: 'POST',
        body: submitData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit upgrade request');
      }
      
      // Show success message and close modal
      setShowCircleUpgrade(false);
      setShowCircleUpgradeSuccess(true);
    } catch (error) {
      console.error('Circle upgrade error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit upgrade request');
    }
  };

  const storyValue = { hasActiveStory, setHasActiveStory, showStoryViewer, setShowStoryViewer, storyViewingUserId, setStoryViewingUserId, showStoryCreator, setShowStoryCreator: openStoryCreator, showCreatePost, setShowCreatePost };

  // Block all internal navigation on custom domain — only the profile page should be visible
  useEffect(() => {
    if (!isCustomDomain) return;
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

  // Before domain check completes, show the loader (prevents sidebar flash)
  if (!domainChecked) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse">
          <AlbizLogo size={48} />
        </div>
      </div>
    );
  }

  if (isCustomDomain) {
    return (
      <SessionProvider>
      <AuthContext.Provider value={authValue}>
        <FollowingContext.Provider value={{ following, toggleFollow }}>
          <AuthSyncWrapper>
          <div className="h-screen bg-white overflow-y-auto relative">
            {children}
            {/* Branded loading overlay */}
            <div
              className={`fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center transition-opacity duration-500 ${
                domainLoaderVisible ? "opacity-100" : "opacity-0 pointer-events-none"
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
        </FollowingContext.Provider>
      </AuthContext.Provider>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider>
    <AuthContext.Provider value={authValue}>
      <FollowingContext.Provider value={{ following, toggleFollow }}>
        <StoryContext.Provider value={storyValue}>
          <AuthSyncWrapper>
          <div className={`h-screen pb-12 md:pb-0 bg-white flex flex-col overflow-hidden ${isMessages ? "" : "md:px-4 lg:px-8 xl:px-16"}`}>
            <MobileHeader />
            <div className={`mx-auto flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden w-full ${isMessages ? "" : "max-w-[1280px]"}`}>
              <LeftSidebar setShowCircleUpgrade={setShowCircleUpgrade} />
              {children}
            </div>
            <MobileBottomNav />
            {authModal === "signin" && <SignInModal onClose={() => setAuthModal(null)} onSwitch={() => setAuthModal("signup")} />}
            {authModal === "signup" && <SignUpModal onClose={() => setAuthModal(null)} onSwitch={() => setAuthModal("signin")} onShowOnboard={() => setShowOnboard(true)} />}
            {showOnboard && <OnboardModal isOpen={showOnboard} onClose={() => setShowOnboard(false)} />}
            {showStoryViewer && <StoryViewer onClose={() => { setShowStoryViewer(false); setStoryViewingUserId(null); }} viewingUserId={storyViewingUserId} />}
            {showStoryCreator && <StoryCreator key={storyCreatorKey} onClose={() => setShowStoryCreator(false)} onPublish={() => { setHasActiveStory(true); api.getStories(currentUserId).then((d: any) => { setHasActiveStory((d.storyUsers || []).some((su: any) => su.stories.length > 0)); }).catch(() => {}); }} />}
            {showCreatePost && <CreatePostModal onClose={() => setShowCreatePost(false)} />}
            {showCircleUpgrade && <CircleUpgradeForm onSubmit={handleCircleUpgrade} />}
            
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
          </div>
          </AuthSyncWrapper>
        </StoryContext.Provider>
      </FollowingContext.Provider>
    </AuthContext.Provider>
    </SessionProvider>
  );
}
