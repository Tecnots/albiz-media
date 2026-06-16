"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Search, X, Users, Eye, Heart, TrendingUp } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { exploreTabs, exploreSubTabs, trendingTopics as fallbackTrending } from "@/app/lib/data";
import { VerifiedBadge, AlbizLogo, RightSidebar, RecentStories } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";

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

function TrendingPostCard({ post, large = false }: { post: any; large?: boolean }) {
  const title  = post.title || post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || "";
  const tag    = post.tags?.[0] ?? null;
  const views  = post.stats?.views ?? "0";
  const likes  = post.stats?.likes ?? "0";
  const author = post.user?.name ?? "";
  const href   = post.type === "article" ? `/?article=${post.id}` : `/?post=${post.id}`;
  const hasImg = !!post.image;

  return (
    <Link href={href} className="block group">
      <div
        className={`relative w-full rounded-xl overflow-hidden ${large ? "aspect-[16/9]" : "aspect-square"}`}
        style={!hasImg ? { background: getTagBg(post.tags ?? []) } : undefined}
      >
        {hasImg ? (
          <Image
            src={post.image}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-end p-3">
            <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3 drop-shadow">
              {title}
            </p>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Overlay: title (images only) + stats */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          {hasImg && (
            <p className="text-white text-[11px] font-medium leading-snug line-clamp-2 mb-1.5 drop-shadow">
              {title}
            </p>
          )}
          <div className="flex items-center justify-between">
            {tag ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm truncate max-w-[80px]">
                {tag}
              </span>
            ) : <span />}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-[10px] text-white/80">
                <Eye className="w-2.5 h-2.5" />{views}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-white/80">
                <Heart className="w-2.5 h-2.5" />{likes}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Author row below card */}
      {author && (
        <div className="flex items-center gap-1 mt-1 px-0.5">
          {post.user?.avatar && (
            <div className="w-3.5 h-3.5 rounded-full overflow-hidden flex-shrink-0">
              <Image src={post.user.avatar} alt={author} width={14} height={14} className="object-cover" />
            </div>
          )}
          <span className="text-[11px] text-[#737373] truncate">{author}</span>
        </div>
      )}
    </Link>
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
  const { isSignedIn, openAuthModal } = useContext(AuthContext);
  const [trendingTopics, setTrending]     = useState(fallbackTrending);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

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
    if (!isSignedIn) { openAuthModal("signup", "Sign up to follow this user"); return; }
    toggleFollow(userId);
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
        <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-4">
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

          {/* Main tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {exploreTabs.filter(tab => isSignedIn || tab !== "Followed").map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(exploreTabs.indexOf(tab))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  exploreTabs.indexOf(tab) === activeTab
                    ? "bg-[#F44444] text-white"
                    : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 md:pt-4 pb-6 space-y-4 md:space-y-5">
          {/* Stories — mobile/tablet only */}
          <div className="lg:hidden">
            <RecentStories />
          </div>

          {/* Trending Now — Instagram-style grid */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#F44444]" />
                <span className="text-xs font-semibold text-[#0a0a0a]">Trending Now</span>
              </div>
              <Link href="/" className="text-[11px] text-[#F44444] hover:underline">See all</Link>
            </div>

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
              const [first, ...rest] = visible;
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

            {/* Topic chips */}
            {filteredTrending.length > 0 && !searchQuery.trim() && (
              <div className="flex gap-1.5 flex-wrap mt-2.5">
                {filteredTrending.slice(0, 6).map(topic => (
                  <Link
                    key={topic.id}
                    href={`/?filter=${encodeURIComponent(topic.name)}`}
                    className="px-2 py-0.5 rounded-full bg-[#f5f5f5] text-[11px] text-[#525252] hover:bg-[#ebebeb] transition-colors"
                  >
                    {topic.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 md:gap-1.5">
            {exploreSubTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(i)}
                className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  i === activeSubTab
                    ? "bg-[#F44444] text-white"
                    : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
                }`}
              >
                {tab}
              </button>
            ))}
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
                  <div
                    key={user.id}
                    className={`flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl border transition-colors ${
                      showRank && rank === 1
                        ? "border-[#F44444]/30 bg-[#FFF8F8]"
                        : "border-[#e5e5e5] bg-white hover:border-[#d5d5d5]"
                    }`}
                  >
                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden flex-shrink-0 ${
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
                          <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold flex-shrink-0">
                            <AlbizLogo size={10} /> #1
                          </span>
                        )}
                        {showRank && rank === 2 && (
                          <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#f5f5f5] text-[#525252] text-[10px] font-semibold flex-shrink-0">
                            <AlbizLogo size={10} /> #2
                          </span>
                        )}
                        {showRank && rank === 3 && (
                          <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#f5f5f5] text-[#525252] text-[10px] font-semibold flex-shrink-0">
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

                    <Link
                      href={`/${user.handle}?from=${encodeURIComponent(pathname)}`}
                      className="hidden sm:block px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] flex-shrink-0"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleFollow(user.id)}
                      className={`px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-medium rounded-full transition-all flex-shrink-0 ${
                        isFollowing
                          ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]"
                          : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                      }`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>
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
