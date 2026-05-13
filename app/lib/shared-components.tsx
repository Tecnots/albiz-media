"use client";



import Image from "next/image";

import Link from "next/link";

import { useState, useEffect, useRef, useContext } from "react";

import { Circle, Check, Bookmark, Search, FolderPlus, ChevronLeft, ChevronRight, Plus, User } from "lucide-react";

import { api } from "@/app/lib/api";

import { AuthContext } from "@/app/lib/contexts";



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



export function SaveBookmarkButton({ postId, initialSaved = false, savedPostIds, onSaveChange, popupPosition = "bottom" }: { postId: number; initialSaved?: boolean; savedPostIds?: Set<number>; onSaveChange?: (postId: number, isSaved: boolean) => void; popupPosition?: "top" | "bottom" }) {
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


  // Hide button for anonymous users (after all hooks are called)

  if (!currentUserId) {

    return null;

  }


  const openPopup = () => {

    // Check if user is authenticated

    if (!currentUserId) {

      // Directly open auth modal

      openAuthModal("signin");

      return;

    }



    if (saved) {

      setSaved(false);

      onSaveChange?.(postId, false);

      api.unsavePost(postId).then((response) => {

        // Notify other components that data has been unsaved

        window.dispatchEvent(new Event("albiz-post-saved"));

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

      setCollections(prev => [...prev, response.collection]);

      setNewName("");

      setShowCreate(false);

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

      }

    } catch (error) {

      console.error("Failed to create and save:", error);

    } finally {

      setCreating(false);

    }

  };



  return (

    <div className="relative" ref={popupRef}>

      <button onClick={openPopup} className={`transition-all p-2 rounded-lg ${saved ? "text-[#F44444] bg-[#FFF5F5]" : "text-[#737373] hover:text-[#525252] hover:bg-[#f5f5f5]"}`}>
        <Bookmark className={`w-4 h-4 ${saved ? "fill-[#F44444]" : ""}`} />
      </button>



      {showPopup && (

        <div

          className={`absolute right-0 sm:right-0 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.14)] border border-[#e5e5e5] w-52 sm:w-60 z-30 overflow-hidden ${popupPosition === "top" ? "top-full mt-2" : "bottom-8"}`}

          onClick={e => e.stopPropagation()}

        >

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

        <Link href="/explore" className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors pr-3">View all</Link>

      </div>

      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">

        {suggestions.map((user: any) => {

          const isFollowing = following.has(user.id);

          return (

            <div key={user.id} className="flex items-center gap-2.5 py-2.5">

              <Link href={`/${user.handle}`} className="flex items-center gap-2.5 flex-1 min-w-0">

                <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ${user.hasStory ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" : "ring-1 ring-[#e5e5e5]"

                  }`}>

                  {user.avatar ? (

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

        })}

      </div>

    </div>

  );

}

export function RecentStories() {

  const { useContext, useCallback, useState, useEffect, useRef } = require("react");

  const { FollowingContext, AuthContext, StoryContext } = require("@/app/lib/contexts");
  const { users } = require("@/app/lib/data");

  const { setShowStoryViewer, setStoryViewingUserId, hasActiveStory, setShowStoryCreator } = useContext(StoryContext);
  const { following } = useContext(FollowingContext);
  const { currentUserId, userRole } = useContext(AuthContext);
  const scrollRef = useRef(null);
  const [dbStoryUsers, setDbStoryUsers] = useState([]);
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
  const currentUser = users.find((u: any) => u.id === currentUserId);

  // Fetch real stories from DB to know which users actually have stories
  useEffect(() => {
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
    }).catch(() => { });
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
          className="flex gap-3 overflow-x-auto scrollbar-hide py-1 scroll-smooth touch-pan-x"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingRight: "20px",
            maskImage: "linear-gradient(to right, black 85%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)"
          }}
        >
          {/* Your Story button — persistent for Circle users */}
          {isCircle && currentUser && (
            <div className="relative flex flex-col items-center gap-1 flex-shrink-0 group">
              {!hasActiveStory ? (
                <button
                  onClick={() => setShowStoryCreator(true)}
                  className="w-[48px] h-[48px] rounded-full border border-[#e5e5e5] flex items-center justify-center bg-[#f5f5f5] hover:bg-[#fafafa] transition-colors"
                >
                  <Plus className="w-5 h-5 text-[#737373]" />
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => { setStoryViewingUserId(currentUserId); setShowStoryViewer(true); }}
                    className="w-[48px] h-[48px] rounded-full p-[2px] bg-gradient-to-tr from-[#F44444] via-[#F44444]/60 to-[#F44444]/30 hover:scale-105 transition-transform duration-200"
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1px]">
                      <div className="w-full h-full rounded-full overflow-hidden">
                        {currentUser.avatar ? (
                          <Image src={currentUser.avatar} alt="Your story" width={46} height={46} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  {/* Small add icon overlay for adding more stories */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowStoryCreator(true); }}
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#F44444] rounded-full border-2 border-white flex items-center justify-center text-white hover:bg-[#d64d3c] transition-colors z-10"
                    title="Add new story"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                  </button>
                </div>
              )}
              <span className="text-[10px] text-[#404040] font-medium truncate max-w-[48px]">{!hasActiveStory ? "Add" : "You"}</span>
            </div>
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

                      {user.avatar ? (

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

      <div className="flex-1 flex flex-col min-h-0">

        <AdCard />

      </div>

    </aside>

  );

}

