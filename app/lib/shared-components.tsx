"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Circle, Check, Bookmark, Search, FolderPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/app/lib/api";

export function SaveBookmarkButton({ postId, userId, initialSaved = false, canSave = true }: { postId: number; userId: number; initialSaved?: boolean; canSave?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [showPopup, setShowPopup] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSaved(initialSaved); }, [initialSaved]);

  useEffect(() => {
    if (!showPopup) return;
    const close = (e: MouseEvent) => { if (popupRef.current && !popupRef.current.contains(e.target as Node)) setShowPopup(false); };
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [showPopup]);

  const openPopup = () => {
    if (saved) {
      setSaved(false);
      if (canSave) api.unsavePost(userId, postId).catch(() => {});
      return;
    }
    if (!canSave) { setSaved(true); return; }
    api.getCollections(userId).then(setCollections).catch(() => {});
    setShowPopup(true);
  };

  const saveToCollection = (collectionId?: number) => {
    setSaved(true); setShowPopup(false);
    if (canSave) {
      api.savePost(userId, postId, collectionId).catch(() => { setSaved(false); });
    }
  };

  const createAndSave = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const col = await api.createCollection(userId, newName.trim());
      if (col.id) { setCollections(prev => [col, ...prev]); saveToCollection(col.id); }
    } catch {}
    setNewName(""); setCreating(false);
  };

  return (
    <div className="relative" ref={popupRef}>
      <button onClick={openPopup} className={`transition-colors ${saved ? "text-[#F44444]" : "text-[#737373] hover:text-[#525252]"}`}>
        <Bookmark className={`w-5 h-5 mt-2 ${saved ? "fill-[#F44444]" : ""}`} />
      </button>
      {showPopup && (
        <div className="absolute right-0 sm:right-0 bottom-8 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.14)] border border-[#e5e5e5] w-52 sm:w-60 z-30 overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Search */}
          {collections.length > 3 && (
            <div className="px-3 py-2 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-1.5 bg-[#f5f5f5] rounded-lg px-2 py-1">
                <Search className="w-3 h-3 text-[#a3a3a3]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search folders..." className="flex-1 text-xs outline-none bg-transparent text-[#0a0a0a] placeholder:text-[#c5c5c5]" autoFocus />
              </div>
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto">
            <button onClick={() => saveToCollection()} className="w-full text-left px-3 py-2.5 text-xs text-[#262626] hover:bg-[#fafafa] flex items-center gap-2 transition-colors border-b border-[#f0f0f0]">
              <Bookmark className="w-3.5 h-3.5 text-[#a3a3a3]" /> Quick Save
            </button>
            {collections.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).map(c => (
              <button key={c.id} onClick={() => saveToCollection(c.id)} className="w-full text-left px-3 py-2.5 text-xs text-[#262626] hover:bg-[#fafafa] flex items-center justify-between transition-colors">
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-[#a3a3a3] flex-shrink-0 ml-2">{c.count || 0}</span>
              </button>
            ))}
          </div>
          {/* Create new */}
          <div className="border-t border-[#f0f0f0] px-3 py-2">
            {showCreate ? (
              <div className="flex items-center gap-1.5">
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") createAndSave(); if (e.key === "Escape") setShowCreate(false); }} placeholder="Folder name..." className="flex-1 text-xs outline-none bg-transparent text-[#0a0a0a] placeholder:text-[#c5c5c5]" autoFocus />
                <button onClick={createAndSave} disabled={!newName.trim() || creating} className="text-[#F44444] disabled:text-[#d5d5d5] text-xs font-medium">{creating ? "..." : "Save"}</button>
              </div>
            ) : (
              <button onClick={() => setShowCreate(true)} className="w-full text-left text-xs text-[#F44444] font-medium flex items-center gap-1.5 hover:underline">
                <FolderPlus className="w-3.5 h-3.5" /> New folder
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AlbizLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * (104 / 121)} viewBox="0 0 121 104" fill="none">
      <path d="M71.9121 20.311L59.8833 0L9.15527e-05 103.861H23.2838L71.9121 20.311Z" fill="#FF4444" />
      <path d="M96.0998 62.0821L83.9408 41.9091L47.9848 103.861H71.9121L96.0998 62.0821Z" fill="#FF4444" />
      <path d="M120.15 103.861L108.381 83.2972L96.0998 103.861H120.15Z" fill="#FF4444" />
      <path d="M108.058 83.3157L96.1438 62.4531L84.0538 83.3157L96.1438 103.795L108.058 83.3157Z" fill="#AF1212" />
      <path d="M47.661 62.4531L60.0422 83.3157L47.661 103.795L35.7549 82.5496L47.661 62.4531Z" fill="#AF1212" />
    </svg>
  );
}

export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Circle className="w-3.5 h-3.5 fill-[#F44444] text-[#F44444]" />
      <Check className="w-2 h-2 text-white absolute" strokeWidth={3} />
    </span>
  );
}

export function Sparkline({ data, color = "#F44444", width = 80, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

export function SuggestedProfiles() {
  // Lazy import to avoid circular dependency
  const { useContext } = require("react");
  const { FollowingContext, AuthContext } = require("@/app/lib/contexts");
  const { users } = require("@/app/lib/data");

  const suggestions = users.slice(3, 8);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal } = useContext(AuthContext);

  const handleFollow = (userId: number) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(userId);
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[#0a0a0a]">Suggested Profiles</h2>
        <button className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors">View all</button>
      </div>
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {suggestions.map((user: any) => {
          const isFollowing = following.has(user.id);
          return (
            <div key={user.id} className="flex items-center gap-2.5 p-3">
              <Link href={`/${user.handle}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ${
                  user.hasStory ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" : "ring-1 ring-[#e5e5e5]"
                }`}>
                  <Image src={user.avatar} alt={user.name} width={44} height={44} className="object-cover w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm truncate text-[#0a0a0a]">{user.name}</span>
                    <VerifiedBadge className="scale-90" />
                  </div>
                  <span className="text-xs text-[#737373] truncate block">{user.title}</span>
                </div>
              </Link>
              <button
                onClick={() => handleFollow(user.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ease-out flex-shrink-0 ${
                  isFollowing
                    ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                    : "bg-[#F44444] text-white border border-transparent hover:bg-[#d64d3c]"
                } active:scale-95`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecentStories() {
  const { useContext, useCallback } = require("react");
  const { FollowingContext, AuthContext, StoryContext } = require("@/app/lib/contexts");
  const { users } = require("@/app/lib/data");

  const { setShowStoryViewer, setStoryViewingUserId, hasActiveStory } = useContext(StoryContext);
  const { following } = useContext(FollowingContext);
  const { currentUserId, userRole } = useContext(AuthContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dbStoryUserIds, setDbStoryUserIds] = useState<Set<number>>(new Set());

  const isCircleViewer = userRole === "CIRCLE" || userRole === "ADMIN";
  const currentUser = users.find((u: any) => u.id === currentUserId);

  // Fetch real stories from DB to know which users actually have stories
  useEffect(() => {
    api.getStories().then((data: any) => {
      const ids = new Set<number>();
      for (const su of (data.storyUsers || [])) {
        if (su.stories.length > 0) ids.add(su.user.id);
      }
      setDbStoryUserIds(ids);
    }).catch(() => {});
  }, [hasActiveStory]); // re-fetch when hasActiveStory changes (after posting/deleting)

  // Only show users who have real DB stories
  const storyUsers = users.filter((u: any) => {
    if (!dbStoryUserIds.has(u.id)) return false;
    if (u.id === currentUserId) return false;
    if (u.role === "CIRCLE" && !isCircleViewer) return false;
    return true;
  }).sort((a: any, b: any) => {
    const aFollowed = following.has(a.id) ? 1 : 0;
    const bFollowed = following.has(b.id) ? 1 : 0;
    return bFollowed - aFollowed;
  });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      const ro = new ResizeObserver(checkScroll);
      ro.observe(el);
      return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
    }
  }, [checkScroll, storyUsers.length]);

  if (!storyUsers.length && !hasActiveStory) {
    return (
      <div className="mb-4">
        <div className="flex items-center justify-center py-6 rounded-xl border border-dashed border-[#e5e5e5]">
          <span className="text-xs text-[#a3a3a3]">No stories right now</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Your Story — first item, only if you have active stories */}
          {currentUser && hasActiveStory && (
            <button
              onClick={() => { setStoryViewingUserId(currentUserId); setShowStoryViewer(true); }}
              className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
            >
              <div className="w-[50px] h-[50px] rounded-full p-[2.5px] bg-gradient-to-br from-[#F44444] to-[#F44444]/40">
                <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1.5px]">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    <Image src={currentUser.avatar} alt="Your story" width={48} height={48} className="object-cover w-full h-full" />
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-[#525252] truncate max-w-[48px]">You</span>
            </button>
          )}
          {storyUsers.map((user: any) => (
              <button
                key={user.id}
                onClick={() => { setStoryViewingUserId(user.id); setShowStoryViewer(true); }}
                className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <div className="w-[50px] h-[50px] rounded-full p-[2.5px] bg-gradient-to-br from-[#F44444] to-[#F44444]/40">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1.5px]">
                    <div className="w-full h-full rounded-full overflow-hidden">
                      <Image src={user.avatar} alt={user.name} width={48} height={48} className="object-cover w-full h-full" />
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-[#525252] truncate max-w-[48px]">{user.name.split(" ")[0]}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export function AdCard() {
  return (
    <div className="rounded-2xl overflow-hidden relative flex-1 min-h-[320px]">
      <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 rounded text-xs text-white z-10">Ad</div>
      <Image src="https://picsum.photos/seed/ad-startup/400/600" alt="Advertisement" width={400} height={600} className="object-cover w-full h-full" />
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16">
        <span className="text-white font-semibold text-lg">inito</span>
        <p className="text-sm text-white mt-1">At-home diagnostics startup Inito raises $29 million from BII, Fireside Ventures</p>
      </div>
    </div>
  );
}

export function RightSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
      <RecentStories />
      <SuggestedProfiles />
      <div className="flex-1 flex flex-col min-h-0">
        <AdCard />
      </div>
    </aside>
  );
}
