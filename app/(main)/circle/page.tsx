"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Search, X, Filter, ThumbsUp, MessageCircle, MoreVertical, EyeOff, Lock, ArrowRight } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { circleMembers as fallbackMembers, circlePosts as fallbackCirclePosts, circleTabs } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, AlbizLogo, RightSidebar } from "@/app/lib/shared-components";

function RankBadge({ rank }: { rank?: number }) {
  if (!rank) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold">
      <AlbizLogo size={12} /> #{String(rank).padStart(2, "0")}
    </span>
  );
}

function CircleProfileRow({ member, showRank = true, pathname }: { member: any; showRank?: boolean; pathname?: string }) {
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal } = useContext(AuthContext);
  const isFollowing = following.has(member.id);

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(member.id);
  };

  return (
    <Link href={`/${member.handle}?_customDomain=1`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#fafafa] transition-colors group w-full text-left">
      {member.hasInitial ? (
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white text-lg font-bold" style={{ backgroundColor: member.initialBg }}>
          {member.initial}
        </div>
      ) : (
        <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
          <Image src={member.avatar} alt={member.name} width={44} height={44} className="object-cover w-full h-full" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-medium text-sm text-[#0a0a0a]">{member.name}</span>
          {member.verified && <VerifiedBadge className="scale-90" />}
          {showRank && <RankBadge rank={member.rank} />}
        </div>
        <span className="text-xs text-[#737373] block truncate">{member.title}</span>
      </div>
      <Link href={`/${member.handle}?from=${encodeURIComponent(pathname || '/')}`} className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5] flex-shrink-0 transition-colors">View</Link>
      <button
        onClick={handleFollow}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex-shrink-0 ${isFollowing ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </Link>
  );
}

function CirclePostCard({ post, member }: { post: any; member: any }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5] transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/${member.handle}?_customDomain=1`} className="flex items-center gap-3 flex-1 min-w-0 group cursor-pointer hover:opacity-80 transition-opacity">
          {member.hasInitial ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold" style={{ backgroundColor: member.initialBg }}>
              {member.initial}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
              <Image src={member.avatar} alt={member.name} width={40} height={40} className="object-cover w-full h-full" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm text-[#0a0a0a] group-hover:underline">{member.name}</span>
              {member.verified && <VerifiedBadge className="scale-90" />}
              <RankBadge rank={member.rank} />
            </div>
          </div>
        </Link>
        <div className="relative flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <MoreVertical className="w-4 h-4 text-[#737373]" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1.5 z-20 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150" onClick={e => e.stopPropagation()}>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] flex items-center gap-2.5 transition-colors">
                <EyeOff className="w-3.5 h-3.5" /> Not interested
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-[#262626] mb-3">{post.content}</p>
      {post.image && (
        <div className="rounded-xl overflow-hidden mb-3">
          <Image src={post.image} alt="" width={800} height={400} className="object-cover w-full" />
        </div>
      )}
      <div className="flex items-center gap-4 text-[#737373] text-xs">
        <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {post.stats.likes}</span>
        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.stats.comments}</span>
      </div>
    </div>
  );
}

function AnonGate({ members }: { members: any[] }) {
  const { openAuthModal } = useContext(AuthContext);
  return (
    <div>
      <div className="space-y-1 pointer-events-none select-none">
        {members.slice(0, 4).map(member => (
          <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl">
            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
              {member.avatar ? (
                <Image src={member.avatar} alt={member.name} width={44} height={44} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg rounded-full" style={{ backgroundColor: member.initialBg || "#F44444" }}>
                  {member.initial || member.name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm text-[#0a0a0a]">{member.name}</span>
                {member.verified && <VerifiedBadge className="scale-90" />}
              </div>
              <span className="text-xs text-[#737373] block truncate">{member.title}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-2xl border border-[#e5e5e5] p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-[#FFF0F0] flex items-center justify-center mx-auto mb-3">
          <Lock className="w-4 h-4 text-[#F44444]" />
        </div>
        <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Sign in to explore Circle</p>
        <p className="text-xs text-[#a3a3a3] mb-4">Follow top founders, investors and companies. Get access to exclusive posts and insights.</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => openAuthModal("signin")} className="px-4 py-2 bg-[#F44444] text-white text-xs font-medium rounded-full hover:bg-[#d64d3c] transition-colors">Sign in</button>
          <button onClick={() => openAuthModal("signup")} className="px-4 py-2 border border-[#e5e5e5] text-[#525252] text-xs font-medium rounded-full hover:bg-[#fafafa] transition-colors">Sign up</button>
        </div>
      </div>
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
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("albiz-circle-upgrade"))}
        className="flex items-center gap-1 text-xs text-[#F44444] font-medium whitespace-nowrap hover:underline flex-shrink-0"
      >
        Learn more <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function CirclePage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFilter) return;
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFilter]);
  const { following } = useContext(FollowingContext);
  const { isSignedIn, userRole, openAuthModal } = useContext(AuthContext);
  const [circleMembers, setCircleMembers] = useState(fallbackMembers);
  const [circlePosts, setCirclePosts] = useState(fallbackCirclePosts);

  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const isNormal = userRole === "NORMAL" || userRole === "AUTHOR";

  const visibleTabs = circleTabs.filter(tab => {
    if (!isSignedIn) return tab !== "Following";
    return true;
  });

  const tabName = visibleTabs[activeTab] ?? visibleTabs[0];

  useEffect(() => {
    setActiveTab(0);
  }, [isSignedIn]);

  useEffect(() => {
    setFilterCategory("");
  }, [activeTab]);

  useEffect(() => {
    Promise.all([api.getCircleMembers(), api.getCirclePosts()])
      .then(([m, p]) => { setCircleMembers(m); setCirclePosts(p); })
      .catch(() => { });
  }, []);

  const isFeedTab = tabName === "For You";

  const getFilteredMembers = () => {
    switch (tabName) {
      case "Founders": return circleMembers.filter(m => !m.hasInitial);
      case "Companies": return circleMembers.filter(m => m.hasInitial);
      case "My Circle": return circleMembers.slice(0, 5);
      case "Suggested": return circleMembers.slice(5, 15);
      case "Explore": return circleMembers;
      default: return circleMembers;
    }
  };

  const filteredMembers = getFilteredMembers();

  const searchFilteredMembers = filteredMembers.filter(member => {
    const matchesSearch = searchQuery.trim()
      ? member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    let matchesCategory = true;
    if (filterCategory) {
      const title = member.title.toLowerCase();
      switch (filterCategory) {
        case "creators": matchesCategory = title.includes("creator") || title.includes("founder"); break;
        case "investor": matchesCategory = title.includes("investor") || title.includes("entrepreneur"); break;
        case "ceo": matchesCategory = title.includes("ceo"); break;
        case "other":
          matchesCategory = !title.includes("creator") && !title.includes("founder") &&
            !title.includes("investor") && !title.includes("entrepreneur") && !title.includes("ceo");
          break;
        case "followed": matchesCategory = following.has(member.id); break;
      }
    }
    return matchesSearch && matchesCategory;
  });

  const searchFilteredPosts = searchQuery.trim()
    ? circlePosts.filter(post => post.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : circlePosts;

  const displayMembers = tabName === "Following"
    ? searchFilteredMembers.filter(m => following.has(m.id))
    : searchFilteredMembers;

  const feedItems: Array<{ type: "post"; post: any; member: any } | { type: "profile"; member: any }> = [];
  if (isFeedTab) {
    const memberResults = searchQuery.trim()
      ? searchFilteredMembers.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      : searchFilteredMembers;

    searchFilteredPosts.forEach((post, i) => {
      const member = circleMembers.find(m => m.id === post.memberId);
      if (member) feedItems.push({ type: "post", post, member });
      if (!searchQuery.trim() && tabName === "For You" && i % 2 === 1 && memberResults[i]) {
        feedItems.push({ type: "profile", member: memberResults[i] });
      }
    });

    // When searching, append matching member cards after posts
    if (searchQuery.trim() && tabName === "For You") {
      memberResults.forEach(m => feedItems.push({ type: "profile", member: m }));
    }
  }

  const availableTabs = circleTabs
    .filter(tab => isSignedIn || tab !== "Following")
    .filter(tab => {
      if (tab === "My Circle") {
        return userRole === "CIRCLE" || userRole === "ADMIN" || userRole === "AUTHOR";
      }
      return true;
    });

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
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
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
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
                      <button onClick={() => setShowFilter(!showFilter)} className={`p-2 rounded-lg transition-colors relative ${showFilter ? "bg-[#f5f5f5]" : "hover:bg-[#f5f5f5]"}`}>
                        <Filter className="w-5 h-5 text-[#737373]" />
                        {filterCategory && (
                          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F44444]" />
                        )}
                      </button>
                      {showFilter && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-2 z-30">
                          <div className="px-3 py-2 text-xs text-[#737373] font-medium border-b border-[#f0f0f0] mb-1">Filter by</div>
                          {["", "creators", "investor", "ceo", "other"].map((cat) => (
                            <button key={cat} onClick={() => { setFilterCategory(cat); setShowFilter(false); }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#f5f5f5] ${filterCategory === cat ? "text-[#0a0a0a] font-medium" : "text-[#737373]"}`}>
                              <span>{cat === "" ? "All" : cat === "creators" ? "Creators" : cat === "investor" ? "Investor & Entrepreneur" : cat === "ceo" ? "CEO" : "Other"}</span>
                              {filterCategory === cat && cat !== "" && <span className="w-1.5 h-1.5 rounded-full bg-[#F44444] flex-shrink-0" />}
                            </button>
                          ))}
                          {isSignedIn && (
                            <button onClick={() => { setFilterCategory("followed"); setShowFilter(false); }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#f5f5f5] ${filterCategory === "followed" ? "text-[#0a0a0a] font-medium" : "text-[#737373]"}`}>
                              <span>Followed</span>
                              {filterCategory === "followed" && <span className="w-1.5 h-1.5 rounded-full bg-[#F44444] flex-shrink-0" />}
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
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-3">
          {isFeedTab ? (
            feedItems.length > 0 ? feedItems.map((item, i) =>
              item.type === "post" ? (
                <CirclePostCard key={`post-${i}`} post={item.post} member={item.member} />
              ) : (
                <CircleProfileRow key={`profile-${i}`} member={item.member} pathname={pathname} />
              )
            ) : (
              <p className="text-[#737373] text-sm text-center py-8">
                {searchQuery.trim() ? "No posts match your search." : "No posts to show."}
              </p>
            )
          ) : (
            <div className="space-y-1">
              {displayMembers.length > 0 ? displayMembers.map(member => (
                <CircleProfileRow key={member.id} member={member} pathname={pathname} />
              )) : (
                <p className="text-[#737373] text-sm text-center py-8">
                  {tabName === "Following" ? "You're not following any Circle members yet." : searchQuery.trim() ? "No members match your search." : filterCategory ? `No members found.` : "No members to show."}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
