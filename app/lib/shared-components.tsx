"use client";



import Image from "next/image";

import Link from "next/link";

import { useState, useEffect, useRef, useContext, useCallback } from "react";

import { usePathname } from "next/navigation";

import { FollowingContext, AuthContext, StoryContext } from "@/app/lib/contexts";

import { users, quickSnapshot } from "@/app/lib/data";

import { Circle, Check, Bookmark, Search, FolderPlus, ChevronLeft, ChevronRight, Plus, User } from "lucide-react";

import { api } from "@/app/lib/api";
import { isNative } from "@/app/lib/capacitor";
import { Toast } from "@capacitor/toast";



export function isValidSrc(src: any): boolean {
  if (!src) return false;
  if (typeof src === "string" && src.trim() === "") return false;
  if (typeof src === "object" && !src.src) return false;
  return true;
}

export function ReadButton({ onRead, postId }: { onRead: (postId: number) => void; postId: number }) {

  const handleReadClick = (e: React.MouseEvent) => {

    e.stopPropagation(); // Prevent card click

    // Allow all users to read without authentication

    onRead(postId);

  };



  return (

    <span

      onClick={handleReadClick}

      className="px-3 py-1 bg-[#F44444] text-white text-xs font-medium rounded-full cursor-pointer hover:bg-[#d64d3c] transition-colors"

    >

      Read

    </span>

  );

}



export function SaveBookmarkButton({ postId, initialSaved = false, savedPostIds, onSaveChange, popupPosition = "bottom", showLabel = false }: { postId: number; initialSaved?: boolean; savedPostIds?: Set<number>; onSaveChange?: (postId: number, isSaved: boolean) => void; popupPosition?: "top" | "bottom"; showLabel?: boolean }) {
  const { currentUserId, openAuthModal } = useContext(AuthContext);


  // Call ALL hooks before any conditional logic to follow Rules of Hooks

  const [saved, setSaved] = useState(initialSaved);

  const [showPopup, setShowPopup] = useState(false);

  const [collections, setCollections] = useState<any[]>([]);

  const [newName, setNewName] = useState("");

  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");

  const popupRef = useRef<HTMLDivElement>(null);

  const [showCreate, setShowCreate] = useState(false);


  useEffect(() => {

    // Determine initial saved state

    const isInitiallySaved = savedPostIds ? savedPostIds.has(postId) : initialSaved;

    setSaved(isInitiallySaved);

  }, [initialSaved, savedPostIds, postId]);


  useEffect(() => {

    if (!showPopup) return;

    const close = (e: MouseEvent) => {

      // Don't close if clicking inside the popup

      if (popupRef.current && popupRef.current.contains(e.target as Node)) return;

      // Don't close if we're in the middle of creating a folder

      if (showCreate) return;

      setShowPopup(false);

    };

    setTimeout(() => document.addEventListener("click", close), 100);

    return () => document.removeEventListener("click", close);

  }, [showPopup, showCreate]);


  const openPopup = () => {

    // Check if user is authenticated

    if (!currentUserId) {

      openAuthModal("signup", "Create an account to save posts");

      return;

    }



    if (saved) {

      setSaved(false);

      onSaveChange?.(postId, false);

      api.unsavePost(postId).then((response) => {

        // Notify other components that data has been unsaved

        window.dispatchEvent(new Event("albiz-post-saved"));
        if (isNative) {
          Toast.show({ text: "Post removed from saved" });
        }
      }).catch((error) => {

        // Handle error silently

      });

      return;

    }

    api.getCollections().then(response => {

      if (response.success && Array.isArray(response.collections)) {

        setCollections(response.collections);

      } else {

        setCollections([]);

      }

    }).catch((error) => {

      // If we get a 401 error, it means authentication failed

      if (error.message && error.message.includes("401")) {

        // Open auth modal for user to sign in

        openAuthModal("signin");

        setShowPopup(false);

      }

      setCollections([]);

    });

    setShowPopup(true);

  };



  const saveToCollection = (collectionId?: number) => {

    setSaved(true);

    setShowPopup(false);

    onSaveChange?.(postId, true);

    api.savePost(postId, collectionId).then((response) => {

      // Notify other components that data has been saved

      window.dispatchEvent(new Event("albiz-post-saved"));
      if (isNative) {
        Toast.show({ text: "Post saved" });
      }
    }).catch((error) => {

      // If we get a 401 error, it means authentication failed

      if (error.message && error.message.includes("401")) {

        // Open auth modal for user to sign in

        openAuthModal("signin");

        // Revert the saved state

        setSaved(false);

        onSaveChange?.(postId, false);

      } else if (error.message && error.message.includes("Post already saved")) {

        // Post is already saved - this is fine, just show it as saved

        // Don't revert the saved state, keep it as saved

        window.dispatchEvent(new Event("albiz-post-saved"));

      } else {

        // Other errors - revert the saved state

        setSaved(false);

        onSaveChange?.(postId, false);

      }

    });

  };



  const createCollection = async () => {
    console.log("SaveBookmarkButton - createCollection called:", { newName });
    setCreating(true);
    try {
      const response = await api.createCollection(newName);
      console.log("SaveBookmarkButton - createCollection response:", response);
      if (response && response.success && response.collection) {
        setCollections(prev => [...prev, response.collection]);
        setNewName("");
        setShowCreate(false);
      } else {
        console.error("SaveBookmarkButton - Failed to create collection:", response?.error || "Unknown error");
      }
    } catch (error) {
      console.error("SaveBookmarkButton - Failed to create collection:", error);
    } finally {
      setCreating(false);
    }
  };



  const createAndSave = async (): Promise<void> => {

    if (!newName.trim()) return;



    setCreating(true);

    try {

      // First create the collection

      const response = await api.createCollection(newName);



      if (response.success && response.collection) {

        // Then save the post to the new collection

        const newCollectionId = response.collection.id;



        const saveResponse = await api.savePost(postId, newCollectionId);



        // Update UI state

        setCollections(prev => [...prev, response.collection]);

        setSaved(true);

        setShowPopup(false);

        setShowCreate(false);

        setNewName("");

        onSaveChange?.(postId, true);



        // Notify other components

        window.dispatchEvent(new Event("albiz-post-saved"));
        if (isNative) {
          Toast.show({ text: "Post saved" });
        }
      }

    } catch (error) {

      console.error("Failed to create and save:", error);

    } finally {

      setCreating(false);

    }

  };



  return (

    <div className="relative" ref={popupRef}>

      <button onClick={openPopup} className={showLabel ? `flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors ${saved ? "text-[#F44444]" : ""}` : `transition-all p-2 rounded-lg ${saved ? "text-[#F44444] bg-[#FFF5F5]" : "text-[#737373] hover:text-[#525252] hover:bg-[#f5f5f5]"}`}>
        <Bookmark className={showLabel ? `w-5 h-5 ${saved ? "fill-current" : ""}` : `w-4 h-4 ${saved ? "fill-[#F44444]" : ""}`} />
        {showLabel && <span className="text-sm font-medium">{saved ? "Saved" : "Save"}</span>}
      </button>



      {showPopup && (

        <div

          className={`absolute right-0 sm:right-0 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.14)] border border-[#e5e5e5] w-52 sm:w-60 z-30 overflow-hidden ${popupPosition === "top" ? "top-full mt-2" : "bottom-8"}`}

          onClick={e => e.stopPropagation()}

        >

          {!currentUserId ? (

            <div className="p-4 flex flex-col items-center text-center gap-3">

              <Bookmark className="w-8 h-8 text-[#F44444] bg-[#FFF5F5] p-1.5 rounded-full" />

              <p className="text-xs text-[#262626] font-medium leading-normal">

                To get this feature, sign up for an account.

              </p>

              <button

                onClick={() => {

                  setShowPopup(false);

                  openAuthModal("signup");

                }}

                className="w-full py-2 rounded-lg bg-[#F44444] text-white text-xs font-semibold hover:bg-[#d64d3c] transition-colors cursor-pointer"

              >

                Sign up

              </button>

            </div>

          ) : (

            <>

              {/* Search */}

              {collections.length > 3 && (

                <div className="px-3 py-2 border-b border-[#f0f0f0]">

                  <div className="flex items-center gap-1.5 bg-[#f5f5f5] rounded-lg px-2 py-1">

                    <Search className="w-3 h-3 text-[#a3a3a3]" />

                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search folders..." className="flex-1 text-xs outline-none bg-transparent text-[#0a0a0a] placeholder:text-[#c5c5c5]" autoFocus />

                  </div>

                </div>

              )}



              <div

                className="max-h-[200px] bookmark-scrollbar"

                style={{

                  overflowY: 'scroll',

                  overflowX: 'hidden',

                  maxHeight: '200px',

                  scrollbarWidth: 'thin',

                  scrollbarColor: '#d5d5d5 #f5f5f5'

                }}

              >

                <button onClick={() => saveToCollection()} className="w-full text-left px-3 py-2.5 text-xs text-[#262626] hover:bg-[#fafafa] flex items-center gap-2 transition-colors border-b border-[#f0f0f0] sticky top-0 bg-white z-10">

                  <Bookmark className="w-3.5 h-3.5 text-[#a3a3a3]" /> Quick Save

                </button>



                {collections.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).map(c => (

                  <button key={c.id} onClick={() => saveToCollection(c.id)} className="w-full text-left px-3 py-2.5 text-xs text-[#262626] hover:bg-[#fafafa] flex items-center justify-between transition-colors border-b border-[#f5f5f5] last:border-b-0">

                    <span className="truncate">{c.name}</span>

                    <span className="text-[10px] text-[#a3a3a3] flex-shrink-0 ml-2">{c.count || 0}</span>

                  </button>

                ))}



                {collections.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (

                  <div className="text-center py-4 text-xs text-[#a3a3a3]">

                    No folders found

                  </div>

                )}

              </div>



              {/* Create new */}

              <div className="border-t border-[#f0f0f0] px-3 py-2">

                {showCreate ? (

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>

                    <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") createAndSave(); if (e.key === "Escape") setShowCreate(false); }} placeholder="Folder name..." className="flex-1 text-xs outline-none bg-transparent text-[#0a0a0a] placeholder:text-[#c5c5c5]" autoFocus />

                    <button onClick={(e) => { e.stopPropagation(); createAndSave(); }} disabled={!newName.trim() || creating} className="text-[#F44444] disabled:text-[#d5d5d5] text-xs font-medium">{creating ? "..." : "Save"}</button>

                  </div>

                ) : (

                  <button onClick={(e) => { e.stopPropagation(); setShowCreate(true); }} className="w-full text-left text-xs text-[#F44444] font-medium flex items-center gap-1.5 hover:underline">

                    <FolderPlus className="w-3.5 h-3.5" /> New folder

                  </button>

                )}

              </div>

            </>

          )}

        </div>

      )}

    </div>

  );

}



export function AlbizLogo({ size = 40 }: { size?: number }) {

  return (

    <svg width={size} height={size} viewBox="-30 -30 181 164" fill="none" xmlns="http://www.w3.org/2000/svg">

      <path d="M71.9121 20.311L59.8833 0L9.15527e-05 103.861H23.2838L71.9121 20.311Z" fill="#FF4444" />

      <path d="M96.0998 62.0821L83.9408 41.9091L47.9848 103.861H71.9121L96.0998 62.0821Z" fill="#FF4444" />

      <path d="M120.15 103.861L108.381 83.2972L96.0998 103.861H120.15Z" fill="#FF4444" />

      <path d="M108.058 83.3157L96.1438 62.4531L84.0538 83.3157L96.1438 103.795L108.058 83.3157Z" fill="#AF1212" />

      <path d="M47.661 62.4531L60.0422 83.3157L47.661 103.795L35.7549 82.5496L47.661 62.4531Z" fill="#AF1212" />

    </svg>

  );

}



export function VerifiedBadge({ className = "", isBlue = false }: { className?: string; isBlue?: boolean }) {
  const color = isBlue ? "#3B82F6" : "#F44444";
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Circle className={`w-3.5 h-3.5 fill-[${color}] text-[${color}]`} style={{ fill: color, color: color }} />
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



export function SuggestedProfiles({ pathname: propPathname }: { pathname?: string } = {}) {
  const hookPathname = usePathname();
  const pathname = propPathname || hookPathname;

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal } = useContext(AuthContext);

  useEffect(() => {
    setLoading(true);
    fetch("/api/users/suggested?limit=20")
      .then(r => r.json())
      .then(data => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleFollow = (userId: number) => {
    if (!isSignedIn) { openAuthModal("signup", "Join Albiz to follow"); return; }
    toggleFollow(userId);
    setTimeout(() => setHiddenIds(prev => new Set([...prev, userId])), 800);
  };

  const visible = suggestions.filter(u => !hiddenIds.has(u.id) && !following.has(u.id)).slice(0, 5);

  if (!loading && visible.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Suggested Profiles</span>
        <Link href="/explore" className="text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors">View all</Link>
      </div>

      <div className="space-y-0.5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-[#ebebeb] flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-3 w-24 bg-[#ebebeb] rounded" />
                <div className="h-2.5 w-32 bg-[#ebebeb] rounded" />
              </div>
              <div className="h-7 w-14 bg-[#ebebeb] rounded-full flex-shrink-0" />
            </div>
          ))
        ) : (
          visible.map(user => {
            const isFollowing = following.has(user.id);
            return (
              <div key={user.id} className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-[#fafafa] transition-colors -mx-1 px-1">
                <Link
                  href={`/${user.handle}?from=${encodeURIComponent(pathname || '/')}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ${user.hasStory ? "ring-2 ring-[#F44444] ring-offset-1 ring-offset-white" : "ring-1 ring-[#e5e5e5]"
                    }`}>

                    {user.avatar && isValidSrc(user.avatar) ? (

                      <Image src={user.avatar} alt={user.name} width={44} height={44} className="object-cover w-full h-full" />

                    ) : (

                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">

                        <User className="w-5 h-5 text-gray-400" />

                      </div>

                    )}

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

                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ease-out flex-shrink-0 ${isFollowing

                    ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"

                    : "bg-[#F44444] text-white border border-transparent hover:bg-[#d64d3c]"

                    } active:scale-95`}

                >

                  {isFollowing ? "Following" : "Follow"}

                </button>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function RecentStories() {



  const { setShowStoryViewer, setStoryViewingUserId, hasActiveStory, setShowStoryCreator } = useContext(StoryContext);
  const { following } = useContext(FollowingContext);
  const { currentUserId, userRole, userProfile } = useContext(AuthContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dbStoryUsers, setDbStoryUsers] = useState<any[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  // Handle mouse wheel horizontal scrolling
  const handleWheel = (e: React.WheelEvent) => {
    if (!isHovering) return;

    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    // Always prevent default and stop propagation when hovering
    e.preventDefault();
    e.stopPropagation();

    if (e.deltaY !== 0) {
      console.log('Stories wheel event, deltaY:', e.deltaY, 'current scrollLeft:', scrollContainer.scrollLeft);

      // Only horizontal scrolling
      scrollContainer.scrollLeft += e.deltaY * 2;
    }

    return false;
  };

  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const currentUser = userProfile || users.find((u: any) => u.id === currentUserId);

  const [loading, setLoading] = useState(true);

  // Fetch real stories from DB to know which users actually have stories
  useEffect(() => {
    setLoading(true);
    api.getStories(undefined, "published").then((data: any) => {
      const storyUsersList: any[] = [];
      for (const su of (data.storyUsers || [])) {
        if (su.stories.length > 0) {
          // Find the most recent story timestamp
          const mostRecentStory = su.stories.reduce((latest: any, story: any) => {
            return new Date(story.createdAt) > new Date(latest.createdAt) ? story : latest;
          }, su.stories[0]);
          storyUsersList.push({
            ...su.user,
            storyCount: su.stories.length,
            mostRecentStoryTime: new Date(mostRecentStory.createdAt).getTime()
          });
        }
      }
      setDbStoryUsers(storyUsersList);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [hasActiveStory]); // re-fetch when hasActiveStory changes (after posting/deleting)

  // Use DB story users only - no fallback to mock data
  const storyUsers = dbStoryUsers
    .filter((u: any) => u.id !== currentUserId)
    .sort((a: any, b: any) => {
      // Primary sort: most recent story first (descending)
      const timeDiff = (b.mostRecentStoryTime || 0) - (a.mostRecentStoryTime || 0);
      if (timeDiff !== 0) return timeDiff;
      // Secondary sort: followed users first
      const aFollowed = following.has(a.id) ? 1 : 0;
      const bFollowed = following.has(b.id) ? 1 : 0;
      return bFollowed - aFollowed;
    });

  // Debug: Log story users count
  console.log('Story users count:', storyUsers.length, 'isCircle:', isCircle);

  // Global wheel event handler for better event capture
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (!isHovering) return;

      const scrollContainer = scrollRef.current;
      if (!scrollContainer) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.deltaY !== 0) {
        console.log('Global wheel event, deltaY:', e.deltaY);
        scrollContainer.scrollLeft += e.deltaY * 2;
      }

      return false;
    };

    if (isHovering) {
      document.addEventListener('wheel', handleGlobalWheel, { passive: false, capture: true });
    }

    return () => {
      document.removeEventListener('wheel', handleGlobalWheel, { capture: true });
    };
  }, [isHovering]);

  if (loading) {
    return (
      <div className="mb-5 sticky top-0 bg-white z-10 pb-2">
        <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Stories</h3>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4 md:-mx-8 md:px-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-[48px] h-[48px] rounded-full shimmer" />
              <div className="h-2 w-8 rounded shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Hide section if no stories and user can't post
  if (!isCircle && storyUsers.length === 0) return null;

  return (
    <div className="mb-5 sticky top-0 bg-white z-10 pb-2">
      <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Stories</h3>
      <div className="relative">
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="flex gap-3 overflow-x-auto scrollbar-hide py-1 scroll-smooth touch-pan-x -mx-4 px-4 md:-mx-8 md:px-8"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            maskImage: "linear-gradient(to right, black 95%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, black 95%, transparent 100%)"
          }}
        >
          {/* Your Story / Add Story — first item for Circle users */}
          {isCircle && currentUser && (
            hasActiveStory ? (

              <button

                onClick={() => { setStoryViewingUserId(currentUserId); setShowStoryViewer(true); }}

                className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group"

              >

                <div className="w-[48px] h-[48px] rounded-full p-[2px] bg-gradient-to-tr from-[#F44444] via-[#F44444]/60 to-[#F44444]/30 group-hover:scale-105 transition-transform duration-200">

                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1px]">

                    <div className="w-full h-full rounded-full overflow-hidden">

                      {currentUser.avatar && isValidSrc(currentUser.avatar) ? (

                        <Image src={currentUser.avatar} alt="Your story" width={46} height={46} className="object-cover w-full h-full" />

                      ) : (

                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">

                          <User className="w-5 h-5 text-gray-400" />

                        </div>

                      )}

                    </div>

                  </div>

                </div>

                <span className="text-[10px] text-[#404040] font-medium truncate max-w-[56px]">Your story</span>

              </button>

            ) : (

              <button
                onClick={() => setShowStoryCreator(true)}
                className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group"
              >
                <div className="relative w-[48px] h-[48px] rounded-full p-[2px] border border-[#e5e5e5] group-hover:border-[#c5c5c5] transition-colors">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1px]">
                    <div className="w-full h-full rounded-full overflow-hidden bg-[#e0e0e0] flex items-end justify-center">
                      <User className="w-8 h-8 text-white translate-y-1.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#0a0a0a] rounded-full border border-white flex items-center justify-center translate-x-[1px] translate-y-[1px]">
                    <Plus className="w-2.5 h-2.5 text-white stroke-[3]" />
                  </div>
                </div>
                <span className="text-[10px] text-[#404040] font-medium truncate max-w-[56px]">Your story</span>
              </button>

            )

          )}

          {storyUsers.length > 0 ? (
            storyUsers.map((user: any) => (

              <button

                key={user.id}

                onClick={() => { setStoryViewingUserId(user.id); setShowStoryViewer(true); }}

                className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group"

              >

                <div className="w-[48px] h-[48px] rounded-full p-[2px] bg-gradient-to-tr from-[#F44444] via-[#F44444]/60 to-[#F44444]/30 group-hover:scale-105 transition-transform duration-200">

                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1px]">

                    <div className="w-full h-full rounded-full overflow-hidden">

                      {user.avatar && isValidSrc(user.avatar) ? (

                        <Image src={user.avatar} alt={user.name} width={46} height={46} className="object-cover w-full h-full" />

                      ) : (

                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">

                          <User className="w-5 h-5 text-gray-400" />

                        </div>

                      )}

                    </div>

                  </div>

                </div>

                <span className="text-[10px] text-[#404040] font-medium truncate max-w-[48px]">{user.name.split(' ')[0]}</span>

              </button>

            ))
          ) : (
            <div className="py-4 text-left">
              <p className="text-xs text-[#737373]">No stories available</p>
            </div>
          )}

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



export function QuickSnapshot() {

  const { useContext } = require("react");

  const { AuthContext } = require("@/app/lib/contexts");

  const { quickSnapshot } = require("@/app/lib/data");



  const { userRole } = useContext(AuthContext);

  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";



  if (!isCircle) return null;



  return (

    <div className="mb-5">

      <h2 className="text-sm font-semibold text-[#0a0a0a] mb-3">Quick snapshot</h2>

      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">

        <div className="space-y-1">

          {quickSnapshot.map((item: any) => (

            <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#fafafa] transition-colors">

              <span className="text-xs text-[#525252]">{item.label}</span>

              <span className="text-xs font-semibold text-[#0a0a0a]">{item.value}</span>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}



export function RightSidebar() {

  return (

    <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">

      <RecentStories />

      <SuggestedProfiles />

    </aside>

  );

}



export function PostCardShimmer() {
  return (
    <div className="rounded-xl border border-[#e5e5e5] p-3 md:p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full shimmer" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded shimmer" />
            <div className="h-2 w-32 rounded shimmer" />
          </div>
        </div>
        <div className="h-6 w-16 rounded-full shimmer" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded shimmer" />
        <div className="h-3 w-5/6 rounded shimmer" />
        <div className="h-3 w-2/3 rounded shimmer" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0]">
        <div className="flex gap-4">
          <div className="h-3 w-10 rounded shimmer" />
          <div className="h-3 w-10 rounded shimmer" />
          <div className="h-3 w-10 rounded shimmer" />
        </div>
        <div className="h-3 w-6 rounded shimmer" />
      </div>
    </div>
  );
}

export function ArticleCardShimmer() {
  return (
    <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-40 h-40 sm:h-32 rounded-lg shimmer flex-shrink-0" />
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-12 rounded shimmer" />
            <div className="h-2.5 w-16 rounded shimmer" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded shimmer" />
            <div className="h-4 w-3/4 rounded shimmer" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-5/6 rounded shimmer" />
            <div className="h-3 w-2/3 rounded shimmer" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full shimmer" />
              <div className="h-2.5 w-16 rounded shimmer" />
            </div>
            <div className="flex gap-3">
              <div className="h-4 w-4 rounded shimmer" />
              <div className="h-4 w-4 rounded shimmer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
