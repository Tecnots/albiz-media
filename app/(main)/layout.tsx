"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useContext, createContext } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Search, Users, Bell, Mail, Bookmark, BarChart3, Settings, User,
  Plus, PenLine, CircleDashed, Eye, EyeOff, X, ChevronLeft, ChevronRight, Heart, Send, MessageCircle,
  Bold, Italic, Link as LinkIcon, Link2, List, ListOrdered, Smile, MapPin, Hash, AtSign,
  Clock, ImagePlus, Menu as MenuIcon,
} from "lucide-react";
import { FollowingContext, CreatePostContext, CreateStoryContext, AuthContext, type UserRoleType } from "@/app/lib/contexts";
import { users, navItems } from "@/app/lib/data";
import { AlbizLogo, VerifiedBadge } from "@/app/lib/shared-components";

// Story & Create context
const StoryContext = createContext<{
  hasActiveStory: boolean;
  setHasActiveStory: (v: boolean) => void;
  showStoryViewer: boolean;
  setShowStoryViewer: (v: boolean) => void;
  showStoryCreator: boolean;
  setShowStoryCreator: (v: boolean) => void;
  showCreatePost: boolean;
  setShowCreatePost: (v: boolean) => void;
}>({ hasActiveStory: true, setHasActiveStory: () => {}, showStoryViewer: false, setShowStoryViewer: () => {}, showStoryCreator: false, setShowStoryCreator: () => {}, showCreatePost: false, setShowCreatePost: () => {} });

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

const demoStories = [
  { id: 1, image: "https://picsum.photos/seed/story-1/400/700", time: "2h ago", views: 142, likes: 38 },
  { id: 2, image: "https://picsum.photos/seed/story-2/400/700", time: "4h ago", views: 89, likes: 24 },
  { id: 3, image: "https://picsum.photos/seed/story-3/400/700", time: "6h ago", views: 214, likes: 67 },
];

function StoryViewer({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [paused, setPaused] = useState(false);
  const currentUser = users[0];

  const circleViewers = storyViewers.filter(v => v.type === "CIRCLE").map(v => users.find(u => u.id === v.id)).filter(Boolean);
  const anonymousCount = storyViewers.filter(v => v.type === "NORMAL").length;
  const story = demoStories[current];

  useEffect(() => {
    if (finished) onClose();
  }, [finished, onClose]);

  useEffect(() => {
    if (paused || showViewers) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (current < demoStories.length - 1) {
            setCurrent(c => c + 1);
            return 0;
          } else {
            setFinished(true);
            return 100;
          }
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [current, paused, showViewers]);

  const goNext = () => {
    if (current < demoStories.length - 1) { setCurrent(c => c + 1); setProgress(0); }
    else onClose();
  };

  const goPrev = () => {
    if (current > 0) { setCurrent(c => c - 1); setProgress(0); }
  };

  const toggleLike = () => {
    setLiked(prev => {
      const next = new Set(prev);
      if (next.has(current)) next.delete(current);
      else next.add(current);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3 max-w-md mx-auto">
        {demoStories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-100 ease-linear" style={{ width: `${i < current ? 100 : i === current ? progress : 0}%` }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 z-30 flex items-center justify-between px-4 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/50">
            <Image src={currentUser.avatar} alt={currentUser.name} width={40} height={40} className="object-cover w-full h-full" />
          </div>
          <div>
            <span className="text-white text-sm font-semibold">{currentUser.name}</span>
            <span className="text-white/60 text-xs block">{story.time}</span>
          </div>
        </div>
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

      {/* Forward / Backward buttons */}
      <button
        onClick={goPrev}
        disabled={current === 0}
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          current === 0 ? "opacity-0 pointer-events-none" : "bg-white/15 hover:bg-white/25 backdrop-blur-sm"
        }`}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={goNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-all"
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Story image */}
      <div className="w-full max-w-md aspect-[9/16] relative rounded-xl overflow-hidden">
        <Image src={story.image} alt={`Story ${current + 1}`} fill className="object-cover" />

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
          <div className="flex items-center justify-between">
            {/* View count - tap to open viewer list */}
            <button
              onClick={() => { setPaused(true); setShowViewers(true); }}
              className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">{story.views}</span>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button onClick={toggleLike} className="flex items-center gap-1.5 transition-colors">
                <Heart className={`w-5 h-5 ${liked.has(current) ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
                <span className="text-sm text-white">{story.likes + (liked.has(current) ? 1 : 0)}</span>
              </button>
              <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tap areas for navigation (invisible) */}
      <button onClick={goPrev} className="absolute left-0 top-20 w-1/4 h-[calc(100%-160px)] z-20" />
      <button onClick={goNext} className="absolute right-0 top-20 w-1/4 h-[calc(100%-160px)] z-20" />

      {/* Viewers panel (slide up from bottom) */}
      {showViewers && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowViewers(false); setPaused(false); }}>
          <div className="absolute bottom-0 left-0 right-0 max-w-md mx-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1a1a1a] rounded-t-2xl max-h-[60vh] overflow-hidden">
              {/* Viewers header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Eye className="w-4 h-4 text-white/60" />
                  <span className="text-white text-sm font-semibold">{story.views} views</span>
                </div>
                <button onClick={() => { setShowViewers(false); setPaused(false); }} className="p-1 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Circle user viewers — show profiles */}
              <div className="overflow-y-auto max-h-[45vh] px-2 py-2">
                {circleViewers.map(viewer => {
                  if (!viewer) return null;
                  return (
                    <div key={viewer.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                      <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/20 flex-shrink-0">
                        <Image src={viewer.avatar} alt={viewer.name} width={40} height={40} className="object-cover w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white text-sm font-medium truncate">{viewer.name}</span>
                          {viewer.verified && (
                            <span className="flex-shrink-0"><VerifiedBadge className="scale-75" /></span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#F44444]/20 text-[#F44444] flex-shrink-0">Circle</span>
                        </div>
                        <span className="text-white/40 text-xs truncate block">{viewer.title}</span>
                      </div>
                      <button className="px-3 py-1 text-xs font-medium rounded-full border border-white/20 text-white/70 hover:bg-white/10 transition-colors flex-shrink-0">
                        View
                      </button>
                    </div>
                  );
                })}

                {/* Anonymous / Normal viewers — just a count */}
                {anonymousCount > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-white/60 text-sm">+{anonymousCount} other viewers</span>
                      <span className="text-white/30 text-xs block">Non-Circle members</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateButtons({ collapsed }: { collapsed: boolean }) {
  const { setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  const [showMenu, setShowMenu] = useState(false);
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
      {!collapsed && (
        <button onClick={() => setShowStoryCreator(true)} className="hidden lg:block w-40 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Story</button>
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
              <div className="h-px bg-[#f0f0f0]" />
              <button
                onClick={() => { setShowMenu(false); setShowStoryCreator(true); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
              >
                <CircleDashed className="w-[18px] h-[18px] text-[#737373]" />
                <span className="text-sm font-medium">Story</span>
              </button>
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

function LeftSidebar() {
  const pathname = usePathname();
  const currentUser = users[0];
  const { isSignedIn, userRole, openAuthModal } = useContext(AuthContext);
  const { hasActiveStory, setShowStoryViewer, setShowStoryCreator } = useContext(StoryContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const isNormal = userRole === "NORMAL";
  const collapsed = pathname === "/messages";

  const navRoutes = navItems.map(item => ({
    ...item,
    href: item.href,
    active: item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
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
                <button onClick={() => setShowStoryViewer(true)} className="cursor-pointer">
                  <div className={`story-ring-wrapper ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                    <div className="story-ring-gradient" />
                    <div className="story-ring-gap" />
                    <div className={`rounded-full overflow-hidden relative ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                      <Image src={currentUser.avatar} alt={currentUser.name} width={96} height={96} className="object-cover w-full h-full" />
                    </div>
                  </div>
                </button>
              ) : (
                <div className={`rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white transition-all duration-300 ${collapsed ? "w-12 h-12" : "w-12 h-12 lg:w-24 lg:h-24"}`}>
                  <Image src={currentUser.avatar} alt={currentUser.name} width={96} height={96} className="object-cover w-full h-full" />
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowStoryCreator(true); }}
                  className="hidden lg:flex absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#F44444] items-center justify-center z-10 hover:bg-[#d64d3c] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            {!collapsed && (
              <>
                <div className="hidden lg:flex items-center gap-1.5">
                  <span className="font-semibold">{currentUser.name}</span>
                  <VerifiedBadge />
                </div>
                <span className="hidden lg:block text-[#737373] text-sm">{currentUser.title}</span>
              </>
            )}
          </div>
          {!collapsed && (
            <div className="hidden lg:flex items-center justify-center gap-3 mb-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF0F0] text-[#F44444] text-xs font-semibold leading-none"><AlbizLogo size={10} /> Circle</span>
              <span className="w-px h-4 bg-[#e5e5e5]" />
              <button onClick={() => setShowStoryViewer(true)} className="text-sm text-[#737373] leading-none hover:text-[#0a0a0a] transition-colors cursor-pointer">My Stories</button>
            </div>
          )}
        </>
      ) : isSignedIn && isNormal ? (
        <>
          <div className="flex flex-col items-center mb-4">
            <div className="relative mb-2">
              <div className={`w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 ${collapsed ? "" : "lg:w-24 lg:h-24"}`}>
                <Image src="https://picsum.photos/seed/priya-s/200" alt="User" width={96} height={96} className="object-cover w-full h-full" />
              </div>
            </div>
            {!collapsed && (
              <>
                <div className="hidden lg:flex items-center gap-1.5">
                  <span className="font-semibold text-sm">Priya Sharma</span>
                </div>
                <span className="hidden lg:block text-[#737373] text-xs">Product Designer @ Figma</span>
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
                <button className="w-full py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">
                  Upgrade to Circle
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center mb-4">
          <div className="relative mb-2">
            <div className={`w-12 h-12 rounded-full bg-[#f0f0f0] ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 flex items-center justify-center ${collapsed ? "" : "lg:w-24 lg:h-24"}`}>
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

      {isCircle && (
        <CreateButtons collapsed={collapsed} />
      )}

      <div className="flex-1" />
      <div className="flex justify-center flex-shrink-0">
        <AlbizLogo size={40} />
      </div>
    </aside>
  );
}

function MobileHeader({ isMenuOpen, onMenuClick }: { isMenuOpen: boolean; onMenuClick: () => void }) {
  const currentUser = users[0];
  return (
    <header className="md:hidden flex-shrink-0 z-50 bg-white border-b border-[#e5e5e5] px-4 py-3 relative flex items-center justify-between">
      <button onClick={onMenuClick} className="z-10">
        <div className={`w-9 h-9 rounded-full overflow-hidden ring-2 ${isMenuOpen ? 'ring-[#F44444]' : 'ring-transparent'} transition-all`}>
          <Image src={currentUser.avatar} alt={currentUser.name} width={36} height={36} className="object-cover w-full h-full" />
        </div>
      </button>
      <div className="absolute left-1/2 -translate-x-1/2">
        <AlbizLogo size={32} />
      </div>
      <div className="flex items-center gap-2 z-10">
        <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-5 h-5 text-[#525252]" /></button>
        <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Bell className="w-5 h-5 text-[#525252]" /></button>
      </div>
    </header>
  );
}

function MobileMenuCreateButtons({ onClose }: { onClose: () => void }) {
  const { setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  return (
    <div className="p-3 border-t border-[#e5e5e5] flex gap-2">
      <button onClick={() => { onClose(); setShowStoryCreator(true); }} className="flex-1 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">Story</button>
      <button onClick={() => { onClose(); setShowCreatePost(true); }} className="flex-1 py-2 rounded-full bg-[#F44444] text-white font-medium text-sm hover:bg-[#d64d3c] transition-colors cursor-pointer">Post</button>
    </div>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const currentUser = users[0];
  const pathname = usePathname();
  const { userRole, isSignedIn, openAuthModal } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";

  const menuNavItems = navItems.filter(item => {
    if (!isCircle && (item.label === "Messages" || item.label === "Profile" || item.label === "Analytics" || item.label === "Notifications")) return false;
    return true;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Dropdown Menu */}
      <div
        className={`md:hidden fixed left-4 top-[72px] z-50 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#e5e5e5] overflow-hidden transition-all duration-200 origin-top-left ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* User Profile Section */}
        <div className="p-4 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image src={currentUser.avatar} alt={currentUser.name} width={48} height={48} className="object-cover w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{currentUser.name}</span>
                <VerifiedBadge />
              </div>
              <span className="text-[#737373] text-xs truncate block">{currentUser.title}</span>
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
  const { userRole, isSignedIn } = useContext(AuthContext);
  const { setShowStoryCreator, setShowCreatePost } = useContext(StoryContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreateMenu) return;
    function handleTap(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowCreateMenu(false);
    }
    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap);
    return () => { document.removeEventListener("mousedown", handleTap); document.removeEventListener("touchstart", handleTap); };
  }, [showCreateMenu]);

  const leftItems = [
    { icon: Activity, label: "Feed", href: "/" },
    { icon: Search, label: "Explore", href: "/explore" },
  ];

  const rightItems = isCircle ? [
    { icon: Mail, label: "Messages", href: "/messages" },
    { icon: User, label: "Profile", href: "/profile" },
  ] : [
    { icon: Users, label: "Circle", href: "/circle" },
    { icon: Bookmark, label: "Saved", href: "/saved" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5e5] px-2 py-2 z-40">
      <div className="flex items-end justify-between relative">
        {/* Left nav items */}
        {leftItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.label} href={item.href} className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all duration-200 ${active ? "text-[#F44444]" : "text-[#737373]"}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}

        {/* Center create button — Circle only, absolutely centered */}
        {isCircle ? (
          <div className="flex-1 flex justify-center" ref={menuRef}>
            {showCreateMenu && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[140px] z-50">
                <button
                  onClick={() => { setShowCreateMenu(false); setShowCreatePost(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  <PenLine className="w-[18px] h-[18px] text-[#737373]" />
                  <span className="text-sm font-medium">Post</span>
                </button>
                <div className="h-px bg-[#f0f0f0]" />
                <button
                  onClick={() => { setShowCreateMenu(false); setShowStoryCreator(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  <CircleDashed className="w-[18px] h-[18px] text-[#737373]" />
                  <span className="text-sm font-medium">Story</span>
                </button>
              </div>
            )}
            <button
              onClick={() => setShowCreateMenu(prev => !prev)}
              className="bg-[#F44444] rounded-full w-12 h-12 -mt-5 shadow-lg flex items-center justify-center"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        ) : (
          /* Normal users get an empty flex-1 slot to keep spacing even */
          null
        )}

        {/* Right nav items */}
        {rightItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.label} href={item.href} className={`flex-1 flex flex-col items-center gap-1 py-1 transition-all duration-200 ${active ? "text-[#F44444]" : "text-[#737373]"}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SignInModal({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        signIn(data.role as UserRoleType, data.id);
        onClose();
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch {
      setError("Connection error — try again");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        <div className="px-8 pt-8 pb-6">
          <div className="flex justify-center mb-6"><AlbizLogo size={48} /></div>
          <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Welcome back</h2>
          <p className="text-sm text-[#737373] text-center mb-6">Sign in to your Albiz account</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-[#F44444] text-center">{error}</p>}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Sign in</button>
          </form>
          <div className="mt-4 space-y-2 max-h-[240px] overflow-y-auto">
            <button type="button" onClick={() => { setEmail("support@tecnots.com"); setPassword("C0mplex@#408"); }} className="w-full px-4 py-3 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] hover:border-[#0a0a0a]/30 hover:bg-[#f0f0f0] transition-all cursor-pointer text-left">
              <div className="flex items-center justify-between mb-1"><p className="text-[11px] text-[#737373]">Platform admin</p><span className="text-[10px] font-semibold text-[#0a0a0a] bg-[#e5e5e5] px-1.5 py-0.5 rounded">ADMIN</span></div>
              <p className="text-xs text-[#0a0a0a] font-medium">support@tecnots.com</p>
            </button>
            <button type="button" onClick={() => { setEmail("jessinsam@demo.albiz.com"); setPassword("demo123"); }} className="w-full px-4 py-3 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] hover:border-[#F44444]/40 hover:bg-[#FFF8F8] transition-all cursor-pointer text-left">
              <div className="flex items-center justify-between mb-1"><p className="text-[11px] text-[#737373]">Circle member</p><span className="text-[10px] font-semibold text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded">CIRCLE</span></div>
              <p className="text-xs text-[#0a0a0a] font-medium">jessinsam@demo.albiz.com</p>
            </button>
            <button type="button" onClick={() => { setEmail("author@demo.albiz.com"); setPassword("demo123"); }} className="w-full px-4 py-3 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] hover:border-[#8B5CF6]/30 hover:bg-[#F5F3FF] transition-all cursor-pointer text-left">
              <div className="flex items-center justify-between mb-1"><p className="text-[11px] text-[#737373]">Invited author</p><span className="text-[10px] font-semibold text-[#8B5CF6] bg-[#F5F3FF] px-1.5 py-0.5 rounded">AUTHOR</span></div>
              <p className="text-xs text-[#0a0a0a] font-medium">author@demo.albiz.com</p>
            </button>
            <button type="button" onClick={() => { setEmail("priyasharma@demo.albiz.com"); setPassword("demo123"); }} className="w-full px-4 py-3 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] hover:border-[#525252]/30 hover:bg-[#fafafa] transition-all cursor-pointer text-left">
              <div className="flex items-center justify-between mb-1"><p className="text-[11px] text-[#737373]">Normal user</p><span className="text-[10px] font-semibold text-[#525252] bg-[#f0f0f0] px-1.5 py-0.5 rounded">NORMAL</span></div>
              <p className="text-xs text-[#0a0a0a] font-medium">priyasharma@demo.albiz.com</p>
            </button>
          </div>
        </div>
        <div className="px-8 py-4 bg-[#fafafa] border-t border-[#e5e5e5] text-center">
          <span className="text-sm text-[#737373]">Don&apos;t have an account? </span>
          <button onClick={onSwitch} className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] cursor-pointer">Sign up</button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
      </div>
    </div>
  );
}

function SignUpModal({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signIn } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    signIn("NORMAL");
    onClose();
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
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-[#F44444] text-center">{error}</p>}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Create account</button>
          </form>
          <p className="text-[11px] text-[#a3a3a3] text-center mt-4">By signing up, you agree to our Terms and Privacy Policy.</p>
        </div>
        <div className="px-8 py-4 bg-[#fafafa] border-t border-[#e5e5e5] text-center">
          <span className="text-sm text-[#737373]">Already have an account? </span>
          <button onClick={onSwitch} className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] cursor-pointer">Sign in</button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
      </div>
    </div>
  );
}

function StoryCreator({ onClose, onPublish }: { onClose: () => void; onPublish: () => void }) {
  const currentUser = users[0];
  const [visibility, setVisibility] = useState<"public" | "circle">("public");
  const [textOverlay, setTextOverlay] = useState("");
  const [textStyle, setTextStyle] = useState({ bold: false, italic: false, align: "center" as "left" | "center" | "right" });
  const [textColor, setTextColor] = useState("#ffffff");
  const [uploadedMedia, setUploadedMedia] = useState(["https://picsum.photos/seed/story-media-1/400/600"]);
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
    { id: "location", label: "Location", icon: MapPin }, { id: "link", label: "Link", icon: Link2 },
    { id: "time", label: "Time", icon: Clock }, { id: "music", label: "Music", icon: Activity },
  ];

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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="flex items-center justify-between p-3 md:p-5 border-b border-[#f0f0f0] flex-shrink-0">
          <span className="text-base md:text-lg font-semibold text-[#0a0a0a]">Create Story</span>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"><X className="w-5 h-5 text-[#737373]" /></button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          {/* Preview */}
          <div className="w-full md:w-[320px] lg:w-[360px] flex-shrink-0 p-3 md:p-6">
            <div
              className="relative w-full max-w-[200px] md:max-w-none mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-gradient-to-br from-[#667eea] via-[#64b3f4] to-[#f093fb] select-none"
              onMouseMove={(e) => handleDrag(e, e.currentTarget)} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
              onTouchMove={(e) => handleDrag(e, e.currentTarget)} onTouchEnd={handleDragEnd}
              onClick={() => setSelectedElement(null)}
            >
              {uploadedMedia.length > 0 && <Image src={uploadedMedia[0]} alt="Story background" fill className="object-cover pointer-events-none" />}
              <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/50">
                  <Image src={currentUser.avatar} alt={currentUser.name} width={32} height={32} className="object-cover w-full h-full" />
                </div>
                <div>
                  <div className="flex items-center gap-0.5"><span className="text-white text-xs font-semibold drop-shadow-md">{currentUser.name}</span><VerifiedBadge className="scale-50" /></div>
                  <span className="text-white/80 text-[8px] drop-shadow-md">{currentUser.title}</span>
                </div>
              </div>

              {stickerEl("poll", <>
                <p className="text-xs font-medium text-[#0a0a0a] mb-1.5">What do you think?</p>
                <div className="space-y-1"><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs">Option 1</div><div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs">Option 2</div></div>
              </>, "bg-white/90 backdrop-blur-sm rounded-xl p-2")}
              {stickerEl("question", <>
                <p className="text-xs font-medium text-[#0a0a0a] mb-1.5">Ask me anything</p>
                <div className="bg-[#f5f5f5] rounded-md px-2 py-1 text-xs text-[#737373]">Type your question...</div>
              </>, "bg-white/90 backdrop-blur-sm rounded-xl p-2")}
              {stickerEl("location", <><MapPin className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium">San Francisco, CA</span></>, "bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1")}
              {stickerEl("time", <span className="text-white text-xs font-medium">12:30 PM</span>, "bg-black/50 backdrop-blur-sm rounded-full px-2 py-1")}
              {stickerEl("hashtag", <span className="text-white text-xs font-medium">#trending</span>, "bg-[#F44444] rounded-full px-2 py-1")}
              {stickerEl("mention", <span className="text-xs font-medium text-[#0a0a0a]">@username</span>, "bg-white/90 backdrop-blur-sm rounded-full px-2 py-1")}
              {stickerEl("link", <><Link2 className="w-3 h-3 text-[#F44444]" /><span className="text-xs font-medium text-[#0a0a0a]">Link</span></>, "bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1")}
              {stickerEl("music", <><Activity className="w-3 h-3 text-white" /><span className="text-xs font-medium text-white">Song Name</span></>, "bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1")}

              {textOverlay && (
                <div
                  className={`absolute z-20 cursor-move px-1.5 py-0.5 rounded ${selectedElement === "text" ? "ring-2 ring-white/50 bg-black/20" : ""}`}
                  style={{ left: `${elementPositions.text?.x || 50}%`, top: `${elementPositions.text?.y || 85}%`, transform: `translate(-50%, -50%) scale(${elementPositions.text?.scale || 1})`, textAlign: textStyle.align }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart("text", e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart("text", e); }}
                  onClick={(e) => e.stopPropagation()}
                >
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
            <p className="text-xs text-[#737373] text-center mt-2">Drag elements to reposition</p>
          </div>

          {/* Editing Panel */}
          <div className="flex-1 p-3 md:p-6 md:overflow-y-auto border-t md:border-t-0 md:border-l border-[#f0f0f0]">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Media</h3>
              <div className="flex gap-2 flex-wrap">
                <button className="w-24 h-20 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-1 text-[#737373] cursor-pointer">
                  <ImagePlus className="w-5 h-5" /><span className="text-xs">Add media</span>
                </button>
                {uploadedMedia.map((media, index) => (
                  <div key={index} className="relative w-24 h-20 rounded-xl overflow-hidden ring-2 ring-[#F44444]">
                    <Image src={media} alt={`Media ${index + 1}`} width={96} height={80} className="object-cover w-full h-full" />
                    <button onClick={() => setUploadedMedia(prev => prev.filter((_, i) => i !== index))} className="absolute top-1 right-1 w-5 h-5 bg-[#525252] hover:bg-[#737373] rounded-full flex items-center justify-center cursor-pointer"><X className="w-3 h-3 text-white" /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-3">Text Overlay</h3>
              <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                <button onClick={() => setTextStyle(s => ({ ...s, bold: !s.bold }))} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.bold ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><Bold className="w-4 h-4" /></button>
                <button onClick={() => setTextStyle(s => ({ ...s, italic: !s.italic }))} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.italic ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><Italic className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-[#e5e5e5] mx-1 flex-shrink-0" />
                <button onClick={() => setTextStyle(s => ({ ...s, align: "left" }))} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.align === "left" ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><List className="w-4 h-4" /></button>
                <button onClick={() => setTextStyle(s => ({ ...s, align: "center" }))} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.align === "center" ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><MenuIcon className="w-4 h-4" /></button>
                <button onClick={() => setTextStyle(s => ({ ...s, align: "right" }))} className={`p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.align === "right" ? "bg-[#F44444] text-white" : "hover:bg-[#f5f5f5] text-[#525252]"}`}><ListOrdered className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-[#e5e5e5] mx-1 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {textColors.map(color => (
                    <button key={color} onClick={() => setTextColor(color)} className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${textColor === color ? "border-[#F44444] scale-110" : "border-transparent"}`} style={{ backgroundColor: color, boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #e5e5e5" : undefined }} />
                  ))}
                </div>
              </div>
              <div className="bg-[#f8f9fa] rounded-xl p-4">
                <textarea value={textOverlay} onChange={(e) => setTextOverlay(e.target.value)} placeholder="Add text to your story..." className="w-full bg-transparent text-[#262626] text-sm resize-none outline-none min-h-[80px]" />
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 md:px-6 py-3 md:py-4 border-t border-[#f0f0f0] flex-shrink-0">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <button onClick={() => setVisibility("public")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all cursor-pointer ${visibility === "public" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Public</button>
            <button onClick={() => setVisibility("circle")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all cursor-pointer ${visibility === "circle" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Circle only</button>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2 md:gap-3">
            <button onClick={onClose} className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors cursor-pointer">Save draft</button>
            <button onClick={() => { onPublish(); onClose(); }} className="px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d64d3c] transition-colors cursor-pointer">Post Story</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePostModal({ onClose }: { onClose: () => void }) {
  const currentUser = users[0];
  const [postContent, setPostContent] = useState("Exploring the new brand guidelines for Albiz Media today. Really loving the direction we're taking with the new interface!");
  const [visibility, setVisibility] = useState<"public" | "circle">("public");
  const [uploadedImages, setUploadedImages] = useState([
    "https://picsum.photos/seed/space-post/400/300",
    "https://picsum.photos/seed/team-post/400/300",
  ]);
  const maxChars = 1000;
  const maxFiles = 10;

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-5 border-b border-[#f0f0f0]">
          <span className="text-lg md:text-xl font-semibold text-[#0a0a0a]">Create Post</span>
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#737373]" />
          </button>
        </div>

        {/* User Info */}
        <div className="flex items-center justify-between px-3 md:px-5 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image src={currentUser.avatar} alt={currentUser.name} width={48} height={48} className="object-cover w-full h-full" />
            </div>
            <span className="font-semibold text-sm md:text-base text-[#0a0a0a]">{currentUser.name}</span>
          </div>
          <button className="text-[#F44444] font-medium text-xs md:text-sm hover:underline">Drafts</button>
        </div>

        {/* Formatting Toolbar */}
        <div className="px-3 md:px-5 pb-2">
          <div className="flex items-center gap-0.5 md:gap-1">
            {[
              { icon: Bold, label: "Bold" },
              { icon: Italic, label: "Italic" },
              { icon: LinkIcon, label: "Link" },
              { icon: List, label: "Bullet List" },
              { icon: ListOrdered, label: "Numbered List" },
            ].map((tool) => (
              <button key={tool.label} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title={tool.label}>
                <tool.icon className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="bg-[#f5f5f5] rounded-xl p-3 md:p-4 min-h-[100px] md:min-h-[120px]">
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value.slice(0, maxChars))}
              placeholder="What's on your mind?"
              className="w-full bg-transparent text-[#262626] text-sm md:text-base resize-none outline-none min-h-[80px] md:min-h-[100px]"
              autoFocus
            />
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="flex gap-2 md:gap-3 flex-wrap">
            {uploadedImages.map((img, index) => (
              <div key={index} className="relative w-24 h-20 md:w-32 md:h-28 rounded-xl overflow-hidden">
                <Image src={img} alt={`Upload ${index + 1}`} width={128} height={112} className="object-cover w-full h-full" />
                <button onClick={() => removeImage(index)} className="absolute top-1 right-1 md:top-2 md:right-2 w-5 h-5 md:w-6 md:h-6 bg-[#525252] hover:bg-[#737373] rounded-full flex items-center justify-center transition-colors">
                  <X className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
                </button>
              </div>
            ))}
            {uploadedImages.length < maxFiles && (
              <button className="w-24 h-20 md:w-32 md:h-28 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-1 text-[#737373]">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[10px] md:text-xs">Add More</span>
              </button>
            )}
          </div>
          <p className="text-[10px] md:text-xs text-[#737373] mt-2">{uploadedImages.length}/{maxFiles} files added</p>
        </div>

        {/* Action Icons */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="flex items-center gap-1 md:gap-2">
            {[
              { icon: Smile, label: "Emoji" },
              { icon: MapPin, label: "Location" },
              { icon: Hash, label: "Hashtag" },
              { icon: AtSign, label: "Mention" },
            ].map((action) => (
              <button key={action.label} className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title={action.label}>
                <action.icon className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 md:px-5 py-3 md:py-4 border-t border-[#f0f0f0]">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <button onClick={() => setVisibility("public")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${visibility === "public" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Public</button>
            <button onClick={() => setVisibility("circle")} className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${visibility === "circle" ? "bg-[#F44444] text-white" : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"}`}>Circle only</button>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2 md:gap-3">
            <span className="text-xs md:text-sm text-[#737373]">{postContent.length}/{maxChars}</span>
            <button onClick={onClose} className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors cursor-pointer">Save draft</button>
            <button onClick={onClose} className="px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d64d3c] transition-colors cursor-pointer">Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [userRole, setUserRole] = useState<UserRoleType>("CIRCLE");
  const [currentUserId, setCurrentUserId] = useState(1);
  const [authModal, setAuthModal] = useState<"signin" | "signup" | null>(null);
  const [following, setFollowing] = useState<Set<number>>(new Set([2, 3]));
  const [hasActiveStory, setHasActiveStory] = useState(true);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const toggleFollow = (userId: number) => {
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const authValue = {
    isSignedIn,
    userRole,
    currentUserId,
    signOut: () => { setIsSignedIn(false); setUserRole(null); setCurrentUserId(0); },
    signIn: (role: UserRoleType = "CIRCLE", userId: number = 1) => { setIsSignedIn(true); setUserRole(role); setCurrentUserId(userId); },
    openAuthModal: (mode: "signin" | "signup") => setAuthModal(mode),
  };

  const pathname = usePathname();
  const isMessages = pathname === "/messages";

  const storyValue = { hasActiveStory, setHasActiveStory, showStoryViewer, setShowStoryViewer, showStoryCreator, setShowStoryCreator, showCreatePost, setShowCreatePost };

  return (
    <AuthContext.Provider value={authValue}>
      <FollowingContext.Provider value={{ following, toggleFollow }}>
        <StoryContext.Provider value={storyValue}>
          <div className={`h-screen pb-16 md:pb-0 bg-white flex flex-col overflow-hidden ${isMessages ? "" : "md:px-4 lg:px-8 xl:px-16"}`}>
            <MobileHeader isMenuOpen={mobileMenuOpen} onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
            <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
            <div className={`mx-auto flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden w-full ${isMessages ? "" : "max-w-[1280px]"}`}>
              <LeftSidebar />
              {children}
            </div>
            <MobileBottomNav />
            {authModal === "signin" && <SignInModal onClose={() => setAuthModal(null)} onSwitch={() => setAuthModal("signup")} />}
            {authModal === "signup" && <SignUpModal onClose={() => setAuthModal(null)} onSwitch={() => setAuthModal("signin")} />}
            {showStoryViewer && <StoryViewer onClose={() => setShowStoryViewer(false)} />}
            {showStoryCreator && <StoryCreator onClose={() => setShowStoryCreator(false)} onPublish={() => setHasActiveStory(true)} />}
            {showCreatePost && <CreatePostModal onClose={() => setShowCreatePost(false)} />}
          </div>
        </StoryContext.Provider>
      </FollowingContext.Provider>
    </AuthContext.Provider>
  );
}
