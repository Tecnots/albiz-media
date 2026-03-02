"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, MoreVertical, Search, SlidersHorizontal, Circle, Check, Heart, Bookmark } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, filterTabs } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, RightSidebar } from "@/app/lib/shared-components";

function FeedHeader({ activeTab, setActiveTab }: { activeTab: number; setActiveTab: (t: number) => void }) {
  return (
    <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
        {filterTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              i === activeTab
                ? "bg-[#F44444] text-white"
                : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, users }: { post: any; users: any[] }) {
  const postUser = users.find((u: any) => u.id === post.userId);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { userRole, isSignedIn, openAuthModal } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE";
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!postUser) return null;

  const isFollowing = following.has(postUser.id);
  const isCurrentUser = postUser.id === 1;

  const handleInteraction = (action: () => void) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    action();
  };

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 bg-white hover:border-[#d5d5d5] transition-colors animate-fade-in">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
            <Image src={postUser.avatar} alt={postUser.name} width={36} height={36} className="object-cover w-full h-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-sm text-[#0a0a0a]">{postUser.name}</span>
              {postUser.verified && <VerifiedBadge className="scale-90" />}
              <span className="text-[#a3a3a3] text-xs">{post.date}</span>
            </div>
            <span className="text-xs text-[#737373] truncate block">{postUser.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isCurrentUser && (
            <button
              onClick={() => handleInteraction(() => toggleFollow(postUser.id))}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                isFollowing
                  ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                  : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
          <button className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
            <MoreVertical className="w-4 h-4 text-[#737373]" />
          </button>
        </div>
      </div>
      {post.type === "article" && "title" in post && (
        <h3 className="font-semibold text-[#0a0a0a] mb-1">{post.title}</h3>
      )}
      {post.type === "article" && "description" in post && (
        <p className="text-sm text-[#525252] mb-3">{post.description}</p>
      )}
      {post.content && <p className="text-sm text-[#262626] mb-3">{post.content}</p>}
      {"image" in post && post.image && (
        <div className="rounded-xl overflow-hidden mb-3">
          <Image src={post.image} alt="Post" width={800} height={400} className="object-cover w-full" />
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleInteraction(() => setLiked(!liked))}
            className={`p-2 rounded-lg transition-colors ${liked ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-[#F44444]" : ""}`} />
          </button>
          <button className="p-2 rounded-lg text-[#737373] hover:bg-[#f5f5f5] transition-colors">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg text-[#737373] hover:bg-[#f5f5f5] transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleInteraction(() => setSaved(!saved))}
            className={`p-2 rounded-lg transition-colors ${saved ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}
          >
            <Bookmark className={`w-4 h-4 ${saved ? "fill-[#F44444]" : ""}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[#a3a3a3] text-xs">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.stats.views}</span>
          <span>{post.stats.likes} likes</span>
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { following } = useContext(FollowingContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [posts, setPosts] = useState(fallbackPosts);

  // Fetch from Supabase API (falls back to hardcoded on error)
  useEffect(() => {
    Promise.all([api.getUsers(), api.getPosts()])
      .then(([u, p]) => { setUsers(u); setPosts(p); })
      .catch(() => {}); // keep fallback
  }, []);

  const getFilteredPosts = () => {
    const tabName = filterTabs[activeTab];
    switch (tabName) {
      case "Following": return posts.filter(post => following.has(post.userId) || post.userId === 1);
      case "News": return posts.filter(post => post.tags?.includes("News"));
      case "AI": return posts.filter(post => post.tags?.includes("AI"));
      case "Technology": return posts.filter(post => post.tags?.includes("Technology"));
      case "Trending": return [...posts].sort((a, b) => {
        const parseNum = (s: string) => parseFloat(s.replace("k", "000").replace(".", ""));
        return (parseNum(b.stats.likes) + parseNum(b.stats.comments)) - (parseNum(a.stats.likes) + parseNum(a.stats.comments));
      });
      default: return posts;
    }
  };

  const filtered = getFilteredPosts();

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        <FeedHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="space-y-3 pt-4 pb-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12"><p className="text-[#737373] text-sm">No posts to show.</p></div>
          ) : (
            filtered.map(post => <PostCard key={post.id} post={post} users={users} />)
          )}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
