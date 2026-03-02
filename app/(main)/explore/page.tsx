"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import { Search, Filter, X } from "lucide-react";
import { FollowingContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, exploreTabs, exploreSubTabs, trendingTopics as fallbackTrending } from "@/app/lib/data";
import { VerifiedBadge, AlbizLogo, RightSidebar } from "@/app/lib/shared-components";
import { api } from "@/app/lib/api";

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { following, toggleFollow } = useContext(FollowingContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [trendingTopics, setTrending] = useState(fallbackTrending);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getTrending()])
      .then(([u, t]) => { setUsers(u); setTrending(t); })
      .catch(() => {});
  }, []);

  const featuredPeople = users.slice(1, 6);

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-4">
            {showSearch ? (
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Search explore..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
                </div>
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold">Explore</h1>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSearch(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Search className="w-5 h-5 text-[#737373]" /></button>
                  <button className="p-2 hover:bg-[#f5f5f5] rounded-lg"><Filter className="w-5 h-5 text-[#737373]" /></button>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {exploreTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-5">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">Trending Now</p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4">
              {trendingTopics.map(topic => (
                <div key={topic.id} className="flex items-center gap-3 min-w-[180px] p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors cursor-pointer flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={topic.image} alt={topic.name} width={40} height={40} className="object-cover w-full h-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0a0a0a] truncate">{topic.name}</p>
                    <p className="text-xs text-[#737373] truncate">{topic.posts}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5">
            {exploreSubTabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveSubTab(i)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeSubTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>

          <div className="space-y-2">
            {featuredPeople.map((user, idx) => {
              const isFollowing = following.has(user.id);
              return (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors">
                  <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ${user.hasStory ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" : "ring-1 ring-[#e5e5e5]"}`}>
                    <Image src={user.avatar} alt={user.name} width={44} height={44} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm text-[#0a0a0a]">{user.name}</span>
                      {user.verified && <VerifiedBadge className="scale-90" />}
                      {idx === 0 && (
                        <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold">
                          <AlbizLogo size={12} /> #01
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#737373] block truncate">{user.title}</span>
                  </div>
                  <button className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa]">View</button>
                  <button onClick={() => toggleFollow(user.id)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${isFollowing ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
