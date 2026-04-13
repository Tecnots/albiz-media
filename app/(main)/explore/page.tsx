"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import { Search, Filter, X } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, exploreTabs, exploreSubTabs, trendingTopics as fallbackTrending } from "@/app/lib/data";
import { VerifiedBadge, AlbizLogo, RightSidebar, RecentStories } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal } = useContext(AuthContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [trendingTopics, setTrending] = useState(fallbackTrending);

  const handleFollow = (userId: number) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(userId);
  };

  useEffect(() => {
    Promise.all([api.getUsers(), api.getTrending()])
      .then(([u, t]) => { setUsers(u); setTrending(t); })
      .catch(() => {});
  }, []);

  const featuredPeople = users.slice(1, 6);

  // Filter users and trending topics based on search query and active tab
  const filteredUsers = users.filter(user => {
    // Apply search query filter
    const matchesSearch = searchQuery.trim()
      ? user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    // Apply tab filter based on title
    let matchesTab = true;
    const tab = exploreTabs[activeTab];
    if (tab) {
      const title = user.title.toLowerCase();
      switch (tab) {
        case "All":
          matchesTab = true;
          break;
        case "Creators":
          matchesTab = title.includes("creator") || title.includes("founder");
          break;
        case "Investor & Entrepreneur":
          matchesTab = title.includes("investor") || title.includes("entrepreneur");
          break;
        case "CEO":
          matchesTab = title.includes("ceo");
          break;
        case "Other":
          matchesTab = !title.includes("creator") && 
                       !title.includes("founder") && 
                       !title.includes("investor") && 
                       !title.includes("entrepreneur") && 
                       !title.includes("ceo");
          break;
        case "Followed":
          matchesTab = following.has(user.id);
          break;
      }
    }

    return matchesSearch && matchesTab;
  });

  // Limit to top 5 users when not searching or filtering
  const displayedUsers = (searchQuery.trim() || activeTab !== 0) ? filteredUsers : filteredUsers.slice(1, 6);

  const filteredTrending = searchQuery.trim()
    ? trendingTopics.filter(topic => {
        const query = searchQuery.toLowerCase();
        return topic.name.toLowerCase().includes(query);
      })
    : trendingTopics;

  return (
    <>
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-2.5 md:py-4 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-2.5 md:mb-4">
            {showSearch ? (
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Search explore..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus className="w-full pl-9 pr-4 py-1.5 md:py-2 rounded-full bg-[#f5f5f5] text-[13px] md:text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
                </div>
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><X className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" /></button>
              </div>
            ) : (
              <>
                <h1 className="text-lg md:text-xl font-semibold">Explore</h1>
                <div className="flex items-center gap-1 md:gap-2">
                  <button onClick={() => setShowSearch(true)} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" /></button>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-1 md:gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {exploreTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="pt-3 md:pt-4 pb-6 space-y-4 md:space-y-5">
          {/* Stories row — visible on mobile/tablet, hidden on lg+ where RightSidebar shows them */}
          <div className="lg:hidden">
            <RecentStories />
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-2 md:mb-3">Trending Now</p>
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 -mx-3 px-3 md:-mx-4 md:px-4">
              {filteredTrending.length > 0 ? filteredTrending.map(topic => (
                <div key={topic.id} className="flex items-center gap-2.5 md:gap-3 min-w-[160px] md:min-w-[180px] p-2.5 md:p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors cursor-pointer flex-shrink-0">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={topic.image} alt={topic.name} width={40} height={40} className="object-cover w-full h-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] md:text-sm font-medium text-[#0a0a0a] truncate">{topic.name}</p>
                    <p className="text-[11px] md:text-xs text-[#737373] truncate">{topic.posts}</p>
                  </div>
                </div>
              )) : (
                <p className="text-[#737373] text-xs px-3">No trending topics match your search.</p>
              )}
            </div>
          </div>

          <div className="flex gap-1 md:gap-1.5">
            {exploreSubTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveSubTab(i)} className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeSubTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>

          <div className="space-y-1.5 md:space-y-2">
            {displayedUsers.length > 0 ? displayedUsers.map((user, idx) => {
              const isFollowing = following.has(user.id);
              return (
                <div key={user.id} className="flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors">
                  <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden flex-shrink-0 ${user.hasStory ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" : "ring-1 ring-[#e5e5e5]"}`}>
                    <Image src={user.avatar} alt={user.name} width={44} height={44} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-nowrap">
                      <span className="font-medium text-[13px] md:text-sm text-[#0a0a0a] truncate">{user.name}</span>
                      {user.verified && <VerifiedBadge className="scale-90 flex-shrink-0" />}
                      {idx === 0 && (
                        <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold flex-shrink-0">
                          <AlbizLogo size={12} /> #01
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#737373] block truncate">{user.title}</span>
                  </div>
                  <button className="hidden sm:block px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] flex-shrink-0">View</button>
                  <button onClick={() => handleFollow(user.id)} className={`px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-medium rounded-full transition-all flex-shrink-0 ${isFollowing ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
              );
            }) : (
              <p className="text-[#737373] text-sm text-center py-8">
                {searchQuery.trim() ? "No users match your search." : activeTab !== 0 ? `No users found in ${exploreTabs[activeTab]}.` : "No users to show."}
              </p>
            )}
          </div>
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
