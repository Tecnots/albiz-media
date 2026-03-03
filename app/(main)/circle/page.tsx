"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import { Search, Filter, ThumbsUp, MessageCircle } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { circleMembers as fallbackMembers, circlePosts as fallbackCirclePosts, circleTabs } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, AlbizLogo, RightSidebar } from "@/app/lib/shared-components";

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold">
      <AlbizLogo size={12} /> #{String(rank).padStart(2, "0")}
    </span>
  );
}

function CircleProfileRow({ member, showRank = true }: { member: (typeof circleMembers)[0]; showRank?: boolean }) {
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal } = useContext(AuthContext);
  const isFollowing = following.has(member.id);

  const handleFollow = () => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(member.id);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#fafafa] transition-colors">
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
      <button className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] flex-shrink-0">View</button>
      <button
        onClick={handleFollow}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex-shrink-0 ${
          isFollowing ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}

function CirclePostCard({ post, member }: { post: (typeof circlePosts)[0]; member: (typeof circleMembers)[0] }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5] transition-colors">
      <div className="flex items-center gap-3 mb-3">
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
            <span className="font-medium text-sm text-[#0a0a0a]">{member.name}</span>
            {member.verified && <VerifiedBadge className="scale-90" />}
            <RankBadge rank={member.rank} />
          </div>
          <span className="text-xs text-[#737373]">{member.title}</span>
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

export default function CirclePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [circleMembers, setCircleMembers] = useState(fallbackMembers);
  const [circlePosts, setCirclePosts] = useState(fallbackCirclePosts);
  const tabName = circleTabs[activeTab];

  useEffect(() => {
    Promise.all([api.getCircleMembers(), api.getCirclePosts()])
      .then(([m, p]) => { setCircleMembers(m); setCirclePosts(p); })
      .catch(() => {});
  }, []);

  const isFeedTab = tabName === "For You" || tabName === "Following";

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

  // For mixed feed: interleave posts with some profile rows
  const feedItems: Array<{ type: "post"; post: (typeof circlePosts)[0]; member: (typeof circleMembers)[0] } | { type: "profile"; member: (typeof circleMembers)[0] }> = [];
  if (isFeedTab) {
    circlePosts.forEach((post, i) => {
      const member = circleMembers.find(m => m.id === post.memberId);
      if (member) feedItems.push({ type: "post", post, member });
      // For "For You" tab, insert a profile row after every 2 posts
      if (tabName === "For You" && i % 2 === 1 && circleMembers[i]) {
        feedItems.push({ type: "profile", member: circleMembers[i] });
      }
    });
  }

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-[#0a0a0a]">Circle</h1>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg">
                <Search className="w-5 h-5 text-[#737373]" />
              </button>
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg">
                <Filter className="w-5 h-5 text-[#737373]" />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {circleTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  i === activeTab
                    ? "bg-[#F44444] text-white"
                    : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-3">
          {isFeedTab ? (
            feedItems.map((item, i) =>
              item.type === "post" ? (
                <CirclePostCard key={`post-${i}`} post={item.post} member={item.member} />
              ) : (
                <CircleProfileRow key={`profile-${i}`} member={item.member} />
              )
            )
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">
                  {tabName} ({filteredMembers.length})
                </p>
              </div>
              <div className="space-y-1">
                {filteredMembers.map(member => (
                  <CircleProfileRow key={member.id} member={member} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
