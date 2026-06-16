"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Search, X, Filter, Heart, MessageCircle, MoreVertical, EyeOff, ArrowRight, Users, Loader2, Eye, Share2 } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { circleTabs } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, AlbizLogo, RightSidebar, SaveBookmarkButton } from "@/app/lib/shared-components";
import CreatePostModal from "@/app/components/CreatePostModal";
import { Share as CapacitorShare } from '@capacitor/share';
import { Toast } from '@capacitor/toast';

// These tabs show the post feed — all others show ranked member lists
const FEED_TABS = new Set(["For You", "Following", "Trending"]);
const TAB_MODE: Record<string, "for-you" | "following" | "trending"> = {
  "For You": "for-you", "Following": "following", "Trending": "trending",
};

// ── Skeletons ──────────────────────────────────────────────────────────────────

function PostCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#ebebeb] flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-32 bg-[#ebebeb] rounded" />
          <div className="h-3 w-24 bg-[#ebebeb] rounded" />
        </div>
        <div className="w-6 h-6 bg-[#ebebeb] rounded" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3.5 w-full bg-[#ebebeb] rounded" />
        <div className="h-3.5 w-[85%] bg-[#ebebeb] rounded" />
        <div className="h-3.5 w-[60%] bg-[#ebebeb] rounded" />
      </div>
      <div className="flex gap-4 pt-2 border-t border-[#f0f0f0]">
        <div className="h-3 w-10 bg-[#ebebeb] rounded" />
        <div className="h-3 w-10 bg-[#ebebeb] rounded" />
      </div>
    </div>
  );
}

function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-[#ebebeb] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-28 bg-[#ebebeb] rounded" />
        <div className="h-3 w-36 bg-[#ebebeb] rounded" />
      </div>
      <div className="h-7 w-14 bg-[#ebebeb] rounded-full" />
      <div className="h-7 w-16 bg-[#ebebeb] rounded-full" />
    </div>
  );
}

function CircleSkeleton({ isFeed }: { isFeed: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) =>
        isFeed ? <PostCardSkeleton key={i} /> : <MemberRowSkeleton key={i} />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RankBadge({ rank, showRank }: { rank?: number; showRank: boolean }) {
  if (!rank || !showRank || rank > 3) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold flex-shrink-0">
      <AlbizLogo size={10} /> #{rank}
    </span>
  );
}

function MemberAvatar({ member, size = 40 }: { member: any; size?: number }) {
  if (member.avatar) {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]"
        style={{ width: size, height: size }}
      >
        <Image src={member.avatar} alt={member.name} width={size} height={size} className="object-cover w-full h-full" />
      </div>
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, backgroundColor: member.initialBg, fontSize: size * 0.4 }}
    >
      {member.initial}
    </div>
  );
}

function CirclePostCard({ item, onRemove, showRank }: { item: any; onRemove: (id: number) => void; showRank: boolean }) {
  const { isSignedIn, openAuthModal, currentUserId } = useContext(AuthContext);
  const [liked, setLiked] = useState(item.liked ?? false);
  const [likeCount, setLikeCount] = useState(item.stats?.likes ?? "0");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const member = item.member;

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/?post=${item.id}` : "";
    try {
      const title = item.title || "Circle post";
      await CapacitorShare.share({ title, url });
      Toast.show({ text: "Post shared" });
    } catch (e) {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => { });
      }
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  if (!member) return null;

  const handleLike = () => {
    if (!isSignedIn) { openAuthModal("signup"); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    api.likePost(item.id, newLiked ? "like" : "unlike")
      .then((res: any) => { if (res.likes) setLikeCount(res.likes); })
      .catch(() => { });
  };

  const isArticle = item.type === "article";

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5] transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <MemberAvatar member={member} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-wrap">
              <Link href={`/${member.handle}`} className="font-medium text-sm text-[#0a0a0a] hover:underline">{member.name}</Link>
              {member.verified && <VerifiedBadge className="scale-90" />}
              <RankBadge rank={member.rank} showRank={showRank} />
            </div>
            <div className="relative flex-shrink-0">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg">
                <MoreVertical className="w-4 h-4 text-[#737373]" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1.5 z-20 min-w-[160px]" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setMenuOpen(false); onRemove(item.id); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] flex items-center gap-2.5">
                    <EyeOff className="w-3.5 h-3.5" /> Not interested
                  </button>
                </div>
              )}
            </div>
          </div>
          <span className="text-xs text-[#737373]">{member.title}</span>
          {item.reason && (
            <span className="text-[10px] text-[#a3a3a3] block mt-0.5">{item.reason}</span>
          )}
        </div>
      </div>

      {isArticle && item.title && (
        <p className="font-semibold text-[#0a0a0a] mb-1 text-sm">{item.title}</p>
      )}
      {item.content && (
        <div
          className="text-sm text-[#262626] mb-3 line-clamp-4"
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
      )}
      {item.image && (
        <div className="rounded-xl overflow-hidden mb-3 bg-[#f5f5f5]">
          <Image
            src={item.image}
            alt=""
            width={800}
            height={600}
            style={{ width: "100%", height: "auto" }}
            sizes="(max-width: 640px) 100vw, 560px"
          />
        </div>
      )}
      {item.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {item.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-[10px] text-[#F44444] px-1.5 py-0.5 rounded-full bg-[#FFF0F0]">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
        <div className="flex items-center gap-4 text-[#737373] text-xs">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {item.stats?.views ?? "0"}
          </span>
          <button onClick={handleLike} className={`flex items-center gap-1 transition-colors ${liked ? "text-[#F44444]" : "hover:text-[#525252]"}`}>
            <Heart className={`w-3.5 h-3.5 ${liked ? "fill-[#F44444]" : ""}`} />
            {likeCount}
          </button>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" />
            {item.stats?.comments ?? "0"}
          </span>
          <button onClick={handleShare} className="flex items-center gap-1 text-[#737373] hover:text-[#525252] transition-colors" title={copied ? "Copied!" : "Share"}>
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <SaveBookmarkButton postId={item.id} />
      </div>
    </div>
  );
}

function CircleProfileRow({ member, showRank, pathname }: { member: any; showRank: boolean; pathname: string }) {
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal } = useContext(AuthContext);
  const isFollowing = following.has(member.id) || member.isFollowing;

  const handleFollow = () => {
    if (!isSignedIn) { openAuthModal("signup", "Sign up to follow this user"); return; }
    toggleFollow(member.id);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#fafafa] transition-colors">
      <MemberAvatar member={member} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-medium text-sm text-[#0a0a0a] truncate">{member.name}</span>
          {member.verified && <VerifiedBadge className="scale-90" />}
          <RankBadge rank={member.rank} showRank={showRank} />
        </div>
        <span className="text-xs text-[#737373] block truncate">{member.title}</span>
        {member.reason ? (
          <span className="text-[10px] text-[#a3a3a3] block mt-0.5 truncate">{member.reason}</span>
        ) : member.mutualFollows > 0 ? (
          <span className="text-[10px] text-[#a3a3a3] flex items-center gap-1 mt-0.5">
            <Users className="w-2.5 h-2.5" />
            {member.mutualFollows} mutual {member.mutualFollows === 1 ? "follow" : "follows"}
          </span>
        ) : null}
      </div>
      <Link href={`/${member.handle}?from=${encodeURIComponent(pathname)}`} className="hidden sm:block px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5] flex-shrink-0">View</Link>
      <button onClick={handleFollow} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex-shrink-0 ${isFollowing ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}


function NormalUserBanner() {
  return (
    <div className="mb-4 rounded-xl border border-[#e5e5e5] px-4 py-3 flex items-center justify-between gap-3 bg-[#fafafa]">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#0a0a0a]">Apply for Circle</p>
        <p className="text-[11px] text-[#737373] truncate">Get verified and join the top business network</p>
      </div>
      <button onClick={() => window.dispatchEvent(new CustomEvent("albiz-circle-upgrade"))} className="flex items-center gap-1 text-xs text-[#F44444] font-medium whitespace-nowrap hover:underline flex-shrink-0">
        Learn more <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CirclePage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  const [showCreatePost, setShowCreatePost] = useState(false);

  const { following } = useContext(FollowingContext);
  const { isSignedIn, userRole, openAuthModal, currentUserId, userProfile } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const isNormal = userRole === "NORMAL" || userRole === "AUTHOR";

  // Server-ranked feed (For You / Following / Trending tabs)
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedCursor, setFeedCursor] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const inFlight = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Member data (Explore / Founders / Companies tabs — global score)
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  // Suggested tab — personalized, separate fetch with affinity + interest signals
  const [suggested, setSuggested] = useState<any[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [suggestedLoaded, setSuggestedLoaded] = useState(false);

  const visibleTabs = circleTabs.filter(tab => isSignedIn || tab !== "Following");
  const tabName = visibleTabs[activeTab] ?? visibleTabs[0];
  const isFeedTab = FEED_TABS.has(tabName);
  const feedMode = TAB_MODE[tabName] ?? "for-you";

  // Rank badges only on Explore tab, only for top 3
  const showRank = tabName === "Explore";

  useEffect(() => { setActiveTab(0); }, [isSignedIn]);
  useEffect(() => { setFilterCategory(""); }, [activeTab]);

  // Close filter on outside click
  useEffect(() => {
    if (!showFilter) return;
    const h = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showFilter]);

  // Load global member list once (Explore / Founders / Companies)
  useEffect(() => {
    setMembersLoading(true);
    api.getCircleMembers("explore")
      .then(data => setMembers(data))
      .catch(() => { })
      .finally(() => setMembersLoading(false));
  }, []);

  // Load suggested members when Suggested tab is first opened
  useEffect(() => {
    if (tabName !== "Suggested" || suggestedLoaded) return;
    setSuggestedLoading(true);
    api.getCircleMembers("suggested")
      .then(data => { setSuggested(data); setSuggestedLoaded(true); })
      .catch(() => { })
      .finally(() => setSuggestedLoading(false));
  }, [tabName]);

  // Feed loading
  const loadFeed = useCallback((cursor = 0, mode: "for-you" | "following" | "trending" = "for-you") => {
    const key = `${mode}:${cursor}`;
    if (inFlight.current === key) return;
    inFlight.current = key;
    setFeedLoading(true);
    api.getCircleFeed(mode, cursor, 20)
      .then(data => {
        const raw = (data.items ?? []).filter((item: any) => !removedIds.has(item.id));
        if (cursor === 0) {
          setFeedItems(raw);
        } else {
          setFeedItems(prev => {
            const ids = new Set(prev.map((p: any) => p.id));
            return [...prev, ...raw.filter((p: any) => !ids.has(p.id))];
          });
        }
        setFeedCursor(data.nextCursor ?? cursor + 20);
        setFeedHasMore(data.hasMore ?? false);
      })
      .catch(() => { })
      .finally(() => { setFeedLoading(false); inFlight.current = null; });
  }, [removedIds]);

  // Reload feed on tab change
  useEffect(() => {
    if (!isFeedTab) return;
    setFeedItems([]);
    setFeedCursor(0);
    setFeedHasMore(true);
    loadFeed(0, feedMode);
  }, [activeTab]);

  // Infinite scroll
  useEffect(() => {
    if (!isFeedTab || !sentinelRef.current || !feedHasMore || feedLoading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadFeed(feedCursor, feedMode);
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [feedCursor, feedHasMore, feedLoading, isFeedTab, feedMode]);

  // Member list per tab — Suggested uses its own server-ranked slice
  const getDisplayMembers = () => {
    // Suggested uses dedicated personalized fetch
    if (tabName === "Suggested") {
      let list = [...suggested];
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(m => m.name.toLowerCase().includes(q) || (m.title ?? "").toLowerCase().includes(q));
      }
      return list;
    }

    let list = [...members];

    switch (tabName) {
      case "Trending":
        list = list.sort((a, b) => (b.velocityScore ?? 0) - (a.velocityScore ?? 0));
        break;
      case "Following":
        list = list.filter(m => following.has(m.id) || m.isFollowing)
          .sort((a, b) => (b.mutualFollows ?? 0) - (a.mutualFollows ?? 0) || b.score - a.score);
        break;
      case "Suggested":
        // fallback (should not reach here)
        list = list.filter(m => !following.has(m.id) && !m.isFollowing)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
        break;
      case "Founders":
        // Individual people (not companies), sorted by full score
        list = list.filter(m => !m.isCompany)
          .sort((a, b) => b.score - a.score);
        break;
      case "Companies":
        // Company accounts only, sorted by full score
        list = list.filter(m => m.isCompany)
          .sort((a, b) => b.score - a.score);
        break;
      default: // Explore — all members, full score
        list = list.sort((a, b) => b.score - a.score);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || (m.title ?? "").toLowerCase().includes(q));
    }

    // Category dropdown filter
    if (filterCategory) {
      list = list.filter(m => {
        const title = (m.title ?? "").toLowerCase();
        switch (filterCategory) {
          case "creators": return title.includes("creator") || title.includes("founder");
          case "investor": return title.includes("investor") || title.includes("entrepreneur");
          case "ceo": return title.includes("ceo");
          case "other": return !title.includes("creator") && !title.includes("founder") && !title.includes("investor") && !title.includes("entrepreneur") && !title.includes("ceo");
          case "followed": return following.has(m.id) || m.isFollowing;
          default: return true;
        }
      });
    }

    return list;
  };

  const displayMembers = getDisplayMembers();

  // Feed search filter
  const displayFeedItems = searchQuery.trim()
    ? feedItems.filter(item =>
      item.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.member?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : feedItems.filter(item => !removedIds.has(item.id));

  const handleRemove = useCallback((id: number) => {
    setRemovedIds(prev => new Set([...prev, id]));
  }, []);

  const handlePostCreated = useCallback(() => {
    setShowCreatePost(false);
    setFeedItems([]);
    setFeedCursor(0);
    setFeedHasMore(true);
    loadFeed(0, feedMode);
  }, [feedMode, loadFeed]);

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-4">
            {showSearch ? (
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search circle..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); } }}
                    autoFocus
                    className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20"
                  />
                </div>
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg">
                  <X className="w-5 h-5 text-[#737373]" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-[#0a0a0a]">Circle</h1>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowSearch(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg">
                    <Search className="w-5 h-5 text-[#737373]" />
                  </button>
                  {!isFeedTab && (
                    <div className="relative" ref={filterRef}>
                      <button onClick={() => setShowFilter(!showFilter)} className={`p-2 rounded-lg relative ${showFilter ? "bg-[#f5f5f5]" : "hover:bg-[#f5f5f5]"}`}>
                        <Filter className="w-5 h-5 text-[#737373]" />
                        {filterCategory && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F44444]" />}
                      </button>
                      {showFilter && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-2 z-30">
                          <div className="px-3 py-2 text-xs text-[#737373] font-medium border-b border-[#f0f0f0] mb-1">Filter by</div>
                          {["", "creators", "investor", "ceo", "other"].map(cat => (
                            <button key={cat} onClick={() => { setFilterCategory(cat); setShowFilter(false); }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#f5f5f5] ${filterCategory === cat ? "text-[#0a0a0a] font-medium" : "text-[#737373]"}`}>
                              <span>{cat === "" ? "All" : cat === "creators" ? "Creators" : cat === "investor" ? "Investor & Entrepreneur" : cat === "ceo" ? "CEO" : "Other"}</span>
                              {filterCategory === cat && cat !== "" && <span className="w-1.5 h-1.5 rounded-full bg-[#F44444]" />}
                            </button>
                          ))}
                          {isSignedIn && (
                            <button onClick={() => { setFilterCategory("followed"); setShowFilter(false); }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#f5f5f5] ${filterCategory === "followed" ? "text-[#0a0a0a] font-medium" : "text-[#737373]"}`}>
                              <span>Followed</span>
                              {filterCategory === "followed" && <span className="w-1.5 h-1.5 rounded-full bg-[#F44444]" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {visibleTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-3">
          {isNormal && <NormalUserBanner />}


          {/* Feed tabs — For You / Following / Trending */}
          {isFeedTab ? (
            <>
              {feedItems.length === 0 && feedLoading ? (
                <CircleSkeleton isFeed />
              ) : displayFeedItems.length > 0 ? (
                displayFeedItems.map(item => (
                  <CirclePostCard key={item.id} item={item} onRemove={handleRemove} showRank={false} />
                ))
              ) : !feedLoading ? (
                <p className="text-[#737373] text-sm text-center py-8">
                  {searchQuery.trim() ? "No posts match your search." : tabName === "Following" ? "Follow Circle members to see their posts here." : "No posts to show."}
                </p>
              ) : null}
              {feedHasMore && <div ref={sentinelRef} className="h-4" />}
              {feedLoading && feedItems.length > 0 && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" />
                </div>
              )}
            </>
          ) : (
            /* Member-list tabs — Explore / Suggested / Founders / Companies / Following */
            <div className="space-y-1">
              {(tabName === "Suggested" ? suggestedLoading : membersLoading) ? (
                <CircleSkeleton isFeed={false} />
              ) : displayMembers.length > 0 ? (
                displayMembers.map(m => (
                  <CircleProfileRow key={m.id} member={m} showRank={showRank} pathname={pathname} />
                ))
              ) : (
                <p className="text-[#737373] text-sm text-center py-8">
                  {tabName === "Following" ? "You're not following any Circle members yet."
                    : tabName === "Suggested" ? "No new people to suggest right now."
                      : tabName === "Companies" ? "No company Circle accounts found."
                        : searchQuery.trim() ? "No members match your search."
                          : filterCategory ? "No members found."
                            : "No members to show."}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
      <RightSidebar />

      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPosted={handlePostCreated}
      />
    </>
  );
}
