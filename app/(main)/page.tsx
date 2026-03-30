"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useContext, useEffect, useRef } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, MoreVertical, Search, SlidersHorizontal, Circle, Check, Heart, Bookmark, X, ArrowLeft, Clock, MapPin, ArrowUp, Loader2, Trash2 } from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, filterTabs, generateArticleContent, newsAuthors, newsArticles, generateNewsArticleContent, sponsoredPosts, generateSponsoredArticleContent } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { VerifiedBadge, RightSidebar, SaveBookmarkButton, RecentStories } from "@/app/lib/shared-components";
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
            <h1 className="text-lg md:text-xl font-semibold text-[#0a0a0a]">Activities</h1>
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
      <div className="flex gap-1 md:gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
        {filterTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
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

function PostCard({ post, users, initialLiked = false, initialSaved = false }: { post: any; users: any[]; initialLiked?: boolean; initialSaved?: boolean }) {
  const postUser = users.find((u: any) => u.id === post.userId);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { userRole, isSignedIn, openAuthModal, currentUserId } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [commentCount, setCommentCount] = useState(post.stats.comments);
  // Sync when initial values load asynchronously
  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

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
    if (!isSignedIn) { openAuthModal("signin"); return; }
    action();
  };

  const handleDeletePost = () => {
    setMenuOpen(false);
    api.deletePost(post.id).catch(() => {});
    setDeleted(true);
    window.dispatchEvent(new Event("albiz-post-created"));
  };

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    api.likePost(post.id, newLiked ? "like" : "unlike", currentUserId)
      .then(res => { if (res.likes) setLikeCount(res.likes); })
      .catch(() => {});
  };

  const toggleComments = () => {
    const opening = !showComments;
    setShowComments(opening);
    // Load comments in background — show input immediately
    if (opening && comments.length === 0) {
      setLoadingComments(true);
      api.getComments(post.id).then(setComments).catch(() => {}).finally(() => setLoadingComments(false));
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
    } catch {}
    setPosting(false);
  };

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-3 md:p-4 bg-white hover:border-[#d5d5d5] transition-colors animate-fade-in">
      <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
        <Link href={`/${postUser.handle}`} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
            <Image src={postUser.avatar} alt={postUser.name} width={32} height={32} className="object-cover w-full h-full" />
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
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                isFollowing
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
          <button onClick={() => handleInteraction(toggleComments)} className={`flex items-center gap-1 text-xs transition-colors ${showComments ? "text-[#F44444]" : "hover:text-[#525252]"}`}>
            <MessageCircle className={`w-3.5 h-3.5 ${showComments ? "fill-[#F44444]/10" : ""}`} />
            {commentCount}
          </button>
          <span className="flex items-center gap-1 text-xs">
            <Share2 className="w-3.5 h-3.5" />
            {post.stats.shares}
          </span>
        </div>
        <SaveBookmarkButton postId={post.id} userId={currentUserId} initialSaved={initialSaved} />
      </div>
      {/* Comments Section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
          {/* Comment Input */}
          <div className="flex items-center gap-2 mb-3">
            {currentUserData && (
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                <Image src={currentUserData.avatar} alt="" width={28} height={28} className="object-cover w-full h-full" />
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
                    <Image src={c.avatar} alt={c.name} width={24} height={24} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#0a0a0a]">{c.name}</span>
                      {c.verified && <VerifiedBadge className="scale-75" />}
                      <span className="text-[10px] text-[#a3a3a3]">{new Date(c.createdAt).toLocaleDateString()}</span>
                      {c.userId === currentUserId && (
                        <button
                          onClick={() => { api.deleteComment(post.id, c.id).catch(() => {}); setComments(prev => prev.filter(x => x.id !== c.id)); const n = parseInt(commentCount) || 0; setCommentCount(String(Math.max(0, n - 1))); }}
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
    </div>
  );
}

function ArticleCard({ post, users, onReadArticle }: { post: any; users: any[]; onReadArticle: (id: number) => void }) {
  const { currentUserId } = useContext(AuthContext);
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
              <div onClick={(e) => e.stopPropagation()}>
                <SaveBookmarkButton postId={post.id} userId={currentUserId} />
              </div>
              <span className="px-3 py-1 bg-[#F44444] text-white text-xs font-medium rounded-full">Read</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsoredArticleCard({ post, onReadArticle }: { post: any; onReadArticle: (id: number) => void }) {
  const { currentUserId } = useContext(AuthContext);
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
              <div onClick={(e) => e.stopPropagation()}>
                <SaveBookmarkButton postId={post.id} userId={currentUserId} />
              </div>
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
            <button onClick={() => handleInteraction(() => { setIsLiked(!isLiked); if (!isSponsoredArticle && !isNewsArticle) api.likePost(post.id, isLiked ? "unlike" : "like").catch(() => {}); })} className={`p-2 rounded-lg transition-colors ${isLiked ? "text-[#F44444]" : "text-[#737373] hover:bg-[#f5f5f5]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
            </button>
            <SaveBookmarkButton postId={post.id} userId={currentUserId} />
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
            <button onClick={() => handleInteraction(() => { setIsLiked(!isLiked); if (!isSponsoredArticle && !isNewsArticle) api.likePost(post.id, isLiked ? "unlike" : "like").catch(() => {}); })} className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${isLiked ? "bg-[#F44444]/10 text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#737373]"}`}>
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} /><span className="text-sm font-medium">{post.stats.likes}</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors">
              <MessageCircle className="w-5 h-5" /><span className="text-sm font-medium">{post.stats.comments}</span>
            </button>
          </div>
          <SaveBookmarkButton postId={post.id} userId={currentUserId} />
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
            <Link href={`/${postUser.handle}`} className="flex items-start gap-4 group">
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
                <Link href={`/${postUser.handle}`} className="px-4 py-2 text-sm font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">
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
  const [activeTab, setActiveTab] = useState(0);
  const { following } = useContext(FollowingContext);
  const { currentUserId } = useContext(AuthContext);
  const [users, setUsers] = useState(fallbackUsers);
  const [posts, setPosts] = useState(fallbackPosts);
  const [topics, setTopics] = useState(defaultTopics);
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<number>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<number>>(new Set());

  const toggleTopic = (id: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  // Fetch from Supabase API (falls back to hardcoded on error)
  const fetchData = () => {
    Promise.all([api.getUsers(), api.getPosts()])
      .then(([u, p]) => { setUsers(u); setPosts(p); })
      .catch(() => {});
  };
  useEffect(() => {
    fetchData();
    // Load user's liked and saved posts
    if (currentUserId) {
      api.getLikedPosts(currentUserId).then(ids => setLikedPostIds(new Set(ids))).catch(() => {});
      api.getSaved(currentUserId).then(data => {
        const ids = data.posts.map((p: any) => typeof p === "number" ? p : p.postId);
        setSavedPostIds(new Set(ids));
      }).catch(() => {});
      api.getBlockedUsers(currentUserId).then(list => {
        setBlockedUserIds(new Set(list.map((b: any) => b.blockedId)));
      }).catch(() => {});
    }
    const onPostCreated = () => fetchData();
    window.addEventListener("albiz-post-created", onPostCreated);
    return () => window.removeEventListener("albiz-post-created", onPostCreated);
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

  // Merge regular posts with news articles for the feed — exclude own posts and blocked users
  const othersPosts = posts.filter(p => p.userId !== currentUserId && !blockedUserIds.has(p.userId));
  const allContent = [...othersPosts, ...newsArticles];

  const getFilteredPosts = () => {
    const tabName = filterTabs[activeTab];
    switch (tabName) {
      case "Following": return applyPreferences(othersPosts.filter(post => following.has(post.userId)));
      case "News": {
        const regularNews = othersPosts.filter(post => post.tags?.includes("News"));
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
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto">
        <FeedHeader activeTab={activeTab} setActiveTab={setActiveTab} topics={topics} onToggleTopic={toggleTopic} />
        {/* Stories row — visible on mobile/tablet, hidden on lg+ where RightSidebar shows them */}
        <div className="lg:hidden pt-4">
          <RecentStories />
        </div>
        <div className="space-y-3 md:space-y-4 pt-4 pb-6">
          {feedWithAds.length === 0 ? (
            <div className="text-center py-12"><p className="text-[#737373] text-sm">No posts to show.</p></div>
          ) : (
            feedWithAds.map((item, idx) =>
              item.type === "sponsored" ? (
                <SponsoredArticleCard key={`ad-${item.data.id}`} post={item.data} onReadArticle={setSelectedArticle} />
              ) : item.data.type === "article" ? (
                <ArticleCard key={item.data.id} post={item.data} users={users} onReadArticle={setSelectedArticle} />
              ) : (
                <PostCard key={item.data.id} post={item.data} users={users} initialLiked={likedPostIds.has(item.data.id)} initialSaved={savedPostIds.has(item.data.id)} />
              )
            )
          )}
        </div>
      </main>
      <RightSidebar />
    </>
  );
}
