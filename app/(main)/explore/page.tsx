"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Search, X, Users, Eye, Heart, TrendingUp } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { exploreTabs, exploreSubTabs, trendingTopics as fallbackTrending, users } from "@/app/lib/data";
import { VerifiedBadge, AlbizLogo, RightSidebar, RecentStories } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";
import { isNative } from "@/app/lib/capacitor";

type ExploreTab = "all" | "creators" | "investor" | "ceo" | "other" | "followed";
type ExploreSub = "top" | "latest" | "people" | "companies";

const TAB_MODE: Record<string, ExploreTab> = {
  "All": "all", "Creators": "creators", "Investor & Entrepreneur": "investor",
  "CEO": "ceo", "Other": "other", "Followed": "followed",
};
const SUB_MODE: Record<string, ExploreSub> = {
  "Top": "top", "Latest": "latest", "People": "people", "Companies": "companies",
};

// ── Trending posts — Instagram-style grid ────────────────────────────────────

const TAG_BG: Record<string, string> = {
  technology: "#1a1a2e", ai: "#0f2027", news: "#1c1c1c",
  business: "#0d1b2a", health: "#1a2e1a", science: "#0d1b2a",
  finance: "#1a1a0d", design: "#1f0d2e", sports: "#0d1f0d",
};
function getTagBg(tags: string[]) {
  return TAG_BG[(tags?.[0] ?? "").toLowerCase()] ?? "#1a1a2e";
}

function TrendingPostCard({ post, large = false, rank }: { post: any; large?: boolean; rank?: number }) {
  const title  = post.title || post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || "";
  const desc   = post.description || "";
  const tag    = post.tags?.[0] ?? null;
  const views  = post.stats?.views ?? "0";
  const likes  = post.stats?.likes ?? "0";
  const author = post.user?.name ?? "";
  const href   = post.type === "article" ? `/?article=${post.id}&fromTrending=true` : `/?post=${post.id}&fromTrending=true`;
  const hasImg = !!post.image;

  const cardContent = (
    <div
      className={`relative w-full overflow-hidden shadow-sm hover:shadow-md transition-shadow ${large ? "aspect-[16/9] rounded-2xl" : "aspect-square rounded-xl"}`}
      style={!hasImg ? { background: getTagBg(post.tags ?? []) } : undefined}
    >
      {hasImg && (
        <Image
          src={post.image}
          alt={title}
          fill
          sizes={large ? "(max-width: 768px) 100vw, 800px" : "(max-width: 768px) 50vw, 33vw"}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
      {/* Rank Badge */}
      {rank && (
        <div className="absolute top-3 left-3 z-10">
          <span className="px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-white text-[10px] font-bold tracking-wider uppercase border border-white/20 shadow-sm flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#F44444]" /> #{rank} Trending
          </span>
        </div>
      )}

      {/* Stronger Gradient overlay for readability */}
      <div className={`absolute inset-0 bg-gradient-to-t ${large ? "from-black/90 via-black/40 to-transparent" : "from-black/80 via-black/20 to-transparent"}`} />

      {/* Overlay: title + desc + stats */}
      <div className={`absolute bottom-0 left-0 right-0 flex flex-col justify-end ${large ? "p-4 md:p-5" : "p-3 md:p-3.5"}`}>
        <p className={`text-white leading-snug line-clamp-2 drop-shadow ${large ? "text-[16px] md:text-[18px] font-bold mb-1.5" : "text-[13px] font-semibold mb-1.5"}`}>
          {title}
        </p>
        {large && desc && (
          <p className="text-white/80 text-[13px] line-clamp-2 mb-3 leading-snug">
            {desc}
          </p>
        )}
        <div className={`flex items-center justify-between ${large && !desc ? "mt-2" : large ? "" : "mt-1.5"}`}>
          {tag ? (
            <span className={`font-medium rounded-full bg-white/20 text-white backdrop-blur-sm truncate border border-white/10 ${large ? "text-[11px] px-2 py-0.5 max-w-[100px]" : "text-[10px] px-1.5 py-0.5 max-w-[80px]"}`}>
              {tag}
            </span>
          ) : <span />}
          <div className="flex items-center gap-2.5">
            <span className={`flex items-center gap-1 text-white/90 ${large ? "text-[12px]" : "text-[11px]"}`}>
              <Eye className={large ? "w-3.5 h-3.5" : "w-3 h-3"} />{views}
            </span>
            <span className={`flex items-center gap-1 text-white/90 ${large ? "text-[12px]" : "text-[11px]"}`}>
              <Heart className={large ? "w-3.5 h-3.5" : "w-3 h-3"} />{likes}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const authorContent = author ? (
    post.user?.handle ? (
      <Link
        href={`/${post.user.handle}`}
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1.5 mt-2 hover:opacity-80 transition-opacity ${large ? "px-1" : "px-0.5"}`}
      >
        {post.user?.avatar && (
          <div className={`${large ? "w-5 h-5" : "w-4 h-4"} rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]`}>
            <Image src={post.user.avatar} alt={author} width={large ? 20 : 16} height={large ? 20 : 16} className="object-cover" />
          </div>
        )}
        <span className={`text-[#525252] truncate hover:text-[#F44444] transition-colors ${large ? "text-[13px] font-medium" : "text-xs font-medium"}`}>{author}</span>
      </Link>
    ) : (
      <div className={`flex items-center gap-1.5 mt-2 ${large ? "px-1" : "px-0.5"}`}>
        {post.user?.avatar && (
          <div className={`${large ? "w-5 h-5" : "w-4 h-4"} rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]`}>
            <Image src={post.user.avatar} alt={author} width={large ? 20 : 16} height={large ? 20 : 16} className="object-cover" />
          </div>
        )}
        <span className={`text-[#525252] truncate ${large ? "text-[13px] font-medium" : "text-xs font-medium"}`}>{author}</span>
      </div>
    )
  ) : null;

  return (
    <div className="block group">
      <Link href={href} className="block w-full">
        {cardContent}
      </Link>
      {authorContent}
    </div>
  );
}

// ── Carousel Prototype ────────────────────────────────────────────────────────
function TrendingCarousel({ posts }: { posts: any[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollRef.current || !scrollRef.current.children[0]) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const cardElement = scrollRef.current.children[0] as HTMLElement;
    const itemWidth = cardElement.offsetWidth + 12; // 12px for gap-3
    const index = Math.round(scrollLeft / itemWidth);
    setActiveIndex(index);
  };

  const scrollTo = (idx: number) => {
    if (!scrollRef.current || !scrollRef.current.children[0]) return;
    const cardElement = scrollRef.current.children[0] as HTMLElement;
    const itemWidth = cardElement.offsetWidth + 12;
    scrollRef.current.scrollTo({ left: itemWidth * idx, behavior: 'smooth' });
  };

  return (
    <div className="relative w-full mb-2">
      {/* Scrollable Container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 gap-3 -mx-4 px-4 sm:-mx-6 sm:px-6"
        style={{ scrollBehavior: 'smooth', scrollPaddingLeft: '16px' }}
      >
        {posts.map((post, index) => (
          <div key={post.id} className="w-[85vw] sm:w-[400px] flex-shrink-0 snap-start">
            <TrendingPostCard post={post} large rank={index + 1} />
          </div>
        ))}
        {/* Spacer to allow the last item to snap to start with right padding */}
        <div className="w-[15vw] sm:w-[20px] flex-shrink-0" />
      </div>
      
      {/* Pagination Dots */}
      <div className="flex justify-center gap-1.5 mt-1">
        {posts.map((_, idx) => (
          <button 
            key={idx}
            onClick={() => scrollTo(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === activeIndex ? "w-5 bg-[#F44444]" : "w-1.5 bg-[#d5d5d5] hover:bg-[#a3a3a3]"}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function TrendingPostsSkeleton() {
  return (
    <div className="p-3 space-y-2">
      <div className="w-full aspect-[16/9] rounded-xl bg-[#ebebeb] animate-pulse" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="aspect-square rounded-xl bg-[#ebebeb] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl border border-[#e5e5e5] bg-white animate-pulse">
      <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[#ebebeb] flex-shrink-0 ring-1 ring-[#e5e5e5]" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-28 bg-[#ebebeb] rounded" />
          <div className="h-3.5 w-3.5 bg-[#ebebeb] rounded-full" />
        </div>
        <div className="h-3 w-40 bg-[#ebebeb] rounded" />
      </div>
      <div className="hidden sm:block h-7 w-14 bg-[#ebebeb] rounded-full flex-shrink-0" />
      <div className="h-7 w-16 bg-[#ebebeb] rounded-full flex-shrink-0" />
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <div className="space-y-1.5 md:space-y-2">
      {Array.from({ length: 8 }).map((_, i) => <UserCardSkeleton key={i} />)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab]   = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, requireGuestAuth } = useContext(AuthContext);
  const [trendingTopics, setTrending]     = useState(fallbackTrending);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [useCarousel, setUseCarousel] = useState(false);

  useEffect(() => {
    if (isNative) setUseCarousel(true);
  }, []);

  // Server-ranked user feed state
  const [exploreUsers, setExploreUsers]     = useState<any[]>([]);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [exploreCursor, setExploreCursor]   = useState(0);
  const [exploreHasMore, setExploreHasMore] = useState(true);
  const inFlight = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const tabMode = TAB_MODE[exploreTabs[activeTab]] ?? "all";
  const subMode = SUB_MODE[exploreSubTabs[activeSubTab]] ?? "top";

  const loadFeed = useCallback((cursor = 0, tab: ExploreTab = "all", sub: ExploreSub = "top") => {
    const key = `${tab}:${sub}:${cursor}`;
    if (inFlight.current === key) return;
    inFlight.current = key;
    setExploreLoading(true);
    api.getExploreFeed(tab, sub, cursor, 20)
      .then(data => {
        const raw = data.users ?? [];
        if (cursor === 0) {
          setExploreUsers(raw);
        } else {
          setExploreUsers(prev => {
            const ids = new Set(prev.map((u: any) => u.id));
            return [...prev, ...raw.filter((u: any) => !ids.has(u.id))];
          });
        }
        setExploreCursor(data.nextCursor ?? cursor + 20);
        setExploreHasMore(data.hasMore ?? false);
      })
      .catch(() => {})
      .finally(() => { setExploreLoading(false); inFlight.current = null; });
  }, []);

  // Reload on tab or sub change
  useEffect(() => {
    const tab = TAB_MODE[exploreTabs[activeTab]] ?? "all";
    const sub = SUB_MODE[exploreSubTabs[activeSubTab]] ?? "top";
    setExploreUsers([]);
    setExploreCursor(0);
    setExploreHasMore(true);
    loadFeed(0, tab, sub);
  }, [activeTab, activeSubTab]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !exploreHasMore || exploreLoading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadFeed(exploreCursor, tabMode, subMode);
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [exploreCursor, exploreHasMore, exploreLoading, tabMode, subMode]);

  // Trending topics + trending posts (parallel)
  useEffect(() => {
    Promise.all([
      api.getTrending().catch(() => fallbackTrending),
      api.getExploreTrending(4).catch(() => ({ posts: [] })),
    ]).then(([topics, feed]) => {
      setTrending(topics);
      setTrendingPosts(feed.posts ?? []);
      setTrendingLoading(false);
    });
  }, []);

  const handleFollow = (userId: number) => {
    requireGuestAuth("follow", () => toggleFollow(userId));
  };

  // Client-side search filter (instant, no round-trip)
  const searchFiltered = searchQuery.trim()
    ? exploreUsers.filter(u => {
        const q = searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(q) ||
               u.handle.toLowerCase().includes(q) ||
               (u.title ?? "").toLowerCase().includes(q);
      })
    : exploreUsers;

  const filteredTrending = searchQuery.trim()
    ? trendingTopics.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : trendingTopics;

  return (
    <>
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto overflow-x-hidden">
        {/* Sticky header */}
        <div className="sticky top-0 bg-white z-30 pt-1 pb-2 md:pt-3 md:pb-3 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between">
            {showSearch ? (
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20"
                  />
                </div>
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                  className="p-2 hover:bg-[#f5f5f5] rounded-lg"
                >
                  <X className="w-5 h-5 text-[#737373]" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-[#0a0a0a]">Explore</h1>
                <button onClick={() => setShowSearch(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg">
                  <Search className="w-5 h-5 text-[#737373]" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pt-2 pb-6 flex flex-col gap-3 md:gap-4">
          {/* Stories — mobile/tablet only (hidden on native) */}
          {!isNative && (
            <div className="lg:hidden empty:hidden">
              <RecentStories />
            </div>
          )}

          {/* Trending Now — Instagram-style grid */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#F44444]" />
                <span className="text-xs font-semibold text-[#0a0a0a]">Trending Now</span>
              </div>
              <div className="flex items-center gap-3">
                {isNative && (
                  <button 
                    onClick={() => setUseCarousel(!useCarousel)}
                    className="text-[11px] font-medium px-2 py-1 rounded-md bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] transition-colors border border-[#e5e5e5]"
                  >
                    {useCarousel ? "Grid View" : "Carousel View"}
                  </button>
                )}
                <Link href="/" className="text-[13px] px-2 py-1 text-[#F44444] hover:bg-[#F44444]/10 rounded-md transition-colors">See all</Link>
              </div>
            </div>

            {/* Topic chips moved here */}
            {trendingLoading ? (
              <div className="flex gap-2 flex-wrap mb-3.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-7 w-20 rounded-full bg-[#ebebeb] animate-pulse" />
                ))}
              </div>
            ) : filteredTrending.length > 0 && !searchQuery.trim() && (
              <div className="flex gap-2 flex-wrap mb-3.5">
                {filteredTrending.slice(0, 6).map(topic => (
                  <Link
                    key={topic.id}
                    href={`/?filter=${encodeURIComponent(topic.name)}`}
                    className="px-3.5 py-1.5 rounded-full bg-[#f5f5f5] border border-transparent hover:border-[#F44444]/30 text-[12px] font-medium text-[#525252] hover:bg-[#F44444]/5 hover:text-[#F44444] transition-all"
                  >
                    {topic.name}
                  </Link>
                ))}
              </div>
            )}

            {trendingLoading ? (
              <TrendingPostsSkeleton />
            ) : (() => {
              const visible = trendingPosts.filter(p =>
                !searchQuery.trim() ||
                (p.title ?? p.content ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.tags?.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
              );
              if (visible.length === 0) {
                return (
                  <p className="text-[#a3a3a3] text-xs text-center py-6">
                    {searchQuery.trim() ? "No trending posts match your search." : "No trending posts right now."}
                  </p>
                );
              }
              
              const displayPosts = visible.slice(0, 4);
              if (useCarousel && isNative) {
                return <TrendingCarousel posts={displayPosts} />;
              }
              
              const [first, ...rest] = displayPosts;
              return (
                <div className="space-y-2">
                  {/* Featured — wide card */}
                  {first && <TrendingPostCard post={first} large />}
                  {/* Remaining — 3-column grid */}
                  {rest.length > 0 && (
                    <div className={`grid gap-2 ${rest.length === 1 ? "grid-cols-1" : rest.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {rest.map(post => (
                        <TrendingPostCard key={post.id} post={post} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>

          {/* Merged Main Tabs and Sub-tabs */}
          <div className="flex justify-center pt-2 mb-2">
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar pb-1 px-2">
              {exploreTabs.filter(tab => isSignedIn || tab !== "Followed").map(tab => (
                <button
                  key={`main-${tab}`}
                  onClick={() => setActiveTab(exploreTabs.indexOf(tab))}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                    exploreTabs.indexOf(tab) === activeTab
                      ? "bg-[#F44444] text-white"
                      : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
                  }`}
                >
                  {tab}
                </button>
              ))}
              
              <div className="w-px h-5 bg-[#d5d5d5] mx-1 flex-shrink-0" />
              
              {exploreSubTabs.map((tab, i) => (
                <button
                  key={`sub-${tab}`}
                  onClick={() => setActiveSubTab(i)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                    i === activeSubTab
                      ? "bg-[#F44444] text-white"
                      : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* User list */}
          <div className="space-y-1.5 md:space-y-2">
            {exploreUsers.length === 0 && exploreLoading ? (
              <ExploreSkeleton />
            ) : searchFiltered.length > 0 ? (
              searchFiltered.map((user, idx) => {
                const isFollowing = following.has(user.id) || user.isFollowing;
                const rank = user.rank ?? idx + 1;
                // Rank badges only on Top sub-tab — other orderings are chronological/filtered
                const showRank = activeSubTab === 0;
                return (
                  <Link
                    href={`/${user.handle}?from=${encodeURIComponent(pathname)}`}
                    key={user.id}
                    className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border transition-colors block w-full text-left ${
                      showRank && rank === 1
                        ? "border-[#F44444]/30 bg-[#FFF8F8]"
                        : "border-[#e5e5e5] bg-white hover:border-[#d5d5d5]"
                    }`}
                  >
                    <div 
                      className={`w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden flex-shrink-0 ${
                      user.hasStory
                        ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white"
                        : "ring-1 ring-[#e5e5e5]"
                    }`}>
                      {user.avatar
                        ? <Image src={user.avatar} alt={user.name} width={44} height={44} className="object-cover w-full h-full" />
                        : <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center text-[#737373] text-xs font-medium">{user.name.charAt(0).toUpperCase()}</div>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-nowrap">
                        <span className="font-medium text-[13px] md:text-sm text-[#0a0a0a] truncate">{user.name}</span>
                        {user.verified && <VerifiedBadge className="scale-90 flex-shrink-0" />}
                        {showRank && rank === 1 && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F44444] text-white text-[10px] font-bold tracking-wider shadow-sm flex-shrink-0 uppercase">
                            <AlbizLogo size={10} /> #1
                          </span>
                        )}
                        {showRank && rank === 2 && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f5f5f5] border border-[#d5d5d5] text-[#525252] text-[10px] font-bold tracking-wider flex-shrink-0 uppercase">
                            <AlbizLogo size={10} /> #2
                          </span>
                        )}
                        {showRank && rank === 3 && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f5f5f5] border border-[#e5e5e5] text-[#525252] text-[10px] font-bold tracking-wider flex-shrink-0 uppercase">
                            <AlbizLogo size={10} /> #3
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#737373] block truncate">{user.title}</span>
                      {user.mutualFollows > 0 && (
                        <span className="text-[10px] text-[#a3a3a3] flex items-center gap-1 mt-0.5">
                          <Users className="w-2.5 h-2.5" />
                          {user.mutualFollows} mutual {user.mutualFollows === 1 ? "follow" : "follows"}
                        </span>
                      )}
                    </div>

                    <div className="hidden sm:block px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] flex-shrink-0 text-center">
                      View
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFollow(user.id);
                      }}
                      className={`px-3 py-1 md:px-3.5 md:py-1.5 text-xs font-medium rounded-full transition-all flex-shrink-0 ${
                        isFollowing
                          ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]"
                          : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                      }`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </Link>
                );
              })
            ) : !exploreLoading ? (
              <p className="text-[#737373] text-sm text-center py-8">
                {searchQuery.trim()
                  ? "No people match your search."
                  : activeTab !== 0
                    ? `No people found in ${exploreTabs[activeTab]}.`
                    : "No people to show."}
              </p>
            ) : null}

            {/* Infinite scroll sentinel */}
            {exploreHasMore && !searchQuery.trim() && <div ref={sentinelRef} className="h-4" />}
            {exploreLoading && exploreUsers.length > 0 && (
              <div className="flex justify-center py-4">
                <div className="w-4 h-4 border-2 border-[#e5e5e5] border-t-[#F44444] rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </main>
      <RightSidebar />

    </>
  );
}
