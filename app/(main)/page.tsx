"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams, usePathname } from "next/navigation";
import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { Eye, EyeOff, ThumbsUp, MessageCircle, Share2, MoreVertical, Search, SlidersHorizontal, Circle, Check, Heart, Bookmark, X, ArrowLeft, Clock, MapPin, ArrowUp, Loader2, Trash2, LinkIcon, Briefcase, Laptop, Bot, Rocket, TrendingUp, Radio, Landmark, Globe, Brush, Megaphone, FlaskConical, HeartPulse, Film, Trophy, Zap, BellOff } from "lucide-react";
import { FollowingContext, AuthContext, type InteractionContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, filterTabs, generateArticleContent, newsAuthors, newsArticles, generateNewsArticleContent, sponsoredPosts, generateSponsoredArticleContent } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, SaveBookmarkButton, ReadButton, RecentStories, RightSidebar, CommentRow } from "@/app/lib/shared-components";
import { Avatar } from "@/app/components/Avatar";
import { isNative, copyToClipboard } from "@/app/lib/capacitor";
import { Toast } from "@capacitor/toast";
import { rankPosts } from "@/app/lib/algorithm";
import { getUserTimezone, formatDate } from "@/app/lib/format-date";
import { useContentTranslation } from "@/app/lib/useContentTranslation";
import { Share as CapacitorShare } from '@capacitor/share';
import { sanitizeHtml, looksLikeHtml } from '@/lib/html-sanitize';

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

const matchInterestsToTopics = (interests: string[], defaultToAllIfEmpty = true) => {
  if (!interests || interests.length === 0) {
    return defaultTopics.map(t => ({ ...t, selected: defaultToAllIfEmpty }));
  }
  const lowerInterests = new Set(interests.map((i: string) => i.toLowerCase()));
  const updated = defaultTopics.map(t => ({
    ...t,
    selected:
      lowerInterests.has(t.id.toLowerCase()) ||
      lowerInterests.has(t.label.toLowerCase()) ||
      t.tags.some((tag: string) => lowerInterests.has(tag.toLowerCase())),
  }));
  return updated;
};

function FeedHeader({ activeTab, setActiveTab, topics, onToggleTopic, onSetAllTopics, onSearchQuery, isSignedIn }: { activeTab: number; setActiveTab: (t: number) => void; topics: ContentTopic[]; onToggleTopic: (id: string) => void; onSetAllTopics: (selected: boolean) => void; onSearchQuery: (query: string) => void; isSignedIn: boolean }) {
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
    <div className="sticky top-0 bg-white z-30 pt-1 pb-3 md:py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
      <div className="flex items-center justify-between mb-3 md:mb-4">
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
            <h1 className="text-xl font-semibold text-[#0a0a0a]">Activities</h1>
            <div className="flex items-center gap-1 md:gap-2">
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
                        onClick={() => onSetAllTopics(!topics.every(t => t.selected))}
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
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
        {filterTabs.filter(tab => isSignedIn || tab !== "Following").map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(filterTabs.indexOf(tab))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterTabs.indexOf(tab) === activeTab
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

function PostCardSkeleton({ withImage = false }: { withImage?: boolean }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] p-3 md:p-4 bg-white animate-pulse">
      {/* author row — mirrors: avatar + name/date/title + follow button + menu dot */}
      <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#ebebeb] flex-shrink-0 ring-1 ring-[#e5e5e5]" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-3 w-[100px] bg-[#ebebeb] rounded" />
              <div className="h-3 w-[52px] bg-[#ebebeb] rounded" />
            </div>
            <div className="h-2.5 w-[120px] bg-[#ebebeb] rounded" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="h-6 w-[60px] bg-[#ebebeb] rounded-full" />
          <div className="w-6 h-6 bg-[#ebebeb] rounded" />
        </div>
      </div>

      {/* body text — mirrors text-sm content lines */}
      <div className="mb-2 md:mb-3 space-y-2">
        <div className="h-3.5 w-full bg-[#ebebeb] rounded" />
        <div className="h-3.5 w-[92%] bg-[#ebebeb] rounded" />
        <div className="h-3.5 w-[76%] bg-[#ebebeb] rounded" />
      </div>

      {/* optional image — mirrors rounded-xl mb-3 */}
      {withImage && <div className="h-[200px] w-full bg-[#ebebeb] rounded-xl mb-3" />}

      {/* stats bar — mirrors border-t with eye/heart/comment/share + bookmark */}
      <div className="flex items-center justify-between pt-1.5 md:pt-2 border-t border-[#f0f0f0]">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="h-3 w-[34px] bg-[#ebebeb] rounded" />
          <div className="h-3 w-[34px] bg-[#ebebeb] rounded" />
          <div className="h-3 w-[34px] bg-[#ebebeb] rounded" />
          <div className="h-6 w-[36px] bg-[#ebebeb] rounded-full" />
        </div>
        <div className="w-6 h-6 bg-[#ebebeb] rounded" />
      </div>
    </div>
  );
}

function ArticleCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4">
        {/* thumbnail — mirrors w-full sm:w-40 h-40 rounded-lg */}
        <div className="w-full sm:w-40 h-40 sm:h-auto flex-shrink-0 rounded-lg bg-[#ebebeb]" />

        <div className="flex-1 min-w-0">
          {/* tags + menu row — mirrors flex justify-between mb-2 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-[56px] bg-[#ebebeb] rounded" />
              <div className="h-3 w-3 bg-[#ebebeb] rounded-full" />
              <div className="h-3 w-[48px] bg-[#ebebeb] rounded" />
            </div>
            <div className="w-7 h-7 bg-[#ebebeb] rounded-lg" />
          </div>

          {/* title — mirrors text-base font-semibold mb-1.5 */}
          <div className="space-y-1.5 mb-1.5">
            <div className="h-4 w-full bg-[#ebebeb] rounded" />
            <div className="h-4 w-[78%] bg-[#ebebeb] rounded" />
          </div>

          {/* description — mirrors text-xs mb-3 line-clamp-2 */}
          <div className="space-y-1.5 mb-3">
            <div className="h-3 w-full bg-[#ebebeb] rounded" />
            <div className="h-3 w-[62%] bg-[#ebebeb] rounded" />
          </div>

          {/* author + actions row — mirrors flex justify-between */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#ebebeb]" />
              <div className="h-3 w-[80px] bg-[#ebebeb] rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#ebebeb] rounded-lg" />
              <div className="w-7 h-7 bg-[#ebebeb] rounded-lg" />
              <div className="h-7 w-[56px] bg-[#ebebeb] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      <PostCardSkeleton withImage />
      <ArticleCardSkeleton />
      <PostCardSkeleton />
      <ArticleCardSkeleton />
      <PostCardSkeleton withImage />
      <ArticleCardSkeleton />
    </div>
  );
}

function PostCard({ post, users, initialLiked = false, initialSaved = false, savedPostIds, onSaveChange, pathname, onRemove, highlighted = false }: { post: any; users: any[]; initialLiked?: boolean; initialSaved?: boolean; savedPostIds?: Set<number>; onSaveChange?: (postId: number, isSaved: boolean) => void; pathname?: string; onRemove?: (postId: number) => void; highlighted?: boolean }) {
  // Support both enriched feed (post.user embedded) and legacy (lookup by userId)
  const postUser = post.user ?? users.find((u: any) => u.id === post.userId);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { userRole, isSignedIn, requireGuestAuth, currentUserId } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [liked, setLiked] = useState(initialLiked);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [commentCount, setCommentCount] = useState(post.stats.comments);
  const [shareCount, setShareCount] = useState(post.stats.shares);
  // Sync when initial values load asynchronously
  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsCursor, setCommentsCursor] = useState<number | null>(null);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [copied, setCopied] = useState(false);

  // Impression + scroll-past + dwell-duration tracking
  const cardRef = useRef<HTMLDivElement>(null);
  const enterTime = useRef<number | null>(null);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impressionSent = useRef(false);  // true after first DB write ever
  const thisVisitNew = useRef(false);  // true only for the current visit where impression fired
  // Dwell already fired this session — don't scroll_past penalize a post already read
  const dwellFired = useRef(false);

  // UGC translation — shared across Post, Article, and News.
  const userTz = getUserTimezone();
  const {
    state: translateState,
    translated: translatedFields,
    showTranslated,
    isTranslatable: hasTranslatableContent,
    handleTranslate,
    toggleOriginal,
    isRtl,
  } = useContentTranslation("post", post.id, {
    // post.content is plain text from the compose textarea unless the post
    // was later edited through the contenteditable rich-text editor, which
    // is the only path that produces real tags — no stored flag tells us
    // which, so detect it the same way the sanitizer would.
    content: post.content ? (looksLikeHtml(post.content) ? { html: post.content } : post.content) : undefined,
    description: post.type === "article" && "description" in post ? post.description : undefined,
  });
  const translatedContent = translatedFields?.content ?? null;
  const translatedDescription = translatedFields?.description ?? null;

  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          enterTime.current = Date.now();
          thisVisitNew.current = false;

          if (!impressionSent.current && isSignedIn && currentUserId) {
            impressionSent.current = true;
            thisVisitNew.current = true;
            const position = (post as any).position ?? undefined;
            api.recordImpression(post.id, "view", currentUserId, undefined, position)
              .catch(() => { });
            // After 5s mark the user as reading — actual dwell fires on exit with real elapsed time
            dwellTimer.current = setTimeout(() => {
              dwellFired.current = true;
            }, 5000);
          }
        } else {
          if (dwellTimer.current) { clearTimeout(dwellTimer.current); dwellTimer.current = null; }

          // Dwell: fires on exit if user read for 5+ seconds — captures actual time spent
          if (
            enterTime.current &&
            thisVisitNew.current &&
            dwellFired.current &&
            isSignedIn && currentUserId
          ) {
            const secs = Math.round((Date.now() - enterTime.current) / 1000);
            const position = (post as any).position ?? undefined;
            api.recordImpression(post.id, "dwell", currentUserId, secs, position).catch(() => { });
          }

          // Scroll-past: only fires if this specific visit triggered a new impression
          // AND the user hasn't already dwelled (read) this post before
          if (
            enterTime.current &&
            thisVisitNew.current &&
            !dwellFired.current &&
            isSignedIn && currentUserId
          ) {
            const timeOnScreen = Date.now() - enterTime.current;
            if (timeOnScreen < 2000 && timeOnScreen > 300) {
              api.recordImpression(post.id, "scroll_past", currentUserId).catch(() => { });
            }
          }

          enterTime.current = null;
          thisVisitNew.current = false;
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(cardRef.current);
    return () => {
      observer.disconnect();
      if (dwellTimer.current) clearTimeout(dwellTimer.current);
    };
  }, [isSignedIn, currentUserId, post.id]);

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

  const handleInteraction = (action: () => void, context: InteractionContext = 'default') => {
    requireGuestAuth(context, action);
  };

  const handleDeletePost = () => {
    setMenuOpen(false);
    api.deletePost(post.id).catch(() => { });
    setDeleted(true);
    window.dispatchEvent(new Event("albiz-post-created"));
  };

  const handleNotInterested = () => {
    setMenuOpen(false);
    api.notInterested(post.id).catch(() => { });
    setDeleted(true);
    onRemove?.(post.id);
  };

  const handleMuteAuthor = () => {
    setMenuOpen(false);
    api.muteUser(postUser.id).catch(() => { });
    setDeleted(true);
    onRemove?.(post.id);
  };

  const handleLike = () => {
    if (likeLoading) return;
    setLikeLoading(true);
    const prev = liked;
    const newLiked = !liked;
    setLiked(newLiked);

    api.likePost(post.id, newLiked ? "like" : "unlike", currentUserId)
      .then(res => { if (res.likes) setLikeCount(res.likes); })
      .catch(() => { setLiked(prev); })
      .finally(() => setLikeLoading(false));
  };

  const toggleComments = () => {
    const opening = !showComments;
    setShowComments(opening);
    // Load comments in background — show input immediately
    if (opening && comments.length === 0) {
      setLoadingComments(true);
      api.getComments(post.id)
        .then((result) => {
          const data = result.comments ?? [];
          setCommentsCursor(result.nextCursor ?? null);
          setCommentsHasMore(result.hasMore ?? false);
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

  const loadMoreComments = () => {
    if (!commentsHasMore || loadingMoreComments || !commentsCursor) return;
    setLoadingMoreComments(true);
    api.getComments(post.id, commentsCursor)
      .then((result) => {
        const data = result.comments ?? [];
        setCommentsCursor(result.nextCursor ?? null);
        setCommentsHasMore(result.hasMore ?? false);
        setComments(prev => {
          const existingIds = new Set(prev.map((c: any) => c.id));
          return [...prev, ...data.filter((c: any) => !existingIds.has(c.id))];
        });
      })
      .catch(() => { })
      .finally(() => setLoadingMoreComments(false));
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

  const persistShare = () => {
    setShareCount((prev: number) => prev + 1);
    fetch(`/api/posts/${post.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentUserId }) }).catch(() => { });
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    const title = post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || post.title || "Check out this post";
    const text = `${title} - ${url}`;

    if (isNative) {
      try {
        await CapacitorShare.share({ title, text, url });
        setShareCount((prev: number) => prev + 1);
        Toast.show({ text: "Post shared" });
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
      return;
    } else if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        persistShare();
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
    }

    setShowSharePopup(true);
  };

  const copyLink = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowSharePopup(false);
    persistShare();
  };

  const shareToWhatsApp = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    const title = post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || post.title || "Check out this post";
    const text = `${title} - ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setShowSharePopup(false);
    persistShare();
  };

  const shareToTwitter = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    const title = post.content?.replace(/<[^>]*>/g, "").slice(0, 100) || post.title || "Check out this post";
    const text = `${title} - ${url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    setShowSharePopup(false);
    persistShare();
  };

  const shareToFacebook = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    setShowSharePopup(false);
    persistShare();
  };

  const shareToLinkedIn = () => {
    const url = typeof window !== "undefined" ? window.location.href + `#post-${post.id}` : "";
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
    setShowSharePopup(false);
    persistShare();
  };

  return (
    <div ref={cardRef} id={`post-${post.id}`} className={`rounded-xl border p-3 md:p-4 transition-all duration-700 ${highlighted ? "animate-target-highlight border-[#F44444]/60 bg-[#F44444]/[0.04]" : "animate-fade-in border-[#e5e5e5] bg-white hover:border-[#d5d5d5]"}`}>
      <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
        <Link href={`/${postUser.handle}?from=${encodeURIComponent(pathname || '/')}`} className="flex items-center gap-2.5 min-w-0">
          <Avatar src={postUser.avatar} name={postUser.name} alt={postUser.name} size={32} className="ring-1 ring-[#e5e5e5]" />
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
            {post.reason && post.source === "out-of-network" && (
              <span className="text-[10px] text-[#a3a3a3] truncate block mt-0.5">{post.reason}</span>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isCurrentUser && (
            <button
              onClick={() => handleInteraction(() => {
                if (!isFollowing) {
                  api.recordImpression(post.id, "follow_author" as any, currentUserId).catch(() => { });
                }
                toggleFollow(postUser.id);
              }, "follow")}
              className={`px-3 py-1.5 md:px-4 md:py-2 text-[13px] font-medium rounded-full transition-all duration-200 ${isFollowing
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
                  <>
                    <button onClick={(e) => { e.stopPropagation(); handleNotInterested(); }} className="w-full text-left px-3 py-2 text-xs text-[#737373] hover:bg-[#fafafa] flex items-center gap-2">
                      <EyeOff className="w-3 h-3" /> Not interested
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleMuteAuthor(); }} className="w-full text-left px-3 py-2 text-xs text-[#737373] hover:bg-[#fafafa] flex items-center gap-2">
                      <BellOff className="w-3 h-3" /> Mute {postUser.name}
                    </button>
                  </>
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
        <p className="text-sm text-[#525252] mb-2 md:mb-3" dir={isRtl ? "rtl" : undefined}>
          {showTranslated && translatedDescription ? translatedDescription : post.description}
        </p>
      )}
      {post.content && (
        <>
          <div
            className="text-sm text-[#262626] mb-1 md:mb-2 [&_b]:font-bold [&_i]:italic [&_a]:text-[#F44444] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dir={isRtl ? "rtl" : undefined}
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(showTranslated && translatedContent ? translatedContent : post.content).replace(/#(\w+)/g, '<span style="color:#F44444;font-weight:500">#$1</span>'),
            }}
          />
          {hasTranslatableContent && (
            <div className="mb-2 md:mb-3">
              {showTranslated ? (
                <button onClick={toggleOriginal} className="text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors">
                  Show original
                </button>
              ) : (
                <button
                  onClick={handleTranslate}
                  disabled={translateState === "loading"}
                  className="text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors disabled:opacity-60"
                >
                  {translateState === "loading" ? "Translating…" : "Translate"}
                </button>
              )}
            </div>
          )}
        </>
      )}
      {"image" in post && post.image && (
        <div className="relative rounded-xl overflow-hidden mb-3 aspect-[2/1]">
          <Image src={post.image} alt="Post" fill sizes="(max-width: 768px) 100vw, 680px" className="object-cover" />
        </div>
      )}
      {/* Stats + Actions */}
      <div className="flex items-center justify-between pt-1.5 md:pt-2 border-t border-[#f0f0f0]">
        <div className="flex items-center gap-3 md:gap-4 text-[#737373]">
          <button
            onClick={() => handleInteraction(handleLike, "like")}
            disabled={likeLoading}
            className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-[#F44444]" : "hover:text-[#525252]"} ${likeLoading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? "fill-[#F44444]" : ""}`} />
            {likeCount}
          </button>
          <button onClick={() => handleInteraction(toggleComments, "comment")} className={`flex items-center gap-1 text-xs ${showComments ? "text-[#F44444]" : "text-[#737373]"}`}>
            <MessageCircle className={`w-3.5 h-3.5 ${showComments ? "fill-[#F44444]/10" : ""}`} />
            {commentCount}
          </button>
          <button onClick={handleShare} className="flex items-center gap-1 text-xs text-[#737373] hover:text-[#525252] transition-colors">
            <Share2 className="w-3.5 h-3.5" />
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
              <Avatar src={currentUserData.avatar} name={currentUserData.name} alt="" size={28} className="ring-1 ring-[#e5e5e5]" />
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
                <CommentRow
                  key={c.id}
                  comment={c}
                  currentUserId={currentUserId}
                  userTz={userTz}
                  onDelete={(commentId) => {
                    api.deleteComment(post.id, commentId).catch(() => { });
                    setComments(prev => prev.filter(x => x.id !== commentId));
                    const n = parseInt(commentCount) || 0;
                    setCommentCount(String(Math.max(0, n - 1)));
                  }}
                />
              ))}
              {commentsHasMore && (
                <button
                  onClick={loadMoreComments}
                  disabled={loadingMoreComments}
                  className="w-full text-xs text-[#737373] hover:text-[#0a0a0a] py-1.5 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {loadingMoreComments ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {loadingMoreComments ? "Loading…" : "Load more comments"}
                </button>
              )}
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

function ArticleCard({ post, users, onReadArticle, onSaveChange, initialSaved = false, savedPostIds, onRemove, highlighted = false }: { post: any; users: any[]; onReadArticle: (id: number) => void; onSaveChange?: (postId: number, isSaved: boolean) => void; initialSaved?: boolean; savedPostIds?: Set<number>; onRemove?: (postId: number) => void; highlighted?: boolean }) {
  const { currentUserId, isSignedIn } = useContext(AuthContext);
  const isNewsArticle = "authorId" in post;
  const author = isNewsArticle ? newsAuthors.find(a => a.id === post.authorId) : null;
  const postUser = !isNewsArticle ? (post.user ?? users.find((u: any) => u.id === post.userId)) : null;
  const displayName = author?.name || postUser?.name || "";
  const displayAvatar = author?.avatar || postUser?.avatar || "";
  const authorLink = author ? `/author/${author.handle}` : null;
  const [shareCount, setShareCount] = useState(post.stats?.shares || 0);
  const [menuOpen, setMenuOpen] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const enterTime = useRef<number | null>(null);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impressionSent = useRef(false);
  const thisVisitNew = useRef(false);
  const dwellFired = useRef(false);

  // Impression + dwell + scroll-past — only for real DB articles (not news/sponsored)
  useEffect(() => {
    if (isNewsArticle || !cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          enterTime.current = Date.now();
          thisVisitNew.current = false;
          if (!impressionSent.current && isSignedIn && currentUserId) {
            impressionSent.current = true;
            thisVisitNew.current = true;
            const position = (post as any).position ?? undefined;
            api.recordImpression(post.id, "view", currentUserId, undefined, position).catch(() => { });
            // After 5s mark as reading — dwell fires on exit with actual elapsed time
            dwellTimer.current = setTimeout(() => {
              dwellFired.current = true;
            }, 5000);
          }
        } else {
          if (dwellTimer.current) { clearTimeout(dwellTimer.current); dwellTimer.current = null; }
          // Dwell: fires on exit if user read 5+ seconds — captures real time spent
          if (enterTime.current && thisVisitNew.current && dwellFired.current && isSignedIn && currentUserId) {
            const secs = Math.round((Date.now() - enterTime.current) / 1000);
            const position = (post as any).position ?? undefined;
            api.recordImpression(post.id, "dwell", currentUserId, secs, position).catch(() => { });
          }
          if (enterTime.current && thisVisitNew.current && !dwellFired.current && isSignedIn && currentUserId) {
            const timeOnScreen = Date.now() - enterTime.current;
            if (timeOnScreen < 2000 && timeOnScreen > 300) {
              api.recordImpression(post.id, "scroll_past", currentUserId).catch(() => { });
            }
          }
          enterTime.current = null;
          thisVisitNew.current = false;
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(cardRef.current);
    return () => {
      observer.disconnect();
      if (dwellTimer.current) clearTimeout(dwellTimer.current);
    };
  }, [isSignedIn, currentUserId, post.id, isNewsArticle]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  if (!author && !postUser) return null;

  const persistShare = () => {
    setShareCount((prev: number) => prev + 1);
    fetch(`/api/posts/${post.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentUserId }) }).catch(() => { });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = typeof window !== "undefined" ? window.location.href + `#article-${post.id}` : "";
    const title = post.title || "Check out this article";
    const text = `${title} - ${url}`;

    if (isNative) {
      try {
        await CapacitorShare.share({ title, text, url });
        setShareCount((prev: number) => prev + 1);
        Toast.show({ text: "Post shared" });
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
      return;
    } else if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        persistShare();
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
      { name: "Copy Link", action: () => copyToClipboard(url).then(() => alert("Link copied to clipboard!")) },
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
      persistShare();
    }
  };

  return (
    <div
      ref={cardRef}
      id={`post-${post.id}`}
      onClick={() => onReadArticle(post.id)}
      className={`rounded-xl border overflow-hidden transition-all duration-700 cursor-pointer ${highlighted ? "animate-target-highlight border-[#F44444]/60 bg-[#F44444]/[0.04]" : "animate-fade-in border-[#e5e5e5] bg-white hover:border-[#d5d5d5] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4">
        {post.image && (
          <div className="relative w-full sm:w-40 h-40 flex-shrink-0 rounded-lg overflow-hidden">
            <Image src={post.image} alt={post.title || ""} fill sizes="(max-width: 640px) 100vw, 160px" className="object-cover" />
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
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); api.notInterested(post.id).catch(() => { }); onRemove?.(post.id); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] flex items-center gap-2.5 transition-colors">
                    <EyeOff className="w-3.5 h-3.5" /> Not interested
                  </button>
                  {postUser && (
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); api.muteUser(postUser.id).catch(() => { }); onRemove?.(post.id); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] flex items-center gap-2.5 transition-colors">
                      <BellOff className="w-3.5 h-3.5" /> Mute {postUser.name}
                    </button>
                  )}
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
                  <Avatar src={displayAvatar} name={displayName} alt={displayName} size={20} />
                  <span className="text-xs text-[#0a0a0a] font-medium">{displayName}</span>
                  <VerifiedBadge className="scale-75" />
                </Link>
              ) : (
                <>
                  <Avatar src={displayAvatar} name={displayName} alt={displayName} size={20} />
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

function CustomBannerAd({ ad, currentUserId }: { ad: any; currentUserId: number | null }) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const firedImpression = useRef(false);

  useEffect(() => {
    if (!bannerRef.current || firedImpression.current) return;
    const el = bannerRef.current;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !firedImpression.current) {
          firedImpression.current = true;
          fetch("/api/ads/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId: ad.campaignId, creativeId: ad.creativeId, type: "IMPRESSION", placement: "Custom", userId: currentUserId }),
          }).catch(() => { });
          observer.disconnect();
        }
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.campaignId, currentUserId]);

  const handleClick = () => {
    fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: ad.campaignId, creativeId: ad.creativeId, type: "CLICK", placement: "Custom", userId: currentUserId }),
    }).catch(() => { });
    if (ad.ctaUrl) window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div ref={bannerRef} onClick={handleClick} className="mx-3 sm:mx-4 md:mx-6 mt-3 rounded-xl overflow-hidden border border-[#e5e5e5] cursor-pointer hover:border-[#d5d5d5] transition-colors">
      <div className="flex items-stretch">
        {ad.image && (
          <div className="relative w-28 sm:w-40 flex-shrink-0 h-20">
            <Image src={ad.image} alt={ad.title} fill sizes="160px" className="object-cover" />
          </div>
        )}
        <div className="flex-1 flex items-center justify-between px-4 py-3 bg-white gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-medium text-[#737373] px-1.5 py-0.5 rounded bg-[#f0f0f0]">Ad</span>
              <span className="text-[10px] text-[#a3a3a3]">{ad.sponsor?.name}</span>
            </div>
            <p className="text-sm font-semibold text-[#0a0a0a] leading-tight truncate">{ad.title}</p>
            {ad.description && <p className="text-xs text-[#737373] mt-0.5 line-clamp-1">{ad.description}</p>}
          </div>
          <button className="flex-shrink-0 px-4 py-1.5 bg-[#F44444] text-white text-xs font-medium rounded-full hover:bg-[#d64d3c] transition-colors">
            {ad.ctaText || "Learn More"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SponsoredArticleCard({ post, onReadArticle, onSaveChange, initialSaved = false, savedPostIds }: { post: any; onReadArticle: (id: number) => void; onSaveChange?: (postId: number, isSaved: boolean) => void; initialSaved?: boolean; savedPostIds?: Set<number> }) {
  const { currentUserId } = useContext(AuthContext);
  const isDbAd = post.isDbAd === true;
  const author = newsAuthors.find(a => a.id === post.authorId);
  const [shareCount, setShareCount] = useState(post.stats?.shares || 0);
  const cardRef = useRef<HTMLDivElement>(null);
  const firedImpression = useRef(false);

  // Record an impression once the ad is visible (DB-served ads only)
  useEffect(() => {
    if (!isDbAd || !cardRef.current || firedImpression.current) return;
    const el = cardRef.current;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !firedImpression.current) {
          firedImpression.current = true;
          fetch("/api/ads/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId: post.campaignId, creativeId: post.creativeId, type: "IMPRESSION", placement: post.placement || "Feed", userId: currentUserId }),
          }).catch(() => { });
          observer.disconnect();
        }
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isDbAd, post.campaignId, post.placement, currentUserId]);

  const handleAdClick = () => {
    if (!isDbAd) { onReadArticle(post.id); return; }
    fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: post.campaignId, creativeId: post.creativeId, type: "CLICK", placement: post.placement || "Feed", userId: currentUserId }),
    }).catch(() => { });
    if (post.ctaUrl) { window.open(post.ctaUrl, "_blank", "noopener,noreferrer"); return; }
    if ((post.promoteType === "article" || post.promoteType === "post") && post.promoteTargetId) {
      onReadArticle(post.promoteTargetId);
    }
  };

  // Non-DB sponsored posts still require a matching news author
  if (!isDbAd && !author) return null;

  const persistShare = () => {
    setShareCount((prev: number) => prev + 1);
    fetch(`/api/posts/${post.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentUserId }) }).catch(() => { });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = typeof window !== "undefined" ? window.location.href + `#article-${post.id}` : "";
    const title = post.title || "Check out this article";
    const text = `${title} - ${url}`;

    if (isNative) {
      try {
        await CapacitorShare.share({ title, text, url });
        setShareCount((prev: number) => prev + 1);
        Toast.show({ text: "Post shared" });
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
      return;
    } else if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        persistShare();
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
      { name: "Copy Link", action: () => copyToClipboard(url).then(() => alert("Link copied to clipboard!")) },
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
      persistShare();
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={handleAdClick}
      className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white hover:border-[#d5d5d5] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all cursor-pointer animate-fade-in relative"
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4">
        {post.image && (
          <div className="w-full sm:w-40 h-40 flex-shrink-0 rounded-lg overflow-hidden relative">
            <Image src={post.image} alt={post.title || ""} fill sizes="(max-width: 640px) 100vw, 160px" className="object-cover" />
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
            </div>
          </div>
          <h3 className="text-base font-semibold mb-1.5 leading-tight text-[#0a0a0a]">{post.title}</h3>
          <p className="text-[#525252] text-xs mb-3 line-clamp-2">{post.description}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {isDbAd ? (
                <span className="flex items-center gap-1.5">
                  {post.sponsor?.logo && (
                    <div className="w-5 h-5 rounded-full overflow-hidden">
                      <Image src={post.sponsor.logo} alt={post.sponsor.name} width={20} height={20} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <span className="text-xs text-[#737373]">{post.sponsor?.name}</span>
                </span>
              ) : author ? (
                <Link href={`/author/${author.handle}`} className="flex items-center gap-1.5 hover:underline">
                  <Avatar src={author.avatar} name={author.name} alt={author.name} size={20} />
                  <span className="text-xs text-[#737373]">{author.name}</span>
                  <VerifiedBadge className="scale-75" />
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {!isDbAd && (
                <>
                  <button onClick={handleShare} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                    <Share2 className="w-4 h-4 text-[#737373]" />
                  </button>
                  <div onClick={(e) => e.stopPropagation()}>
                    <SaveBookmarkButton postId={post.id} onSaveChange={onSaveChange} initialSaved={initialSaved} savedPostIds={savedPostIds} />
                  </div>
                </>
              )}
              {isDbAd ? (
                <button onClick={(e) => { e.stopPropagation(); handleAdClick(); }} className="px-3 py-1 bg-[#F44444] text-white text-[11px] font-medium rounded-full hover:bg-[#d64d3c] transition-colors">
                  {post.ctaText || "Learn More"}
                </button>
              ) : (
                <ReadButton onRead={onReadArticle} postId={post.id} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleDetailView({ postId, posts, users, onBack, onSaveChange, savedPostIds, pathname }: { postId: number; posts: any[]; users: any[]; onBack: () => void; onSaveChange?: (postId: number, isSaved: boolean) => void; savedPostIds?: Set<number>; pathname?: string }) {
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, requireGuestAuth, currentUserId } = useContext(AuthContext);

  // Identify post type by looking up in each source — ID-range heuristics break for real DB articles
  const sponsoredArticle = sponsoredPosts.find(a => a.id === postId) ?? null;
  const newsArticle = newsArticles.find(a => a.id === postId) ?? null;
  const dbPost = posts.find((p: any) => p.id === postId) ?? null;
  const post = sponsoredArticle ?? newsArticle ?? dbPost;
  const isSponsoredArticle = sponsoredArticle !== null && post === sponsoredArticle;
  const isNewsArticle = newsArticle !== null && post === newsArticle;
  const author = isSponsoredArticle ? newsAuthors.find(a => a.id === sponsoredArticle!.authorId)
    : isNewsArticle ? newsAuthors.find(a => a.id === newsArticle!.authorId) : null;
  const postUser = (!isNewsArticle && !isSponsoredArticle && post)
    ? (post.user ?? users.find((u: any) => u.id === post.userId) ?? null)
    : null;

  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [shareCount, setShareCount] = useState(post?.stats?.shares || 0);
  // Record impression when article detail opens
  useEffect(() => {
    if (!isSignedIn || !currentUserId || isSponsoredArticle || isNewsArticle) return;
    api.recordImpression(postId, "view", currentUserId).catch(() => { });
  }, [postId]);

  if (!post) return null;

  const persistShare = () => {
    setShareCount((prev: number) => prev + 1);
    fetch(`/api/posts/${post.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentUserId }) }).catch(() => { });
  };

  const handleShare = async () => {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      const title = post.title || "Check out this article";
      const text = `${title} - ${url}`;

      if (isNative) {
        await CapacitorShare.share({ title, text, url });
        persistShare();
        return;
      } else if (navigator.share) {
        await navigator.share({ title, text, url });
        persistShare();
        return;
      }

      const shareOptions = [
        { name: "Twitter", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
        { name: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
        { name: "LinkedIn", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
        { name: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(text)}` },
        { name: "Copy Link", action: () => copyToClipboard(url).then(() => alert("Link copied to clipboard!")) },
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
        persistShare();
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
  const allArticles = [...posts.filter((p: any) => p.type === "article"), ...sponsoredPosts];
  const relatedArticles = allArticles
    .filter((p: any) => p.id !== postId && p.tags?.some((t: string) => post.tags?.includes(t)))
    .slice(0, 3);

  const handleInteraction = (action: () => void, context: InteractionContext = 'default') => {
    requireGuestAuth(context, action);
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
            <button onClick={() => handleInteraction(() => { setIsLiked(!isLiked); if (!isSponsoredArticle && !isNewsArticle) api.likePost(post.id, isLiked ? "unlike" : "like").catch(() => { }); }, "like")} className={`p-2 rounded-lg transition-colors ${isLiked ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
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
                <Avatar src={displayAvatar} name={displayName} alt={displayName} size={48} className="ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" />
              </Link>
            ) : (
              <Avatar src={displayAvatar} name={displayName} alt={displayName} size={48} className="ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" />
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
              onClick={() => handleInteraction(() => toggleFollow(postUser.id), "follow")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${isFollowing ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-[#737373] mb-6">
          <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /><span>{post.date}</span></div>
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
          <div className="relative rounded-2xl overflow-hidden mb-8 aspect-video">
            <Image src={post.image} alt={post.title || ""} fill sizes="(max-width: 768px) 100vw, 680px" className="object-cover" />
          </div>
        )}

        <div className="mb-10">
          {content.map((paragraph: string, i: number) =>
            paragraph.trim().startsWith("<") ? (
              <div key={i} className="ProseMirror text-[#262626] leading-relaxed text-base sm:text-lg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(paragraph) }} />
            ) : (
              <p key={i} className="text-[#262626] leading-relaxed mb-5 text-base sm:text-lg">{paragraph}</p>
            )
          )}
        </div>

        <div className="flex items-center justify-between py-4 border-t border-b border-[#e5e5e5] mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => handleInteraction(() => { setIsLiked(!isLiked); if (!isSponsoredArticle && !isNewsArticle) api.likePost(post.id, isLiked ? "unlike" : "like").catch(() => { }); }, "like")} className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${isLiked ? "bg-[#F44444]/10 text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#737373]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} /><span className="text-sm font-medium">{post.stats.likes}</span>
            </button>
            <button onClick={() => handleInteraction(() => {}, "comment")} className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors">
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
              <Avatar src={displayAvatar} name={displayName} alt={displayName} size={64} className="ring-2 ring-[#F44444] ring-offset-2 ring-offset-[#fafafa] flex-shrink-0" />
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
              <Avatar src={postUser.avatar} name={postUser.name} alt={postUser.name} size={64} className="ring-2 ring-[#F44444] ring-offset-2 ring-offset-[#fafafa] flex-shrink-0" />
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
                <button onClick={() => handleInteraction(() => toggleFollow(postUser.id), "follow")} className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${isFollowing ? "bg-white text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white hover:bg-[#d64d3c]"}`}>
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

function ProfileSetupCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 text-[#c5c5c5] hover:text-[#737373] transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <p className="text-sm text-[#0a0a0a] pr-6 leading-snug">
        Fill in your gender and birth year — it takes a second and helps Circle authors tailor content for people like you.
      </p>
      <div className="flex items-center gap-2 mt-3">
        <Link
          href="/settings?tab=0"
          onClick={onDismiss}
          className="px-3.5 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors"
        >
          Update profile
        </Link>
        <button
          onClick={onDismiss}
          className="px-3.5 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-[#fafafa] transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
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
  // X-algorithm feed — one bucket per tab mode so switching never shows stale data
  type XFeedMode = "for-you" | "local" | "trending" | "following" | "news" | "ai" | "technology";
  const TAB_MODE: Record<string, XFeedMode> = {
    "For You": "for-you", "Local": "local", "Trending": "trending", "Following": "following",
    "News": "news", "AI": "ai", "Technology": "technology",
  };
  const [xFeedPosts, setXFeedPosts] = useState<Record<XFeedMode, any[]>>({
    "for-you": [], "local": [], "trending": [], "following": [], "news": [], "ai": [], "technology": [],
  });
  const [xFeedLoading, setXFeedLoading] = useState(true);
  const [xFeedError, setXFeedError] = useState(false);
  const [xFeedCursor, setXFeedCursor] = useState<string | number>(0);
  const [xFeedHasMore, setXFeedHasMore] = useState(true);
  const [removedPostIds, setRemovedPostIds] = useState<Set<number>>(new Set());
  // Session-level author cap: track how many times each author appeared this session
  const sessionAuthorCounts = useRef<Map<number, number>>(new Map());
  const SESSION_AUTHOR_MAX = 3; // max posts per author per session
  const [topics, setTopics] = useState(defaultTopics);
  const selfInterestsUpdateRef = useRef(false);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<number>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  // Served ads (from the admin Ads system) interleaved into the feed
  const [feedAds, setFeedAds] = useState<any[]>([]);
  const [adFrequency, setAdFrequency] = useState(5);
  // Pending scroll-to-post from ?post= URL param — applied once feed loads
  const pendingScrollPostId = useRef<number | null>(null);

  const [customBannerAd, setCustomBannerAd] = useState<any>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !currentUserId) return;
    if (typeof window !== "undefined" && localStorage.getItem("profile-setup-dismissed")) return;
    fetch(`/api/settings?userId=${currentUserId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.demographics) return;
        const { gender, birthYear } = data.demographics;
        if (!gender && !birthYear) setShowProfileSetup(true);
      })
      .catch(() => { });
  }, [isSignedIn, currentUserId]);

  const handleDismissProfileSetup = () => {
    setShowProfileSetup(false);
    if (typeof window !== "undefined") localStorage.setItem("profile-setup-dismissed", "1");
  };

  // Load active Feed-placement and Custom-placement ads from the ad server
  useEffect(() => {
    fetch("/api/ads/serve?placement=Feed")
      .then(r => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        if (Array.isArray(d.ads)) setFeedAds(d.ads);
        if (d.frequency) setAdFrequency(Number(d.frequency) || 5);
      })
      .catch(() => { });
    fetch("/api/ads/serve?placement=Custom")
      .then(r => r.ok ? r.json() : null)
      .then((d) => { if (d?.ads?.[0]) setCustomBannerAd(d.ads[0]); })
      .catch(() => { });
  }, []);

  // Open article from ?article={id} (e.g. Explore → Trending Now click)
  useEffect(() => {
    const id = searchParams.get("article");
    if (id) setSelectedArticle(parseInt(id));
  }, [searchParams]);

  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(null);

  // Scroll to post from ?post={id} — stored until the feed loads
  useEffect(() => {
    const id = searchParams.get("post") || searchParams.get("article");
    if (id) {
      pendingScrollPostId.current = parseInt(id);
      if (searchParams.get("fromTrending") === "true") {
        setHighlightedPostId(parseInt(id));
      }
    }
  }, [searchParams]);

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


  const persistTopics = (updated: ContentTopic[]) => {
    if (!(isSignedIn && currentUserId && currentUserId > 0)) return;
    const selectedIds = updated.filter(t => t.selected).map(t => t.id);
    // Mark this write as self-initiated so our own "albiz-interests-updated"
    // listener doesn't re-fetch and clobber the optimistic update below with
    // a possibly out-of-order server response.
    selfInterestsUpdateRef.current = true;
    fetch("/api/interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, interests: selectedIds }),
    }).then(() => {
      window.dispatchEvent(new CustomEvent("albiz-interests-updated"));
    }).catch(() => { });
  };

  const toggleTopic = (id: string) => {
    setTopics(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t);
      persistTopics(updated);
      return updated;
    });
  };

  const setAllTopicsSelected = (selected: boolean) => {
    setTopics(prev => {
      const updated = prev.map(t => ({ ...t, selected }));
      persistTopics(updated);
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

  // Detect country on mount (runs once after sign-in) — fire-and-forget, non-blocking
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/geo/detect", { method: "POST" }).catch(() => { });
  }, [isSignedIn]);

  // Current tab's X-feed mode — ALL tabs now use the X-algorithm
  const xFeedMode: XFeedMode = TAB_MODE[filterTabs[activeTab]] ?? "for-you";

  // Ref guard: prevents React StrictMode double-invoke from firing two API calls
  const xFeedInFlight = useRef<string | null>(null);
  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadXFeed = useCallback((cursor: string | number = 0, mode: XFeedMode = "for-you") => {
    const key = `${mode}:${cursor}`;
    if (xFeedInFlight.current === key) return;
    xFeedInFlight.current = key;

    const isFirstPage = !cursor || cursor === 0 || cursor === "0";
    const offsetNum = typeof cursor === "number" ? cursor : 0;

    setXFeedLoading(true);
    setXFeedError(false);
    api.getFeed(mode as any, cursor, 20)
      .then(data => {
        const raw = data.posts ?? [];
        // Session author cap: skip posts from authors already seen SESSION_AUTHOR_MAX times
        const capFiltered = raw.filter((p: any) => {
          const count = sessionAuthorCounts.current.get(p.userId) ?? 0;
          return count < SESSION_AUTHOR_MAX;
        });
        // Update session counts
        capFiltered.forEach((p: any) => {
          sessionAuthorCounts.current.set(p.userId, (sessionAuthorCounts.current.get(p.userId) ?? 0) + 1);
        });
        // Tag each post with its feed position for impression tracking
        const withPositions = capFiltered.map((p: any, i: number) => ({ ...p, position: offsetNum + i + 1 }));

        if (isFirstPage) {
          setXFeedPosts(prev => ({ ...prev, [mode]: withPositions }));
        } else {
          setXFeedPosts(prev => {
            const existingIds = new Set(prev[mode].map((p: any) => p.id));
            const fresh = withPositions.filter((p: any) => !existingIds.has(p.id));
            return { ...prev, [mode]: [...prev[mode], ...fresh] };
          });
        }
        setXFeedCursor(data.nextCursor ?? (Number(cursor) || 0) + 20);
        setXFeedHasMore(data.hasMore ?? false);
      })
      .catch(() => { setXFeedError(true); })
      .finally(() => {
        setXFeedLoading(false);
        xFeedInFlight.current = null;
        // Fire pending post scroll once feed is in the DOM
        if (pendingScrollPostId.current) {
          const id = pendingScrollPostId.current;
          pendingScrollPostId.current = null;
          setTimeout(() => {
            const el = document.getElementById(`post-${id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 300);
        }
      });
  }, []);

  const reloadFeed = useCallback(() => {
    const mode = TAB_MODE[filterTabs[activeTab]] ?? "for-you";
    sessionAuthorCounts.current = new Map();
    setXFeedPosts(prev => ({ ...prev, [mode]: [] }));
    setXFeedCursor(0);
    setXFeedHasMore(true);
    loadXFeed(0, mode);
  }, [activeTab, loadXFeed]);

  // Reload X-feed on every tab change — clear stale posts + session counts
  useEffect(() => {
    const mode = TAB_MODE[filterTabs[activeTab]] ?? "for-you";
    sessionAuthorCounts.current = new Map(); // reset session cap for new tab
    setXFeedPosts(prev => ({ ...prev, [mode]: [] }));
    setXFeedCursor(0);
    setXFeedHasMore(true);
    loadXFeed(0, mode);
  }, [activeTab]);

  // Infinite scroll: load next page when sentinel enters viewport
  useEffect(() => {
    if (!sentinelRef.current || !xFeedHasMore || xFeedLoading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadXFeed(xFeedCursor, xFeedMode);
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [xFeedCursor, xFeedHasMore, xFeedLoading, xFeedMode]);

  const handleRemovePost = useCallback((postId: number) => {
    setRemovedPostIds(prev => new Set([...prev, postId]));
  }, []);

  // Separate useEffect for user data that depends on currentUserId
  useEffect(() => {
    // Load user's liked and saved posts when currentUserId is available
    if (isSignedIn && currentUserId && currentUserId > 0) {
      api.getLikedPosts(currentUserId).then(ids => setLikedPostIds(new Set(ids))).catch(() => { });
      api.getSaved().then(data => {
        if (!data || data.success === false) return;
        const uniquePosts = data.posts.filter((post: any, index: number, self: any[]) =>
          index === self.findIndex((p: any) => p.postId === post.postId)
        );
        const ids = uniquePosts.map((p: any) => p.postId);
        setSavedPostIds(new Set(ids));
      }).catch(() => { });
      api.getBlockedUsers(currentUserId).then(list => {
        setBlockedUserIds(new Set(list.map((b: any) => b.blockedId)));
      }).catch(() => { });

      // Load user interests and update topics
      fetch(`/api/interests?userId=${currentUserId}`)
        .then(res => res.json())
        .then(data => {
          setTopics(matchInterestsToTopics(data, true));
        })
        .catch(() => { });
    } else {
      // For anonymous users, keep all selected by default
      setTopics(prev => prev.map(t => ({ ...t, selected: true })));
    }
  }, [currentUserId]);


  // Event listeners setup
  useEffect(() => {
    const onPostCreated = () => reloadFeed();
    const onPostSaved = () => {
      // Skip automatic refresh since handleSaveChange already updates local state
      // This prevents conflicts between immediate local updates and API refresh
    };

    const onInterestsUpdated = () => {
      if (selfInterestsUpdateRef.current) {
        // This write originated from this component's own toggle handler,
        // which already applied the correct local state optimistically —
        // re-fetching here would race with in-flight writes and can revert
        // a just-applied selection.
        selfInterestsUpdateRef.current = false;
        return;
      }
      if (currentUserId && currentUserId > 0) {
        fetch(`/api/interests?userId=${currentUserId}`)
          .then(res => res.json())
          .then(data => {
            setTopics(matchInterestsToTopics(data, false));
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
  }, [reloadFeed, currentUserId]);

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

  const allContent = [...deduplicatedPosts];

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
    const mode: XFeedMode = TAB_MODE[tabName] ?? "for-you";
    const serverPosts = xFeedPosts[mode];

    // Server feed available — always use it
    if (serverPosts.length > 0) {
      return serverPosts.filter((p: any) => !removedPostIds.has(p.id));
    }

    // Still loading first page — return empty so skeleton shows, never fallback data
    if (xFeedLoading) return [];

    // Server returned nothing (empty result, not loading) — show empty state
    return [];
  };

  const filtered = getFilteredPosts();

  // Apply content preference topic filters
  const prefFiltered = applyPreferences(filtered);

  // Filter posts by search query
  const searchFiltered = searchQuery.trim()
    ? prefFiltered.filter(post => {
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
        // X-feed posts have user embedded; legacy posts look up in users array
        const user = post.user ?? users.find((u: any) => u.id === post.userId);
        userName = user ? user.name.toLowerCase() : "";
        userHandle = user ? (user.handle ?? "").toLowerCase() : "";
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
    : prefFiltered;

  // Interleave sponsored posts into the feed at positions: 1st slot, then every 5th
  // Don't show sponsored posts when searching
  const feedWithAds = (() => {
    if (searchFiltered.length === 0) return [];
    const items: { type: "content" | "sponsored"; data: any }[] = [];
    let adIndex = 0;
    const ads = feedAds; // only real, admin-served ads — no demo fallback
    const adInterval = adFrequency > 0 ? adFrequency : 5; // place an ad every Nth posts

    // Don't show sponsored posts when searching
    if (searchQuery.trim()) {
      return searchFiltered.map(post => ({ type: "content" as const, data: post }));
    }

    // Place first ad at position 0 (top of feed)
    if (ads.length > 0) {
      items.push({ type: "sponsored", data: ads[adIndex % ads.length] });
      adIndex++;
    }

    for (let i = 0; i < searchFiltered.length; i++) {
      items.push({ type: "content", data: searchFiltered[i] });
      // Insert ad after every Nth content post
      if ((i + 1) % adInterval === 0 && adIndex < ads.length) {
        items.push({ type: "sponsored", data: ads[adIndex % ads.length] });
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
    // Merge xFeed posts (fresher, with embedded user) over static fallback posts
    const allFeedPosts = Object.values(xFeedPosts).flat() as any[];
    const postsMap = new Map<number, any>();
    posts.forEach((p: any) => postsMap.set(p.id, p));
    allFeedPosts.forEach((p: any) => postsMap.set(p.id, p));
    const mergedPosts = Array.from(postsMap.values());
    return (
      <>
        <ArticleDetailView postId={selectedArticle} posts={mergedPosts} users={users} onBack={() => setSelectedArticle(null)} onSaveChange={handleSaveChange} savedPostIds={savedPostIds} pathname={pathname} />
        <RightSidebar />
      </>
    );
  }

  return (
    <>
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto overflow-x-hidden">
        <FeedHeader activeTab={activeTab} setActiveTab={setActiveTab} topics={topics} onToggleTopic={toggleTopic} onSetAllTopics={setAllTopicsSelected} onSearchQuery={setSearchQuery} isSignedIn={isSignedIn} />
        {/* Stories row — visible on mobile/tablet, hidden on lg+ where RightSidebar shows them */}
        <div className="lg:hidden pt-4">
          <RecentStories />
        </div>
        {/* Custom placement — top banner ad */}
        {customBannerAd && (
          <CustomBannerAd ad={customBannerAd} currentUserId={currentUserId} />
        )}
        <div className="space-y-3 md:space-y-4 pt-4 pb-6">
          {feedWithAds.length === 0 && xFeedLoading ? (
            <FeedSkeleton />
          ) : feedWithAds.length === 0 && xFeedError ? (
            <div className="text-center py-12">
              <p className="text-[#737373] text-sm mb-3">Failed to load posts.</p>
              <button onClick={reloadFeed} className="text-sm text-[#0a0a0a] underline underline-offset-2">Try again</button>
            </div>
          ) : feedWithAds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#737373] text-sm">
                {searchQuery.trim() ? "No posts match your search." : "No posts to show."}
              </p>
            </div>
          ) : (
            feedWithAds.map((item, idx) => (
              <React.Fragment key={item.type === "sponsored" ? `sponsored-${item.data.id}-${idx}` : `${item.data.type === "article" ? "article" : "post"}-${item.data.id}-${idx}`}>
                {idx === 0 && showProfileSetup && (
                  <ProfileSetupCard onDismiss={handleDismissProfileSetup} />
                )}
                {item.type === "sponsored" ? (
                  <SponsoredArticleCard post={item.data} onReadArticle={setSelectedArticle} onSaveChange={handleSaveChange} initialSaved={savedPostIds.has(item.data.id)} savedPostIds={savedPostIds} />
                ) : item.data.type === "article" ? (
                  <ArticleCard post={item.data} users={users} onReadArticle={setSelectedArticle} onSaveChange={handleSaveChange} initialSaved={savedPostIds.has(item.data.id)} savedPostIds={savedPostIds} onRemove={handleRemovePost} highlighted={highlightedPostId === item.data.id} />
                ) : (
                  <PostCard post={item.data} users={users} initialLiked={likedPostIds.has(item.data.id)} initialSaved={savedPostIds.has(item.data.id)} onSaveChange={handleSaveChange} savedPostIds={savedPostIds} pathname={pathname} onRemove={handleRemovePost} highlighted={highlightedPostId === item.data.id} />
                )}
              </React.Fragment>
            ))
          )}
          {/* Infinite scroll sentinel */}
          {xFeedHasMore && <div ref={sentinelRef} className="h-4" />}
          {xFeedLoading && feedWithAds.length > 0 && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" />
            </div>
          )}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
