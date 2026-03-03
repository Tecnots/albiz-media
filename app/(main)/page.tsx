"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useContext, useEffect } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, MoreVertical, Search, SlidersHorizontal, Circle, Check, Heart, Bookmark, X, ArrowLeft, Clock } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, filterTabs, generateArticleContent, newsAuthors, newsArticles, generateNewsArticleContent, sponsoredPosts, generateSponsoredArticleContent } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, RightSidebar } from "@/app/lib/shared-components";
import { rankPosts } from "@/app/lib/algorithm";

const defaultTopics = [
  { id: "tech", label: "Technology", selected: true, tags: ["Technology", "Tech"] },
  { id: "business", label: "Business", selected: true, tags: ["Business"] },
  { id: "ai", label: "AI & ML", selected: true, tags: ["AI"] },
  { id: "startups", label: "Startups", selected: true, tags: ["Startups"] },
  { id: "finance", label: "Finance", selected: true, tags: ["Finance", "Investing"] },
  { id: "news", label: "News", selected: true, tags: ["News"] },
  { id: "policy", label: "Policy", selected: true, tags: ["Policy"] },
  { id: "space", label: "Space", selected: true, tags: ["Space"] },
];

export type ContentTopic = typeof defaultTopics[number];

function FeedHeader({ activeTab, setActiveTab, topics, onToggleTopic }: { activeTab: number; setActiveTab: (t: number) => void; topics: ContentTopic[]; onToggleTopic: (id: string) => void }) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
      <div className="flex items-center justify-between mb-3">
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-[#0a0a0a]">Activities</h1>
            <div className="hidden sm:flex items-center gap-2">
            <button onClick={() => setShowSearch(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors" title="Search">
              <Search className="w-5 h-5 text-[#737373]" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className={`p-2 rounded-lg transition-colors ${showPreferences ? "bg-[#f5f5f5]" : "hover:bg-[#f5f5f5]"}`}
                title="Content Preferences"
              >
                <SlidersHorizontal className="w-5 h-5 text-[#737373]" />
              </button>
              {showPreferences && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-2 z-30">
                  <div className="px-3 py-2 text-xs text-[#737373] font-medium border-b border-[#e5e5e5] mb-1">Content Preferences</div>
                  {topics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => onToggleTopic(topic.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#f5f5f5] flex items-center justify-between"
                    >
                      <span className={topic.selected ? "text-[#0a0a0a]" : "text-[#737373]"}>{topic.label}</span>
                      <div className={`w-4 h-4 rounded flex items-center justify-center ${topic.selected ? "bg-[#F44444]" : "border border-[#e5e5e5]"}`}>
                        {topic.selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
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
  const { userRole, isSignedIn, openAuthModal, currentUserId } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!postUser) return null;

  const isFollowing = following.has(postUser.id);
  const isCurrentUser = postUser.id === currentUserId;

  const handleInteraction = (action: () => void) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    action();
  };

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 bg-white hover:border-[#d5d5d5] transition-colors animate-fade-in">
      <div className="flex items-start justify-between mb-3 gap-2">
        <Link href={`/${postUser.handle}`} className="flex items-center gap-2.5 min-w-0">
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
        </Link>
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
          <button onClick={() => handleInteraction(() => {})} className="p-2 rounded-lg text-[#737373] hover:bg-[#f5f5f5] transition-colors">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button onClick={() => handleInteraction(() => {})} className="p-2 rounded-lg text-[#737373] hover:bg-[#f5f5f5] transition-colors">
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

function ArticleCard({ post, users, onReadArticle }: { post: any; users: any[]; onReadArticle: (id: number) => void }) {
  // Check if this is a news article (has authorId) or a regular article (has userId)
  const isNewsArticle = "authorId" in post;
  const author = isNewsArticle ? newsAuthors.find(a => a.id === post.authorId) : null;
  const postUser = !isNewsArticle ? users.find((u: any) => u.id === post.userId) : null;
  const displayName = author?.name || postUser?.name || "";
  const displayAvatar = author?.avatar || postUser?.avatar || "";
  const authorLink = author ? `/author/${author.handle}` : null;

  if (!author && !postUser) return null;

  return (
    <div
      onClick={() => onReadArticle(post.id)}
      className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white hover:border-[#d5d5d5] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all cursor-pointer animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4">
        {post.image && (
          <div className="w-full sm:w-40 h-40 sm:h-auto flex-shrink-0 rounded-lg overflow-hidden">
            <Image src={post.image} alt={post.title || ""} width={160} height={160} className="object-cover w-full h-full" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {post.tags?.map((tag: string, i: number) => (
                <span key={tag}>
                  <span className="text-[#F44444]">{tag}</span>
                  {i < post.tags.length - 1 && <span className="text-[#a3a3a3] ml-2">&middot;</span>}
                </span>
              ))}
              <span className="text-[#a3a3a3]">&middot;</span>
              <span className="text-[#737373]">{post.date}</span>
            </div>
            <button onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
              <MoreVertical className="w-4 h-4 text-[#737373]" />
            </button>
          </div>
          <h3 className="text-base font-semibold mb-1.5 leading-tight text-[#0a0a0a]">{post.title}</h3>
          <p className="text-[#525252] text-xs mb-3 line-clamp-2">{post.description}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2" onClick={(e) => { if (authorLink) e.stopPropagation(); }}>
              {authorLink ? (
                <Link href={authorLink} className="flex items-center gap-2 hover:underline">
                  <div className="w-5 h-5 rounded-full overflow-hidden">
                    <Image src={displayAvatar} alt={displayName} width={20} height={20} className="object-cover w-full h-full" />
                  </div>
                  <span className="text-xs text-[#0a0a0a] font-medium">{displayName}</span>
                  <VerifiedBadge className="scale-75" />
                </Link>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full overflow-hidden">
                    <Image src={displayAvatar} alt={displayName} width={20} height={20} className="object-cover w-full h-full" />
                  </div>
                  <span className="text-xs text-[#737373]">{displayName}</span>
                  {postUser?.verified && <VerifiedBadge className="scale-75" />}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => e.stopPropagation()} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Share2 className="w-4 h-4 text-[#737373]" />
              </button>
              <button onClick={(e) => e.stopPropagation()} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Bookmark className="w-4 h-4 text-[#737373]" />
              </button>
              <span className="px-3 py-1 bg-[#F44444] text-white text-xs font-medium rounded-full">Read</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsoredArticleCard({ post, onReadArticle }: { post: any; onReadArticle: (id: number) => void }) {
  const author = newsAuthors.find(a => a.id === post.authorId);
  if (!author) return null;

  return (
    <div
      onClick={() => onReadArticle(post.id)}
      className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white hover:border-[#d5d5d5] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all cursor-pointer animate-fade-in relative"
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4">
        {post.image && (
          <div className="w-full sm:w-40 h-40 sm:h-auto flex-shrink-0 rounded-lg overflow-hidden relative">
            <Image src={post.image} alt={post.title || ""} width={160} height={160} className="object-cover w-full h-full" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {post.tags?.map((tag: string, i: number) => (
                <span key={tag}>
                  <span className="text-[#F44444]">{tag}</span>
                  {i < post.tags.length - 1 && <span className="text-[#a3a3a3] ml-2">&middot;</span>}
                </span>
              ))}
              <span className="text-[#a3a3a3]">&middot;</span>
              <span className="text-[#737373]">{post.date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-[#737373] tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#f0f0f0]">Ad</span>
              <button onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
                <MoreVertical className="w-4 h-4 text-[#737373]" />
              </button>
            </div>
          </div>
          <h3 className="text-base font-semibold mb-1.5 leading-tight text-[#0a0a0a]">{post.title}</h3>
          <p className="text-[#525252] text-xs mb-3 line-clamp-2">{post.description}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Link href={`/author/${author.handle}`} className="flex items-center gap-1.5 hover:underline">
                <div className="w-5 h-5 rounded-full overflow-hidden">
                  <Image src={author.avatar} alt={author.name} width={20} height={20} className="object-cover w-full h-full" />
                </div>
                <span className="text-xs text-[#737373]">{author.name}</span>
                <VerifiedBadge className="scale-75" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => e.stopPropagation()} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Share2 className="w-4 h-4 text-[#737373]" />
              </button>
              <button onClick={(e) => e.stopPropagation()} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Bookmark className="w-4 h-4 text-[#737373]" />
              </button>
              <span className="px-3 py-1 bg-[#F44444] text-white text-xs font-medium rounded-full">Read</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleDetailView({ postId, posts, users, onBack }: { postId: number; posts: any[]; users: any[]; onBack: () => void }) {
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal, currentUserId } = useContext(AuthContext);

  // Check if this is a sponsored article (id >= 900), news article (id >= 100), or regular article
  const isSponsoredArticle = postId >= 900;
  const isNewsArticle = postId >= 100 && postId < 900;
  const sponsoredArticle = isSponsoredArticle ? sponsoredPosts.find(a => a.id === postId) : null;
  const newsArticle = isNewsArticle ? newsArticles.find(a => a.id === postId) : null;
  const post = isSponsoredArticle ? sponsoredArticle : isNewsArticle ? newsArticle : posts.find((p: any) => p.id === postId);
  const author = (isSponsoredArticle && sponsoredArticle) ? newsAuthors.find(a => a.id === sponsoredArticle.authorId)
    : (isNewsArticle && newsArticle) ? newsAuthors.find(a => a.id === newsArticle.authorId) : null;
  const postUser = (!isNewsArticle && !isSponsoredArticle && post) ? users.find((u: any) => u.id === post.userId) : null;

  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!post) return null;

  const content = isSponsoredArticle ? generateSponsoredArticleContent(postId) : isNewsArticle ? generateNewsArticleContent(postId) : generateArticleContent(postId);
  const displayName = author?.name || postUser?.name || "";
  const displayAvatar = author?.avatar || postUser?.avatar || "";
  const displayTitle = author ? `${author.role} @ ${author.org}` : postUser?.title || "";
  const authorLink = author ? `/author/${author.handle}` : null;
  const isFollowing = postUser ? following.has(postUser.id) : false;
  const isCurrentUser = postUser ? postUser.id === currentUserId : false;

  // Combine all articles for "related" section
  const allArticles = [...posts.filter((p: any) => p.type === "article"), ...newsArticles, ...sponsoredPosts];
  const relatedArticles = allArticles
    .filter((p: any) => p.id !== postId && p.tags?.some((t: string) => post.tags?.includes(t)))
    .slice(0, 3);

  const handleInteraction = (action: () => void) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    action();
  };

  return (
    <main className="flex-1 min-w-0 bg-white overflow-y-auto animate-fade-in">
      <header className="sticky top-0 z-30 bg-white border-b border-[#f0f0f0]">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => handleInteraction(() => setIsLiked(!isLiked))} className={`p-2 rounded-lg transition-colors ${isLiked ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
            </button>
            <button onClick={() => handleInteraction(() => setIsSaved(!isSaved))} className={`p-2 rounded-lg transition-colors ${isSaved ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
              <Bookmark className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
            </button>
            <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <article className="px-4 sm:px-6 py-8 max-w-2xl">
        <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
          {isSponsoredArticle && (
            <span className="text-[10px] font-medium text-[#737373] tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#f0f0f0]">Ad</span>
          )}
          {post.tags?.map((tag: string, i: number) => (
            <span key={tag}>
              <span className="text-[#F44444] font-medium">{tag}</span>
              {i < post.tags.length - 1 && <span className="text-[#d5d5d5] ml-2">&middot;</span>}
            </span>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#0a0a0a] leading-tight mb-6">{post.title}</h1>

        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            {authorLink ? (
              <Link href={authorLink}>
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
                  <Image src={displayAvatar} alt={displayName} width={48} height={48} className="object-cover w-full h-full" />
                </div>
              </Link>
            ) : (
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
                <Image src={displayAvatar} alt={displayName} width={48} height={48} className="object-cover w-full h-full" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                {authorLink ? (
                  <Link href={authorLink} className="font-semibold text-[#0a0a0a] hover:underline">{displayName}</Link>
                ) : (
                  <span className="font-semibold text-[#0a0a0a]">{displayName}</span>
                )}
                <VerifiedBadge />
              </div>
              <span className="text-xs text-[#737373]">{displayTitle}</span>
            </div>
          </div>
          {!isCurrentUser && postUser && (
            <button
              onClick={() => handleInteraction(() => toggleFollow(postUser.id))}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${isFollowing ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-[#737373] mb-6">
          <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /><span>{post.date}</span></div>
          <div className="flex items-center gap-1.5"><Eye className="w-4 h-4" /><span>{post.stats.views} views</span></div>
          {isSponsoredArticle && sponsoredArticle && (
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-5 h-5 rounded-full overflow-hidden">
                <Image src={sponsoredArticle.sponsor.logo} alt={sponsoredArticle.sponsor.name} width={20} height={20} className="object-cover w-full h-full" />
              </div>
              <span className="text-xs text-[#525252]">Sponsored by <span className="font-medium text-[#0a0a0a]">{sponsoredArticle.sponsor.name}</span></span>
            </div>
          )}
        </div>

        {post.image && (
          <div className="rounded-2xl overflow-hidden mb-8">
            <Image src={post.image} alt={post.title || ""} width={800} height={450} className="object-cover w-full" />
          </div>
        )}

        <div className="mb-10">
          {content.map((paragraph: string, i: number) => (
            <p key={i} className="text-[#262626] leading-relaxed mb-5 text-base sm:text-lg">{paragraph}</p>
          ))}
        </div>

        <div className="flex items-center justify-between py-4 border-t border-b border-[#e5e5e5] mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => handleInteraction(() => setIsLiked(!isLiked))} className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${isLiked ? "bg-[#F44444]/10 text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#737373]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} /><span className="text-sm font-medium">{post.stats.likes}</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors">
              <MessageCircle className="w-5 h-5" /><span className="text-sm font-medium">{post.stats.comments}</span>
            </button>
          </div>
          <button onClick={() => handleInteraction(() => setIsSaved(!isSaved))} className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${isSaved ? "bg-[#F44444]/10 text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#737373]"}`}>
            <Bookmark className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} /><span className="text-sm font-medium hidden sm:inline">Save</span>
          </button>
        </div>

        {relatedArticles.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-[#0a0a0a] mb-4">Related Stories</h2>
            <div className="space-y-4">
              {relatedArticles.map((article: any) => {
                const relAuthor = article.authorId ? newsAuthors.find(a => a.id === article.authorId) : null;
                const relUser = article.userId ? users.find((u: any) => u.id === article.userId) : null;
                const relName = relAuthor?.name || relUser?.name || "";
                return (
                  <button key={article.id} onClick={onBack} className="w-full flex gap-4 p-3 rounded-xl hover:bg-[#f5f5f5] transition-colors text-left">
                    {article.image && (
                      <div className="w-24 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={article.image} alt={article.title || ""} width={96} height={80} className="object-cover w-full h-full" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#F44444] mb-1">{article.tags?.slice(0, 2).join(" • ")}</div>
                      <h3 className="font-medium text-sm text-[#0a0a0a] line-clamp-2 mb-1">{article.title}</h3>
                      <span className="text-xs text-[#737373]">{relName}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Author card at bottom */}
        {authorLink ? (
          <Link href={authorLink} className="block bg-[#fafafa] rounded-2xl p-6 mb-8 hover:bg-[#f5f5f5] transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-[#fafafa] flex-shrink-0">
                <Image src={displayAvatar} alt={displayName} width={64} height={64} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-semibold text-lg text-[#0a0a0a]">{displayName}</span>
                  <VerifiedBadge />
                </div>
                <p className="text-sm text-[#737373] mb-1">{displayTitle}</p>
                {author && <p className="text-xs text-[#525252]">{author.bio}</p>}
              </div>
            </div>
          </Link>
        ) : postUser && (
          <div className="bg-[#fafafa] rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-[#fafafa] flex-shrink-0">
                <Image src={postUser.avatar} alt={postUser.name} width={64} height={64} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-semibold text-lg text-[#0a0a0a]">{postUser.name}</span>
                  <VerifiedBadge />
                </div>
                <p className="text-sm text-[#737373] mb-3">{postUser.title}</p>
                {!isCurrentUser && (
                  <button onClick={() => handleInteraction(() => toggleFollow(postUser.id))} className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${isFollowing ? "bg-white text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </article>
    </main>
  );
}

export default function ActivitiesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { following } = useContext(FollowingContext);
  const { currentUserId } = useContext(AuthContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [posts, setPosts] = useState(fallbackPosts);
  const [topics, setTopics] = useState(defaultTopics);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);

  const toggleTopic = (id: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  // Fetch from Supabase API (falls back to hardcoded on error)
  useEffect(() => {
    Promise.all([api.getUsers(), api.getPosts()])
      .then(([u, p]) => { setUsers(u); setPosts(p); })
      .catch(() => {}); // keep fallback
  }, []);

  // Build set of allowed tags from selected content preferences
  const selectedTags = new Set(topics.filter(t => t.selected).flatMap(t => t.tags));

  const applyPreferences = (postList: any[]) => {
    // If all topics are selected, skip filtering (show everything)
    if (topics.every(t => t.selected)) return postList;
    // Keep posts that have at least one tag matching selected preferences
    return postList.filter(post => {
      if (!post.tags || post.tags.length === 0) return true; // posts without tags always show
      return post.tags.some((tag: string) => selectedTags.has(tag));
    });
  };

  // Merge regular posts with news articles for the feed
  const allContent = [...posts, ...newsArticles];

  const getFilteredPosts = () => {
    const tabName = filterTabs[activeTab];
    switch (tabName) {
      case "Following": return applyPreferences(posts.filter(post => following.has(post.userId) || post.userId === currentUserId));
      case "News": {
        // News tab: news articles first, then regular posts tagged as News
        const regularNews = posts.filter(post => post.tags?.includes("News"));
        return [...newsArticles, ...regularNews];
      }
      case "AI": return allContent.filter(post => post.tags?.includes("AI"));
      case "Technology": return allContent.filter(post => post.tags?.includes("Technology"));
      case "Trending": return applyPreferences(rankPosts(allContent, users, following, currentUserId, { mode: "trending" }));
      default: return applyPreferences(rankPosts(allContent, users, following, currentUserId, { mode: "for-you" }));
    }
  };

  const filtered = getFilteredPosts();

  // Interleave sponsored posts into the feed at positions: 1st slot, then every 5th
  const feedWithAds = (() => {
    if (filtered.length === 0) return [];
    const items: { type: "content" | "sponsored"; data: any }[] = [];
    let adIndex = 0;
    const adInterval = 5; // place an ad every N posts

    // Place first ad at position 0 (top of feed)
    if (sponsoredPosts.length > 0) {
      items.push({ type: "sponsored", data: sponsoredPosts[adIndex % sponsoredPosts.length] });
      adIndex++;
    }

    for (let i = 0; i < filtered.length; i++) {
      items.push({ type: "content", data: filtered[i] });
      // Insert ad after every Nth content post
      if ((i + 1) % adInterval === 0 && adIndex < sponsoredPosts.length) {
        items.push({ type: "sponsored", data: sponsoredPosts[adIndex % sponsoredPosts.length] });
        adIndex++;
      }
    }
    return items;
  })();

  // If an article is selected, show the detail view
  if (selectedArticle) {
    return (
      <>
        <ArticleDetailView postId={selectedArticle} posts={posts} users={users} onBack={() => setSelectedArticle(null)} />
        <RightSidebar />
      </>
    );
  }

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        <FeedHeader activeTab={activeTab} setActiveTab={setActiveTab} topics={topics} onToggleTopic={toggleTopic} />
        <div className="space-y-3 pt-4 pb-6">
          {feedWithAds.length === 0 ? (
            <div className="text-center py-12"><p className="text-[#737373] text-sm">No posts to show.</p></div>
          ) : (
            feedWithAds.map((item, idx) =>
              item.type === "sponsored" ? (
                <SponsoredArticleCard key={`ad-${item.data.id}`} post={item.data} onReadArticle={setSelectedArticle} />
              ) : item.data.type === "article" ? (
                <ArticleCard key={item.data.id} post={item.data} users={users} onReadArticle={setSelectedArticle} />
              ) : (
                <PostCard key={item.data.id} post={item.data} users={users} />
              )
            )
          )}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
