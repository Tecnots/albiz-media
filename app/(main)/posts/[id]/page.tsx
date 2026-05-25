"use client";

import { useParams, useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Heart, MessageCircle, Share2, Eye, MapPin, User, MoreVertical, X, ArrowUp, Loader2, Bookmark, Clock } from "lucide-react";
import { AuthContext, FollowingContext } from "@/app/lib/contexts";
import { api } from "@/app/lib/api";
import { users as fallbackUsers, posts as fallbackPosts } from "@/app/lib/data";
import { VerifiedBadge, SaveBookmarkButton } from "@/app/lib/shared-components";
import { isNative } from "@/app/lib/capacitor";
import { Share as CapacitorShare } from '@capacitor/share';
import { Toast } from "@capacitor/toast";

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = Number(params.id);
  const { currentUserId, isSignedIn, openAuthModal } = useContext(AuthContext);
  const { following, toggleFollow } = useContext(FollowingContext);

  const [post, setPost] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState("0");
  const [commentCount, setCommentCount] = useState("0");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Find post in fallback data or API
    const foundPost = fallbackPosts.find(p => p.id === postId);
    if (foundPost) {
      setPost(foundPost);
      const foundUser = fallbackUsers.find(u => u.id === foundPost.userId);
      setUser(foundUser);
      setLikeCount(foundPost.stats.likes);
      setCommentCount(foundPost.stats.comments);
      setLoading(false);
    } else {
      api.getPosts().then(allPosts => {
        const p = allPosts.find((x: any) => x.id === postId);
        if (p) {
          setPost(p);
          setLikeCount(p.stats?.likes || "0");
          setCommentCount(p.stats?.comments || "0");
          api.getUserProfile(p.userId).then(setUser).catch(() => {});
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }

    if (currentUserId) {
      api.getLikedPosts(currentUserId).then(ids => {
        if (ids.includes(postId)) setLiked(true);
      }).catch(() => {});
    }
  }, [postId, currentUserId]);

  const handleLike = () => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    api.likePost(postId, newLiked ? "like" : "unlike", currentUserId)
      .then(res => { if (res.likes) setLikeCount(res.likes); })
      .catch(() => {});
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = post?.title || "Check out this post on Albiz";
    const text = post?.content?.replace(/<[^>]*>/g, '').slice(0, 100) || "Read this interesting post on Albiz Media";

    if (isNative) {
      try {
        await CapacitorShare.share({ title, text, url, dialogTitle: 'Share Post' });
      } catch (err) { console.error("Share failed:", err); }
    } else if (navigator.share) {
      try { await navigator.share({ title, text, url }); } catch (err) { console.error("Share failed:", err); }
    } else {
      navigator.clipboard.writeText(url);
      if (isNative) Toast.show({ text: "Link copied to clipboard" });
      else alert("Link copied to clipboard");
    }
  };

  const toggleComments = () => {
    const opening = !showComments;
    setShowComments(opening);
    if (opening && comments.length === 0) {
      api.getComments(postId).then(setComments).catch(() => {});
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const c = await api.addComment(postId, currentUserId, commentText.trim());
      if (c.id) {
        setComments(prev => [c, ...prev]);
        setCommentCount(String((parseInt(commentCount) || 0) + 1));
      }
      setCommentText("");
    } catch {}
    setPostingComment(false);
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-[#F44444]" />
      </main>
    );
  }

  if (!post || !user) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-white p-6 text-center">
        <p className="text-[#737373] mb-4">Post not found</p>
        <button onClick={() => router.back()} className="text-[#F44444] font-medium">Go back</button>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-white overflow-y-auto">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#f0f0f0] px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]">
            <Share2 className="w-5 h-5" />
          </button>
          <SaveBookmarkButton postId={postId} />
        </div>
      </header>

      <article className="px-4 py-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-[#f0f0f0]">
          <Link href={`/${user.handle}`} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              {user.avatar ? (
                <Image src={user.avatar} alt={user.name} width={48} height={48} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center"><User className="w-6 h-6 text-[#a3a3a3]" /></div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0a0a0a]">{user.name}</span>
                {user.verified && <VerifiedBadge />}
              </div>
              <p className="text-xs text-[#737373]">{user.title}</p>
            </div>
          </Link>
          {user.id !== currentUserId && (
            <button
              onClick={() => toggleFollow(user.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${following.has(user.id) ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]" : "bg-[#F44444] text-white"}`}
            >
              {following.has(user.id) ? "Following" : "Follow"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-[#a3a3a3] mb-4">
          <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.date}</div>
          <div className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.stats?.views || "0"} views</div>
          {post.description && <div className="flex items-center gap-1 text-[#F44444]"><MapPin className="w-3.5 h-3.5" />{post.description}</div>}
        </div>

        {post.title && <h1 className="text-2xl font-bold text-[#0a0a0a] mb-4">{post.title}</h1>}
        
        <div 
          className="text-[#262626] leading-relaxed mb-6 text-base [&_b]:font-bold [&_i]:italic [&_a]:text-[#F44444] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" 
          dangerouslySetInnerHTML={{ __html: post.content }} 
        />

        {post.image && (
          <div className="rounded-2xl overflow-hidden mb-8 shadow-sm">
            <Image src={post.image} alt="" width={800} height={500} className="object-cover w-full" unoptimized />
          </div>
        )}

        <div className="flex items-center justify-between py-4 border-t border-b border-[#f0f0f0] mb-8">
          <div className="flex items-center gap-6">
            <button onClick={handleLike} className={`flex items-center gap-2 transition-colors ${liked ? "text-[#F44444]" : "text-[#737373]"}`}>
              <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
              <span className="text-sm font-medium">{likeCount}</span>
            </button>
            <button onClick={toggleComments} className={`flex items-center gap-2 transition-colors ${showComments ? "text-[#F44444]" : "text-[#737373]"}`}>
              <MessageCircle className={`w-5 h-5 ${showComments ? "fill-current" : ""}`} />
              <span className="text-sm font-medium">{commentCount}</span>
            </button>
          </div>
          <SaveBookmarkButton postId={postId} />
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-[#f5f5f5] rounded-full px-4 py-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") submitComment(); }}
                  placeholder="Add a comment..."
                  className="flex-1 bg-transparent text-sm outline-none text-[#262626]"
                />
                <button onClick={submitComment} disabled={!commentText.trim() || postingComment} className="text-[#F44444] disabled:opacity-30">
                  {postingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {comments.length > 0 ? (
                comments.map(c => (
                  <div key={c.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#f5f5f5]">
                      {c.avatar ? <Image src={c.avatar} alt="" width={32} height={32} /> : <User className="w-4 h-4 m-2 text-[#a3a3a3]" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-[#0a0a0a]">{c.name}</span>
                        <span className="text-[10px] text-[#a3a3a3]">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-[#262626] leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#737373] text-center py-4">No comments yet</p>
              )}
            </div>
          </div>
        )}
      </article>
    </main>
  );
}
