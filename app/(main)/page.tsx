"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams, usePathname } from "next/navigation";
import { useState, useContext, useEffect, useRef } from "react";
import { Eye, EyeOff, ThumbsUp, MessageCircle, Share2, MoreVertical, Search, SlidersHorizontal, Circle, Check, Heart, Bookmark, X, ArrowLeft, Clock, MapPin, ArrowUp, Loader2, Trash2, LinkIcon, Briefcase, User, Laptop, Bot, Rocket, TrendingUp, Radio, Landmark, Globe, Brush, Megaphone, FlaskConical, HeartPulse, Film, Trophy, Zap } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, filterTabs, generateArticleContent, newsAuthors, newsArticles, generateNewsArticleContent, sponsoredPosts, generateSponsoredArticleContent } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, SaveBookmarkButton, ReadButton, RecentStories, RightSidebar } from "@/app/lib/shared-components";
import { rankPosts } from "@/app/lib/algorithm";

const defaultTopics = [
  { id: "business", label: "Business", icon: Briefcase, selected: true, tags: ["Business", "Startups", "Finance", "Economy"] },
  { id: "tech", label: "Technology", icon: Laptop, selected: true, tags: ["Technology", "Tech", "Software", "Hardware"] },
  { id: "ai", label: "AI", icon: Bot, selected: true, tags: ["AI", "Machine Learning", "Deep Learning", "AI & ML"] },
  { id: "marketing", label: "Marketing", icon: Megaphone, selected: true, tags: ["Marketing", "Sales", "Growth", "Advertising"] },
  { id: "design", label: "Design", icon: Brush, selected: true, tags: ["Design", "UI", "UX", "Art"] },
  { id: "science", label: "Science", icon: FlaskConical, selected: true, tags: ["Science", "Research", "Physics", "Space"] },
  { id: "health", label: "Health", icon: HeartPulse, selected: true, tags: ["Health", "Medicine", "Wellness"] },
  { id: "entertainment", label: "Entertainment", icon: Film, selected: true, tags: ["Entertainment", "Movies", "Music", "Art"] },
  { id: "sports", label: "Sports", icon: Trophy, selected: true, tags: ["Sports", "Gaming", "Fitness"] },
  { id: "news", label: "News", icon: Radio, selected: true, tags: ["News"] },
  { id: "policy", label: "Policy", icon: Landmark, selected: true, tags: ["Policy", "Politics"] },
  { id: "economy", label: "Economy", icon: Globe, selected: true, tags: ["Economy", "Finance", "World"] },
];

export type ContentTopic = typeof defaultTopics[number];

const matchInterestsToTopics = (interests: string[]) => {
  if (!interests || interests.length === 0) {
    return defaultTopics.map(t => ({ ...t, selected: true }));
  }
  const lowerInterests = new Set(interests.map((i: string) => i.toLowerCase()));
  const updated = defaultTopics.map(t => ({
    ...t,
    selected:
      lowerInterests.has(t.id.toLowerCase()) ||
      lowerInterests.has(t.label.toLowerCase()) ||
      t.tags.some((tag: string) => lowerInterests.has(tag.toLowerCase())),
  }));
  return updated.some(t => t.selected) ? updated : defaultTopics.map(t => ({ ...t, selected: true }));
};

function FeedHeader({ activeTab, setActiveTab, topics, onToggleTopic, onSearchQuery, isSignedIn }: { activeTab: number; setActiveTab: (t: number) => void; topics: ContentTopic[]; onToggleTopic: (id: string) => void; onSearchQuery: (query: string) => void; isSignedIn: boolean }) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreferences, setShowPreferences] = useState(false);
  const prefRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPreferences) return;
    const handleClick = (e: MouseEvent) => {
      if (prefRef.current && !prefRef.current.contains(e.target as Node)) {
        setShowPreferences(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPreferences]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchQuery(value);
  };

  return (
    <div className="sticky top-0 bg-white z-30 py-2.5 md:py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); handleSearchChange(""); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-lg md:text-xl font-semibold text-[#0a0a0a]">Activities</h1>
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={() => setShowSearch(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors" title="Search">
                <Search className="w-5 h-5 text-[#737373]" />
              </button>
              <div className="relative" ref={prefRef}>
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className={`p-2 rounded-lg transition-colors relative ${showPreferences ? "bg-[#f5f5f5]" : "hover:bg-[#f5f5f5]"}`}
                  title="Content Preferences"
                >
                  <SlidersHorizontal className="w-5 h-5 text-[#737373]" />
                  {topics.some(t => !t.selected) && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F44444]" />
                  )}
                </button>
                {showPreferences && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-2 z-30">
                    <div className="px-3 py-2 border-b border-[#e5e5e5] mb-1 flex items-center justify-between">
                      <span className="text-xs text-[#737373] font-medium">Content Preferences</span>
                      <button
                        onClick={() => {
                          const allSelected = topics.every(t => t.selected);
                          if (allSelected) {
                            topics.forEach(t => onToggleTopic(t.id));
                          } else {
                            topics.filter(t => !t.selected).forEach(t => onToggleTopic(t.id));
                          }
                        }}
                        className="flex items-center transition-colors"
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${topics.every(t => t.selected) ? "bg-[#F44444]" : topics.some(t => t.selected) ? "bg-[#F44444]/40" : "border border-[#d5d5d5]"}`}>
                          {topics.every(t => t.selected) && <Check className="w-2.5 h-2.5 text-white" />}
                          {!topics.every(t => t.selected) && topics.some(t => t.selected) && <div className="w-1.5 h-px bg-white rounded" />}
                        </div>
                      </button>
                    </div>
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
      <div className="flex gap-1 md:gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
        {filterTabs.filter(tab => isSignedIn || tab !== "Following").map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(filterTabs.indexOf(tab))}
            className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterTabs.indexOf(tab) === activeTab
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

function PostCard({ post, users, initialLiked = false, initialSaved = false, savedPostIds, onSaveChange, pathname }: { post: any; users: any[]; initialLiked?: boolean; initialSaved?: boolean; savedPostIds?: Set<number>; onSaveChange?: (postId: number, isSaved: boolean) => void; pathname?: string }) {
  const postUser = users.find((u: any) => u.id === post.userId);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { userRole, isSignedIn, openAuthModal, currentUserId } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [commentCount, setCommentCount] = useState(post.stats.comments);
  const [shareCount, setShareCount] = useState(post.stats.shares);
  // Sync when initial values load asynchronously
  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close menu on outside click — must be before early return
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  if (!postUser || deleted) return null;

  const isFollowing = following.has(postUser.id);
  const isCurrentUser = postUser.id === currentUserId;
  const currentUserData = users.find((u: any) => u.id === currentUserId);

  const handleInteraction = (action: () => void) => {
    if (!isSignedIn) { openAuthModal("signup", "Sign up to follow this user"); return; }
    action();
  };

  const handleDeletePost = () => {
    setMenuOpen(false);
    api.deletePost(post.id).catch(() => { });
    setDeleted(true);
    window.dispatchEvent(new Event("albiz-post-created"));
  };

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    api.likePost(post.id, newLiked ? "like" : "unlike", currentUserId)
      .then(res => { if (res.likes) setLikeCount(res.likes); })
      .catch(() => { });
  };

  const toggleComments = () => {
    const opening = !showComments;
    setShowComments(opening);
    // Load comments in background — show input immediately
    if (opening && comments.length === 0) {
      setLoadingComments(true);
      api.getComments(post.id)
        .then((data: any[]) => {
          setComments(prev => {
            if (prev.length === 0) return data;
            const loadedIds = new Set(data.map((c: any) => c.id));
            const optimistic = prev.filter((c: any) => !loadedIds.has(c.id));
            return [...optimistic, ...data];
          });
        })
        .catch(() => { })
        .finally(() => setLoadingComments(false));
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || posting) return;
    setPosting(true);
    try {
      const newComment = await api.addComment(post.id, currentUserId, commentText.trim());
      if (newComment.id) {
        setComments(prev => [newComment, ...prev]);
        const parsed = parseInt(commentCount) || 0;
        setCommentCount(String(parsed + 1));
      }
      setCommentText("");
    } catch { }
    setPosting(false);
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    const title = post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || post.title || "Check out this post";
    const text = `${title} - ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setShareCount((prev: number) => prev + 1);
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
    }

    setShowSharePopup(true);
  };

  const copyLink = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowSharePopup(false);
    setShareCount((prev: number) => prev + 1);
  };

  const shareToWhatsApp = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    const title = post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || post.title || "Check out this post";
    const text = `${title} - ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setShowSharePopup(false);
    setShareCount((prev: number) => prev + 1);
  };

  const shareToTwitter = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    const title = post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || post.title || "Check out this post";
    const text = `${title} - ${url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    setShowSharePopup(false);
    setShareCount((prev: number) => prev + 1);
  };

  const shareToFacebook = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    setShowSharePopup(false);
    setShareCount((prev: number) => prev + 1);
  };

  const shareToLinkedIn = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
    setShowSharePopup(false);
    setShareCount((prev: number) => prev + 1);
  };

  return (
    <div id={`post-${post.id}`} className="rounded-xl border border-[#e5e5e5] p-3 md:p-4 bg-white hover:border-[#d5d5d5] transition-colors animate-fade-in">
      <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
        <Link href={`/${postUser.handle}?from=${encodeURIComponent(pathname || '/')}`} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
            {postUser.avatar ? (
              <Image src={postUser.avatar} alt={postUser.name} width={32} height={32} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-[13px] md:text-sm text-[#0a0a0a]">{postUser.name}</span>
              {postUser.verified && <VerifiedBadge className="scale-90" />}
              <span className="text-[#a3a3a3] text-xs">{post.date}</span>
            </div>
            <span className="text-xs text-[#737373] truncate block">{postUser.title}</span>
            {post.type === "post" && post.description && (
              <span className="text-[10px] text-[#F44444] flex items-center gap-0.5 mt-0.5"><MapPin className="w-2.5 h-2.5" />{post.description}</span>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isCurrentUser && (
            <button
              onClick={() => handleInteraction(() => toggleFollow(postUser.id))}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${isFollowing
                  ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                  : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
              <MoreVertical className="w-4 h-4 text-[#737373]" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-[#e5e5e5] py-1 z-20 min-w-[140px]" onClick={e => e.stopPropagation()}>
                {isCurrentUser && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); window.location.href = `/${postUser.handle}`; }} className="w-full text-left px-3 py-2 text-xs text-[#0a0a0a] hover:bg-[#fafafa] flex items-center gap-2">
                      <Eye className="w-3 h-3" /> View on profile
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePost(); }} className="w-full text-left px-3 py-2 text-xs text-[#F44444] hover:bg-[#fafafa] flex items-center gap-2">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </>
                )}
                {!isCurrentUser && (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-[#737373] hover:bg-[#fafafa]">
                    Not interested
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {post.type === "article" && "title" in post && (
        <h3 className="font-semibold text-[#0a0a0a] mb-1">{post.title}</h3>
      )}
      {post.type === "article" && "description" in post && (
        <p className="text-sm text-[#525252] mb-2 md:mb-3">{post.description}</p>
      )}
      {post.content && <div className="text-sm text-[#262626] mb-2 md:mb-3 [&_b]:font-bold [&_i]:italic [&_a]:text-[#F44444] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: post.content }} />}
      {"image" in post && post.image && (
        <div className="rounded-xl overflow-hidden mb-3">
          <Image src={post.image} alt="Post" width={800} height={400} className="object-cover w-full" />
        </div>
      )}
      {/* Stats + Actions */}
      <div className="flex items-center justify-between pt-1.5 md:pt-2 border-t border-[#f0f0f0]">
        <div className="flex items-center gap-3 md:gap-4 text-[#737373]">
          <span className="flex items-center gap-1 text-xs"><Eye className="w-3.5 h-3.5" />{post.stats.views}</span>
          <button
            onClick={() => handleInteraction(handleLike)}
            className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-[#F44444]" : "hover:text-[#525252]"}`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? "fill-[#F44444]" : ""}`} />
            {likeCount}
          </button>
          <button onClick={() => handleInteraction(() => setShowComments(!showComments))} className={`flex items-center gap-1 text-xs ${showComments ? "text-[#F44444]" : "text-[#737373]"}`}>
            <MessageCircle className={`w-3.5 h-3.5 ${showComments ? "fill-[#F44444]/10" : ""}`} />
            {commentCount}
          </button>
          <button onClick={() => handleInteraction(handleShare)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] transition-colors">
            <Share2 className="w-3 h-3" />

          </button>
        </div>
        <SaveBookmarkButton postId={post.id} initialSaved={initialSaved} savedPostIds={savedPostIds} onSaveChange={onSaveChange} />
      </div>
      {/* Comments Section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
          {/* Comment Input */}
          <div className="flex items-center gap-2 mb-3">
            {currentUserData && (
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                {currentUserData.avatar ? (
                  <Image src={currentUserData.avatar} alt="" width={28} height={28} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 flex items-center gap-1.5 bg-[#f5f5f5] rounded-full px-3 py-1.5">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitComment(); }}
                placeholder="Write a comment..."
                className="flex-1 bg-transparent text-xs outline-none text-[#262626] placeholder:text-[#a3a3a3]"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || posting}
                className="text-[#F44444] disabled:text-[#d5d5d5] transition-colors"
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {/* Comments List */}
          {loadingComments ? (
            <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" /></div>
          ) : comments.length > 0 ? (
            <div className="space-y-2.5 max-h-[240px] overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 group/comment">
                  <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                    {c.avatar ? (
                      <Image src={c.avatar} alt={c.name} width={24} height={24} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <User className="w-3 h-3 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#0a0a0a]">{c.name}</span>
                      {c.verified && <VerifiedBadge className="scale-75" />}
                      <span className="text-[10px] text-[#a3a3a3]">{new Date(c.createdAt).toLocaleDateString()}</span>
                      {c.userId === currentUserId && (
                        <button
                          onClick={() => { api.deleteComment(post.id, c.id).catch(() => { }); setComments(prev => prev.filter(x => x.id !== c.id)); const n = parseInt(commentCount) || 0; setCommentCount(String(Math.max(0, n - 1))); }}
                          className="opacity-0 group-hover/comment:opacity-100 transition-opacity ml-auto text-[#a3a3a3] hover:text-[#F44444]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#262626] mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#a3a3a3] text-center py-2">No comments yet</p>
          )}
        </div>
      )}
      {showSharePopup && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSharePopup(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#0a0a0a]">Share post</h3>
              <button onClick={() => setShowSharePopup(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#737373]" />
              </button>
            </div>
            <div className="space-y-2">
              <button onClick={copyLink} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <LinkIcon className="w-5 h-5 text-[#737373]" />
                <span className="text-sm text-[#0a0a0a]">{copied ? "Copied!" : "Copy link"}</span>
              </button>
              <button onClick={shareToWhatsApp} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <span className="text-sm text-[#0a0a0a]">WhatsApp</span>
              </button>
              <button onClick={shareToTwitter} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <Share2 className="w-5 h-5 text-[#1DA1F2]" />
                <span className="text-sm text-[#0a0a0a]">Twitter</span>
              </button>
              <button onClick={shareToFacebook} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <Share2 className="w-5 h-5 text-[#4267B2]" />
                <span className="text-sm text-[#0a0a0a]">Facebook</span>
              </button>
              <button onClick={shareToLinkedIn} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <Briefcase className="w-5 h-5 text-[#0077B5]" />
                <span className="text-sm text-[#0a0a0a]">LinkedIn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleCard({ post, users, onReadArticle, onSaveChange, initialSaved = false, savedPostIds }: { post: any; users: any[]; onReadArticle: (id: number) => void; onSaveChange?: (postId: number, isSaved: boolean) => void; initialSaved?: boolean; savedPostIds?: Set<number> }) {
  const { currentUserId } = useContext(AuthContext);
  const isNewsArticle = "authorId" in post;
  const author = isNewsArticle ? newsAuthors.find(a => a.id === post.authorId) : null;
  const postUser = !isNewsArticle ? users.find((u: any) => u.id === post.userId) : null;
  const displayName = author?.name || postUser?.name || "";
  const displayAvatar = author?.avatar || postUser?.avatar || "";
  const authorLink = author ? `/author/${author.handle}` : null;
  const [shareCount, setShareCount] = useState(post.stats?.shares || 0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  if (!author && !postUser) return null;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = typeof window !== "undefined" ? window.location.href + `#article-${post.id}` : "";
    const title = post.title || "Check out this article";
    const text = `${title} - ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setShareCount((prev: number) => prev + 1);
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
    }

    const shareOptions = [
      { name: "Twitter", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
      { name: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
      { name: "LinkedIn", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
      { name: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(text)}` },
      { name: "Telegram", url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
      { name: "Copy Link", action: () => navigator.clipboard.writeText(url).then(() => alert("Link copied to clipboard!")) },
    ];

    const selectedOption = prompt(
      "Choose a platform:\n" +
      shareOptions.map((opt, i) => `${i + 1}. ${opt.name}`).join("\n")
    );

    const index = selectedOption ? parseInt(selectedOption) - 1 : -1;
    if (index >= 0 && index < shareOptions.length) {
      const option = shareOptions[index];
      if (option.action) {
        option.action();
      } else {
        window.open(option.url, "_blank", "width=600,height=400");
      }
      setShareCount((prev: number) => prev + 1);
    }
  };

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
            <div className="relative">
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
          <h3 className="text-base font-semibold mb-1.5 leading-tight text-[#0a0a0a]">{post.title}</h3>
          <p className="text-[#525252] text-xs mb-3 line-clamp-2">{post.description}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2" onClick={(e) => { if (authorLink) e.stopPropagation(); }}>
              {authorLink ? (
                <Link href={authorLink} className="flex items-center gap-2 hover:underline">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-[#f0f0f0]">
                    {displayAvatar ? <Image src={displayAvatar} alt={displayName} width={20} height={20} className="object-cover w-full h-full" /> : null}
                  </div>
                  <span className="text-xs text-[#0a0a0a] font-medium">{displayName}</span>
                  <VerifiedBadge className="scale-75" />
                </Link>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-[#f0f0f0]">
                    {displayAvatar ? <Image src={displayAvatar} alt={displayName} width={20} height={20} className="object-cover w-full h-full" /> : null}
                  </div>
                  <span className="text-xs text-[#737373]">{displayName}</span>
                  {postUser?.verified && <VerifiedBadge className="scale-75" />}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleShare} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Share2 className="w-4 h-4 text-[#737373]" />
              </button>
              <div onClick={(e) => e.stopPropagation()}>
                <SaveBookmarkButton postId={post.id} onSaveChange={onSaveChange} initialSaved={initialSaved} savedPostIds={savedPostIds} />
              </div>
              <ReadButton onRead={onReadArticle} postId={post.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsoredArticleCard({ post, onReadArticle, onSaveChange, initialSaved = false, savedPostIds }: { post: any; onReadArticle: (id: number) => void; onSaveChange?: (postId: number, isSaved: boolean) => void; initialSaved?: boolean; savedPostIds?: Set<number> }) {
  const { currentUserId } = useContext(AuthContext);
  const author = newsAuthors.find(a => a.id === post.authorId);
  const [shareCount, setShareCount] = useState(post.stats?.shares || 0);
  if (!author) return null;

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = typeof window !== "undefined" ? window.location.href + `#article-${post.id}` : "";
    const title = post.title || "Check out this article";
    const text = `${title} - ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setShareCount((prev: number) => prev + 1);
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
    }

    const shareOptions = [
      { name: "Twitter", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
      { name: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
      { name: "LinkedIn", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
      { name: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(text)}` },
      { name: "Telegram", url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
      { name: "Copy Link", action: () => navigator.clipboard.writeText(url).then(() => alert("Link copied to clipboard!")) },
    ];

    const selectedOption = prompt(
      "Choose a platform:\n" +
      shareOptions.map((opt, i) => `${i + 1}. ${opt.name}`).join("\n")
    );

    const index = selectedOption ? parseInt(selectedOption) - 1 : -1;
    if (index >= 0 && index < shareOptions.length) {
      const option = shareOptions[index];
      if (option.action) {
        option.action();
      } else {
        window.open(option.url, "_blank", "width=600,height=400");
      }
      setShareCount((prev: number) => prev + 1);
    }
  };

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
              <button onClick={handleShare} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Share2 className="w-4 h-4 text-[#737373]" />
              </button>
              <div onClick={(e) => e.stopPropagation()}>
                <SaveBookmarkButton postId={post.id} onSaveChange={onSaveChange} initialSaved={initialSaved} savedPostIds={savedPostIds} />
              </div>
              <ReadButton onRead={onReadArticle} postId={post.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleDetailView({ postId, posts, users, onBack, onSaveChange, savedPostIds, pathname }: { postId: number; posts: any[]; users: any[]; onBack: () => void; onSaveChange?: (postId: number, isSaved: boolean) => void; savedPostIds?: Set<number>; pathname?: string }) {
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
  const [shareCount, setShareCount] = useState(post.stats?.shares || 0);

  if (!post) return null;

  const handleShare = async () => {
    console.log("Share button clicked in main page");
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      console.log("URL:", url);
      const title = post.title || "Check out this article";
      const text = `${title} - ${url}`;

      if (navigator.share) {
        console.log("Using native share");
        await navigator.share({ title, text, url });
        return;
      }

      console.log("Using prompt fallback");
      const shareOptions = [
        { name: "Twitter", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
        { name: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
        { name: "LinkedIn", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
        { name: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(text)}` },
        { name: "Copy Link", action: () => navigator.clipboard.writeText(url).then(() => alert("Link copied to clipboard!")) },
      ];

      const selectedOption = prompt(
        "Choose a platform:\n" +
        shareOptions.map((opt, i) => `${i + 1}. ${opt.name}`).join("\n")
      );

      const index = selectedOption ? parseInt(selectedOption) - 1 : -1;
      if (index >= 0 && index < shareOptions.length) {
        const option = shareOptions[index];
        if (option.action) {
          option.action();
        } else {
          window.open(option.url, "_blank", "width=600,height=400");
        }
        setShareCount((prev: number) => prev + 1);
      }
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  // For real DB articles, use saved articleContent.paragraphs (TipTap HTML)
  const dbContent: string[] = (post as any)?.articleContent?.paragraphs ?? [];
  const content: string[] = isSponsoredArticle
    ? generateSponsoredArticleContent(postId)
    : isNewsArticle
      ? generateNewsArticleContent(postId)
      : dbContent.length > 0 ? dbContent : generateArticleContent(postId);
  const displayName = author?.name || postUser?.name || "";
  const displayAvatar = author?.avatar || postUser?.avatar || "";
  const displayTitle = author ? `${author.role} @ ${author.org}` : postUser?.title || "";
  const authorLink = author ? `/author/${author.handle}` : postUser ? `/${postUser.handle}` : null;
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
            <button onClick={() => handleInteraction(() => { setIsLiked(!isLiked); if (!isSponsoredArticle && !isNewsArticle) api.likePost(post.id, isLiked ? "unlike" : "like").catch(() => { }); })} className={`p-2 rounded-lg transition-colors ${isLiked ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
            </button>
            <SaveBookmarkButton postId={post.id} onSaveChange={onSaveChange} initialSaved={savedPostIds?.has(post.id) || false} savedPostIds={savedPostIds || new Set()} popupPosition="top" />
            <button onClick={handleShare} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]">
              <Share2 className="w-4 h-4" />
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
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white bg-[#f0f0f0]">
                  {displayAvatar ? <Image src={displayAvatar} alt={displayName} width={48} height={48} className="object-cover w-full h-full" /> : null}
                </div>
              </Link>
            ) : (
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white bg-[#f0f0f0]">
                {displayAvatar ? <Image src={displayAvatar} alt={displayName} width={48} height={48} className="object-cover w-full h-full" /> : null}
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
          {content.map((paragraph: string, i: number) =>
            paragraph.trim().startsWith("<") ? (
              <div key={i} className="ProseMirror text-[#262626] leading-relaxed text-base sm:text-lg" dangerouslySetInnerHTML={{ __html: paragraph }} />
            ) : (
              <p key={i} className="text-[#262626] leading-relaxed mb-5 text-base sm:text-lg">{paragraph}</p>
            )
          )}
        </div>

        <div className="flex items-center justify-between py-4 border-t border-b border-[#e5e5e5] mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => handleInteraction(() => { setIsLiked(!isLiked); if (!isSponsoredArticle && !isNewsArticle) api.likePost(post.id, isLiked ? "unlike" : "like").catch(() => { }); })} className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${isLiked ? "bg-[#F44444]/10 text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#737373]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} /><span className="text-sm font-medium">{post.stats.likes}</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors">
              <MessageCircle className="w-5 h-5" /><span className="text-sm font-medium">{post.stats.comments}</span>
            </button>
          </div>
          <SaveBookmarkButton postId={post.id} onSaveChange={onSaveChange} initialSaved={savedPostIds?.has(post.id) || false} savedPostIds={savedPostIds || new Set()} popupPosition="top" />
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
                {displayAvatar ? (
                  <Image src={displayAvatar} alt={displayName} width={64} height={64} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-[#F44444]/10 flex items-center justify-center">
                    <span className="text-xl font-semibold text-[#F44444]">{displayName?.[0]?.toUpperCase()}</span>
                  </div>
                )}
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
            <Link href={`/${postUser.handle}?from=${encodeURIComponent(pathname || '/')}`} className="flex items-start gap-4 group">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-[#fafafa] flex-shrink-0">
                <Image src={postUser.avatar} alt={postUser.name} width={64} height={64} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-semibold text-lg text-[#0a0a0a] group-hover:text-[#F44444] transition-colors">{postUser.name}</span>
                  <VerifiedBadge />
                </div>
                <p className="text-sm text-[#737373]">{postUser.title}</p>
                {(postUser as any).bio && <p className="text-xs text-[#525252] mt-1 line-clamp-2">{(postUser as any).bio}</p>}
              </div>
            </Link>
            {!isCurrentUser && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#f0f0f0]">
                <button onClick={() => handleInteraction(() => toggleFollow(postUser.id))} className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${isFollowing ? "bg-white text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
                  {isFollowing ? "Following" : "Follow"}
                </button>
                <Link href={`/${postUser.handle}?from=${encodeURIComponent(pathname || '/')}`} className="px-4 py-2 text-sm font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">
                  View profile
                </Link>
              </div>
            )}
          </div>
        )}
      </article>
    </main>
  );
}

export default function ActivitiesPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(0);
  const { following } = useContext(FollowingContext);
  const { currentUserId, isSignedIn } = useContext(AuthContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [posts, setPosts] = useState(fallbackPosts);
  const [topics, setTopics] = useState(defaultTopics);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<number>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Set activeTab from filter query parameter
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter) {
      const tabIndex = filterTabs.findIndex(tab => tab.toLowerCase() === filter.toLowerCase());
      if (tabIndex !== -1) {
        setActiveTab(tabIndex);
      }
    }
  }, [searchParams]);

  // Simple debug for savedPostIds
  useEffect(() => {
    if (savedPostIds.size > 0) {
      console.log("savedPostIds updated:", Array.from(savedPostIds));
    }
  }, [savedPostIds]);



  const toggleTopic = (id: string) => {
    setTopics(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t);
      if (isSignedIn && currentUserId && currentUserId > 0) {
        const selectedIds = updated.filter(t => t.selected).map(t => t.id);
        fetch("/api/interests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, interests: selectedIds }),
        }).catch(() => {});
      }
      return updated;
    });
  };

  const handleSaveChange = (postId: number, isSaved: boolean) => {
    setSavedPostIds(prev => {
      const newSet = new Set(prev);
      if (isSaved) {
        newSet.add(postId);
      } else {
        newSet.delete(postId);
      }
      return newSet;
    });
  };

  // Fetch from Supabase API (falls back to hardcoded on error)
  const fetchData = () => {
    Promise.all([api.getUsers(), api.getPosts()])
      .then(([u, p]) => {
        setUsers(u);
        setPosts(p);
        // After posts render, scroll to hash if present (e.g. from notification click)
        const hash = window.location.hash;
        if (hash?.startsWith("#post-")) {
          setTimeout(() => {
            const el = document.getElementById(hash.slice(1));
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      })
      .catch(() => { });
  };
  useEffect(() => {
    fetchData();
  }, []);

  // Separate useEffect for user data that depends on currentUserId
  useEffect(() => {
    // Load user's liked and saved posts when currentUserId is available
    if (isSignedIn && currentUserId && currentUserId > 0) {
      console.log("Loading saved posts for user:", currentUserId);
      api.getLikedPosts(currentUserId).then(ids => setLikedPostIds(new Set(ids))).catch(() => { });
      api.getSaved().then(data => {
        if (!data || data.success === false) return;
        console.log("Saved posts API response:", data.success, "posts:", data.posts?.length);
        // The API returns saved post objects with postId property
        // Deduplicate posts by postId to ensure only one post per ID
        const uniquePosts = data.posts.filter((post: any, index: number, self: any[]) =>
          index === self.findIndex((p: any) => p.postId === post.postId)
        );
        const ids = uniquePosts.map((p: any) => p.postId);
        console.log("Setting savedPostIds:", ids);
        setSavedPostIds(new Set(ids));
      }).catch((error) => {
        console.error("Error loading saved posts:", error);
      });
      api.getBlockedUsers(currentUserId).then(list => {
        setBlockedUserIds(new Set(list.map((b: any) => b.blockedId)));
      }).catch(() => { });

      // Load user interests and update topics
      fetch(`/api/interests?userId=${currentUserId}`)
        .then(res => res.json())
        .then(data => {
          setTopics(matchInterestsToTopics(data));
        })
        .catch(() => { });
    } else {
      console.log("Not loading saved posts - currentUserId:", currentUserId);
      // For anonymous users, keep all selected by default
      setTopics(prev => prev.map(t => ({ ...t, selected: true })));
    }
  }, [currentUserId]);

  // Fallback: Try to load saved posts after a delay if not loaded yet
  useEffect(() => {
    if (savedPostIds.size === 0 && isSignedIn && currentUserId > 0) {
      console.log("Fallback: No saved posts loaded, retrying in 1 second...");
      const timer = setTimeout(() => {
        api.getSaved().then(data => {
          if (!data || data.success === false) return;
          console.log("Fallback API response:", data.success, "posts:", data.posts?.length);
          const uniquePosts = data.posts.filter((post: any, index: number, self: any[]) =>
            index === self.findIndex((p: any) => p.postId === post.postId)
          );
          const ids = uniquePosts.map((p: any) => p.postId);
          console.log("Fallback setting savedPostIds:", ids);
          setSavedPostIds(new Set(ids));
        }).catch((error) => {
          console.error("Fallback error:", error);
        });
      }, 1000); // Wait 1 second for authentication to settle
      return () => clearTimeout(timer);
    }
  }, [savedPostIds.size, isSignedIn, currentUserId]);

  // Event listeners setup
  useEffect(() => {
    const onPostCreated = () => fetchData();
    const onPostSaved = () => {
      // Skip automatic refresh since handleSaveChange already updates local state
      // This prevents conflicts between immediate local updates and API refresh
    };

    const onInterestsUpdated = () => {
      if (currentUserId && currentUserId > 0) {
        fetch(`/api/interests?userId=${currentUserId}`)
          .then(res => res.json())
          .then(data => {
            setTopics(matchInterestsToTopics(data));
          })
          .catch(() => { });
      }
    };

    window.addEventListener("albiz-post-created", onPostCreated);
    window.addEventListener("albiz-post-saved", onPostSaved);
    window.addEventListener("albiz-interests-updated", onInterestsUpdated);
    return () => {
      window.removeEventListener("albiz-post-created", onPostCreated);
      window.removeEventListener("albiz-post-saved", onPostSaved);
      window.removeEventListener("albiz-interests-updated", onInterestsUpdated);
    };
  }, []);

  // Refresh saved posts when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSignedIn && currentUserId) {
        api.getSaved().then(data => {
          if (!data || data.success === false) return;
          const uniquePosts = data.posts.filter((post: any, index: number, self: any[]) =>
            index === self.findIndex((p: any) => p.postId === post.postId)
          );
          const ids = uniquePosts.map((p: any) => p.postId);
          setSavedPostIds(new Set(ids));
        }).catch(() => { });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUserId]);

  // Build set of allowed tags from selected content preferences
  const selectedTags = new Set(topics.filter(t => t.selected).flatMap(t => t.tags));

  const applyPreferences = (postList: any[]) => {
    // If all topics are selected, skip filtering (show everything)
    if (topics.every(t => t.selected)) return postList;

    // If NO topics are selected (e.g. they unselected everything manually), also show everything or show nothing?
    // Usually if they unselect everything they might want to see everything again.
    if (topics.every(t => !t.selected)) return postList;

    // Keep posts that have at least one tag matching selected preferences
    return postList.filter(post => {
      if (!post.tags || post.tags.length === 0) return true; // posts without tags always show
      return post.tags.some((tag: string) => selectedTags.has(tag));
    });
  };

  // Merge regular posts with news articles for the feed - exclude own posts and blocked users
  const othersPosts = posts.filter(p => p.userId !== currentUserId && !blockedUserIds.has(p.userId));

  // Deduplicate posts by ID to ensure only one post per ID
  const deduplicatedPosts = othersPosts.filter((post: any, index: number, self: any[]) =>
    index === self.findIndex((p: any) => p.id === post.id)
  );

  const allContent = [...deduplicatedPosts, ...newsArticles];

  // Transform content to match AlgorithmPost interface
  const transformContentForAlgorithm = (content: any[]) => {
    return content.map(item => {
      if ('authorId' in item) {
        // This is a news article - convert authorId to userId
        return {
          ...item,
          userId: item.authorId,
          // Ensure it has required properties
          type: item.type || 'article',
          date: item.date,
          tags: item.tags || [],
          stats: item.stats || { views: '0', likes: '0', comments: '0', shares: '0' }
        };
      }
      // This is a regular post - already has userId
      return {
        ...item,
        type: item.type || 'post',
        tags: item.tags || [],
        stats: item.stats || { views: '0', likes: '0', comments: '0', shares: '0' }
      };
    });
  };

  const normalizedContent = allContent.map(item => ({
    ...item,
    userId: (item as any).userId || (item as any).authorId
  }));

  const getFilteredPosts = () => {
    const tabName = filterTabs[activeTab];
    switch (tabName) {
      case "Following":
        return applyPreferences(othersPosts.filter(post => following.has(post.userId)));
      case "News": {
        const regularNews = othersPosts.filter(post => post.tags?.includes("News"));
        return [...newsArticles, ...regularNews];
      }
      case "AI":
        return normalizedContent.filter(post => post.tags?.includes("AI"));
      case "Technology":
        return normalizedContent.filter(post => post.tags?.includes("Technology"));
      case "Trending":
        return applyPreferences(rankPosts(normalizedContent as any[], users, following, currentUserId, { mode: "trending", selectedTags }));
      default:
        // For You feed - show everything but prioritized by interests and follows
        // If all topics are selected, we don't filter, but we still pass selectedTags for ranking boost
        const ranked = rankPosts(normalizedContent as any[], users, following, currentUserId, { mode: "for-you", selectedTags });
        return applyPreferences(ranked);
    }
  };

  const filtered = getFilteredPosts();

  // Filter posts by search query
  const searchFiltered = searchQuery.trim()
    ? filtered.filter(post => {
      const query = searchQuery.toLowerCase();
      const title = (post.title || "").toLowerCase();
      const content = (post.content || "").toLowerCase();
      const tags = (post.tags || []).join(" ").toLowerCase();

      // Handle different author structures for different post types
      let userName = "";
      let userHandle = "";

      if (post.authorId) {
        // News articles use authorId to lookup newsAuthors
        const author = newsAuthors.find((a: any) => a.id === post.authorId);
        userName = author ? author.name.toLowerCase() : "";
      } else if (post.userId) {
        // Regular posts and other types use userId to lookup users
        const user = users.find((u: any) => u.id === post.userId);
        userName = user ? user.name.toLowerCase() : "";
        userHandle = user ? user.handle.toLowerCase() : "";
      }

      // Also check sponsored post sponsor name
      let sponsorName = "";
      if (post.sponsor) {
        sponsorName = post.sponsor.name.toLowerCase();
      }

      return title.includes(query) ||
        content.includes(query) ||
        tags.includes(query) ||
        userName.includes(query) ||
        userHandle.includes(query) ||
        sponsorName.includes(query);
    })
    : filtered;

  // Interleave sponsored posts into the feed at positions: 1st slot, then every 5th
  // Don't show sponsored posts when searching
  const feedWithAds = (() => {
    if (searchFiltered.length === 0) return [];
    const items: { type: "content" | "sponsored"; data: any }[] = [];
    let adIndex = 0;
    const adInterval = 5; // place an ad every Nth posts

    // Don't show sponsored posts when searching
    if (searchQuery.trim()) {
      return searchFiltered.map(post => ({ type: "content" as const, data: post }));
    }

    // Place first ad at position 0 (top of feed)
    if (sponsoredPosts.length > 0) {
      items.push({ type: "sponsored", data: sponsoredPosts[adIndex % sponsoredPosts.length] });
      adIndex++;
    }

    for (let i = 0; i < searchFiltered.length; i++) {
      items.push({ type: "content", data: searchFiltered[i] });
      // Insert ad after every Nth content post
      if ((i + 1) % adInterval === 0 && adIndex < sponsoredPosts.length) {
        items.push({ type: "sponsored", data: sponsoredPosts[adIndex % sponsoredPosts.length] });
        adIndex++;
      }
    }

    // Deduplicate final feed items by ID to ensure only one post per ID
    // Use Map for guaranteed uniqueness - keeps first occurrence of each ID
    const uniqueItemsMap = new Map();
    items.forEach(item => {
      if (!uniqueItemsMap.has(item.data.id)) {
        uniqueItemsMap.set(item.data.id, item);
      }
    });

    const deduplicatedItems = Array.from(uniqueItemsMap.values());

    return deduplicatedItems;
  })();

  // If an article is selected, show the detail view
  if (selectedArticle) {
    return (
      <>
        <ArticleDetailView postId={selectedArticle} posts={posts} users={users} onBack={() => setSelectedArticle(null)} onSaveChange={handleSaveChange} savedPostIds={savedPostIds} pathname={pathname} />
        <RightSidebar />
      </>
    );
  }

  return (
    <>
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto">
        <FeedHeader activeTab={activeTab} setActiveTab={setActiveTab} topics={topics} onToggleTopic={toggleTopic} onSearchQuery={setSearchQuery} isSignedIn={isSignedIn} />
        {/* Stories row — visible on mobile/tablet, hidden on lg+ where RightSidebar shows them */}
        <div className="lg:hidden pt-4">
          <RecentStories />
        </div>
        <div className="space-y-3 md:space-y-4 pt-4 pb-6">
          {feedWithAds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#737373] text-sm">
                {searchQuery.trim() ? "No posts match your search." : "No posts to show."}
              </p>
            </div>
          ) : (
            feedWithAds.map((item, idx) =>
              item.type === "sponsored" ? (
                <SponsoredArticleCard key={`sponsored-${item.data.id}-${idx}`} post={item.data} onReadArticle={setSelectedArticle} onSaveChange={handleSaveChange} initialSaved={savedPostIds.has(item.data.id)} savedPostIds={savedPostIds} />
              ) : item.data.type === "article" ? (
                <ArticleCard key={`article-${item.data.id}-${idx}`} post={item.data} users={users} onReadArticle={setSelectedArticle} onSaveChange={handleSaveChange} initialSaved={savedPostIds.has(item.data.id)} savedPostIds={savedPostIds} />
              ) : (
                <PostCard key={`post-${item.data.id}-${idx}`} post={item.data} users={users} initialLiked={likedPostIds.has(item.data.id)} initialSaved={savedPostIds.has(item.data.id)} onSaveChange={handleSaveChange} savedPostIds={savedPostIds} pathname={pathname} />
              )
            )
          )}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
