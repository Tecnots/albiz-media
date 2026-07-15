"use client";

import Image from "next/image";
import { useState, useRef, useContext, useEffect } from "react";
import { X, Play, Heart, MessageCircle, Share2, Bookmark, Eye, ChevronLeft, ChevronRight, Volume2, VolumeX, ArrowUp, Loader2 } from "lucide-react";
import { AuthContext, type InteractionContext } from "@/app/lib/contexts";
import { VerifiedBadge, CommentThread } from "@/app/lib/shared-components";
import { useComments, type CommentsAdapter } from "@/app/lib/useComments";
import { api } from "@/app/lib/api";
import { isNative, copyToClipboard } from "@/app/lib/capacitor";
import { Toast } from "@capacitor/toast";
import { Share as CapacitorShare } from "@capacitor/share";
import { getUserTimezone } from "@/app/lib/format-date";

// Shared between the Shorts feed page and the Saved page's Shorts tab —
// kept out of app/(main)/shorts/page.tsx because Next.js only allows a
// page.tsx module to export the reserved route exports (default, metadata, …).

// ─── Helpers ───
export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function formatTimeAgo(date: string | null): string {
  if (!date) return "recently";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function mapShort(s: any) {
  return {
    id: s.id,
    title: s.title,
    thumbnail: s.thumbnailUrl || "",
    videoUrl: s.videoUrl || "",
    duration: null as string | null,
    views: Number(s.views ?? 0),
    likes: Number(s.likes ?? 0),
    comments: Number(s.comments ?? 0),
    liked: Boolean(s.liked),
    saved: Boolean(s.saved),
    timeAgo: formatTimeAgo(s.publishedAt ?? null),
    category: null as string | null,
    country: (s.user?.country ?? "").toLowerCase(),
    creator: {
      name: s.user?.name ?? "Unknown",
      avatar: s.user?.avatar ?? "",
      verified: s.user?.verified ?? false,
    },
  };
}

// ─── Short Video Card ───
export function ShortCard({ short, onClick }: { short: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-xl overflow-hidden cursor-pointer group aspect-[9/16] bg-[#1a1a1a]"
    >
      {short.thumbnail ? (
        <Image
          src={short.thumbnail}
          alt={short.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="absolute inset-0 bg-[#262626]" />
      )}

      {/* Play overlay */}
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
        </div>
      </div>

      {/* Duration badge */}
      {short.duration && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
          {short.duration}
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <p className="text-white text-xs font-medium line-clamp-2 mb-2 leading-snug">{short.title}</p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-white/30 flex-shrink-0">
            {short.creator.avatar ? (
              <Image src={short.creator.avatar} alt={short.creator.name} width={20} height={20} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full bg-[#404040] flex items-center justify-center">
                <span className="text-white text-[8px] font-medium">{short.creator.name.charAt(0)}</span>
              </div>
            )}
          </div>
          <span className="text-white/80 text-[10px] truncate">{short.creator.name}</span>
          {short.creator.verified && <VerifiedBadge className="scale-[0.6]" />}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-white/60 text-[10px]">
          <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {formatCount(short.views)}</span>
          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {formatCount(short.likes)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Full Screen Short Viewer ───
export function ShortViewer({
  short, shorts: allShorts, onClose, onNavigate, onLikeChange, onSaveChange, onViewed, onCommentCountChange,
}: {
  short: any; shorts: any[]; onClose: () => void; onNavigate: (id: number) => void;
  onLikeChange?: (id: number, liked: boolean) => void;
  onSaveChange?: (id: number, saved: boolean) => void;
  onViewed?: (id: number) => void;
  onCommentCountChange?: (id: number, count: number) => void;
}) {
  const { requireGuestAuth, currentUserId } = useContext(AuthContext);
  const [liked, setLiked] = useState(!!short.liked);
  const [saved, setSaved] = useState(!!short.saved);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(short.comments);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Guards against firing a duplicate "view" request for the same short —
  // React (Strict Mode, in dev) can invoke this effect twice per mount, and
  // without this guard that meant two view-count increments per open.
  const viewRecordedForRef = useRef<number | null>(null);

  const commentsAdapter: CommentsAdapter = {
    list: (cursor, limit) => api.getShortComments(short.id, cursor, limit),
    listReplies: (parentId, cursor, limit) => api.getShortCommentReplies(short.id, parentId, cursor, limit),
    add: (text, parentId) => api.addShortComment(short.id, text, parentId),
    remove: (commentId) => api.deleteShortComment(short.id, commentId),
  };
  const commentsThread = useComments(commentsAdapter);

  const currentIndex = allShorts.findIndex((s: any) => s.id === short.id);

  // Reset per-short state when navigating between shorts
  useEffect(() => {
    setProgress(0);
    setPaused(false);
    setLiked(!!short.liked);
    setSaved(!!short.saved);
    setCommentCount(short.comments);
    commentsThread.reset();

    if (viewRecordedForRef.current !== short.id) {
      viewRecordedForRef.current = short.id;
      api.recordShortEvent(short.id, { action: "view" })
        .then((res) => { if (res?.counted) onViewed?.(short.id); })
        .catch(() => {});
    }
  }, [short.id]);

  // Keep the <video> element in sync with play/pause state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, short.id]);

  // Keeps the actual <video> element's muted property in sync with our
  // `muted` state — needed on top of the toggle's own imperative set below
  // because a fresh <video> element is mounted whenever short.id changes
  // (see the `key={short.id}` below), and it must pick up the carried-over
  // mute preference for that new element too.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, short.id]);

  const toggleMuted = () => {
    setMuted(m => {
      const next = !m;
      // Set the DOM property synchronously — the `muted` JSX attribute alone
      // is only applied by React when the <video> element is first created,
      // not on every re-render, so relying on it (or a delayed effect) can
      // leave the icon and the actual audio momentarily out of sync.
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  };

  const handleInteraction = (action: () => void, context: InteractionContext = "default") => {
    requireGuestAuth(context, action);
  };

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    onLikeChange?.(short.id, next);
    api.likeShort(short.id, next ? "like" : "unlike").catch(() => {
      setLiked(!next);
      onLikeChange?.(short.id, !next);
    });
  };

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    onSaveChange?.(short.id, next);
    const call = next ? api.saveShort(short.id) : api.unsaveShort(short.id);
    call.then(() => {
      window.dispatchEvent(new Event("albiz-post-saved"));
      if (isNative) Toast.show({ text: next ? "Short saved" : "Short removed from saved" });
    }).catch(() => {
      setSaved(!next);
      onSaveChange?.(short.id, !next);
    });
  };

  const bumpCommentCount = (next: number) => {
    setCommentCount(next);
    onCommentCountChange?.(short.id, next);
  };

  const submitComment = async () => {
    if (!commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const created = await commentsThread.addComment(commentText.trim());
      if (created?.id) bumpCommentCount((commentCount ?? 0) + 1);
      setCommentText("");
    } catch { }
    setPostingComment(false);
  };

  const submitReply = async (parentId: number, text: string) => {
    const created = await commentsThread.addReply(parentId, text);
    if (created?.id) bumpCommentCount((commentCount ?? 0) + 1);
    return created;
  };

  const handleDeleteComment = (commentId: number, parentId?: number) => {
    commentsThread.deleteComment(commentId, parentId).then((res) => {
      if (typeof res?.totalComments === "number") {
        bumpCommentCount(res.totalComments);
      } else {
        const removed = typeof res?.removedCount === "number" ? res.removedCount : 1;
        bumpCommentCount(Math.max(0, (commentCount ?? 0) - removed));
      }
    });
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/shorts?short=${short.id}` : "";
    const title = short.title || "Check out this Short";
    const text = `${title} - ${url}`;
    api.recordShortEvent(short.id, { action: "share" }).catch(() => {});

    if (isNative) {
      try {
        await CapacitorShare.share({ title, text, url });
        Toast.show({ text: "Short shared" });
      } catch (err) {
        console.error("Share failed:", err);
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        console.error("Share failed:", err);
      }
    }
    await copyToClipboard(url);
  };

  const goNext = () => {
    if (currentIndex < allShorts.length - 1) onNavigate(allShorts[currentIndex + 1].id);
  };

  const goPrev = () => {
    if (currentIndex > 0) onNavigate(allShorts[currentIndex - 1].id);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
      if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center">
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 hover:bg-white/10 rounded-full transition-colors">
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Navigation buttons */}
      <button
        onClick={goPrev}
        disabled={currentIndex === 0}
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          currentIndex === 0 ? "opacity-0 pointer-events-none" : "bg-white/15 hover:bg-white/25 backdrop-blur-sm"
        }`}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={goNext}
        disabled={currentIndex === allShorts.length - 1}
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          currentIndex === allShorts.length - 1 ? "opacity-0 pointer-events-none" : "bg-white/15 hover:bg-white/25 backdrop-blur-sm"
        }`}
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Video container */}
      <div className="relative w-full max-w-sm aspect-[9/16] rounded-xl overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-white/20">
          <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        {/* Video */}
        {short.videoUrl ? (
          <video
            key={short.id}
            ref={videoRef}
            src={short.videoUrl}
            poster={short.thumbnail || undefined}
            muted={muted}
            autoPlay
            playsInline
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress((v.currentTime / v.duration) * 100);
            }}
            onEnded={goNext}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : short.thumbnail ? (
          <Image src={short.thumbnail} alt={short.title} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}

        {/* Tap to pause/play */}
        <button
          onClick={() => setPaused(p => !p)}
          className="absolute inset-0 z-10"
        >
          {paused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-7 h-7 text-white ml-1" fill="white" />
              </div>
            </div>
          )}
        </button>

        {/* Top controls */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/50">
              {short.creator.avatar ? (
                <Image src={short.creator.avatar} alt={short.creator.name} width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-[#404040] flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{short.creator.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-white text-sm font-semibold">{short.creator.name}</span>
                {short.creator.verified && <VerifiedBadge className="scale-75" />}
              </div>
              <span className="text-white/50 text-[10px]">{short.timeAgo}</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleMuted(); }}
            className="p-2 hover:bg-white/10 rounded-full transition-colors z-20"
          >
            {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
        </div>

        {/* Right side actions */}
        <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-5">
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(toggleLike, "like"); }}
            className="flex flex-col items-center gap-1"
          >
            <Heart className={`w-7 h-7 ${liked ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
            <span className="text-white text-[10px]">{formatCount(short.likes)}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(commentsThread.toggleOpen, "comment"); }}
            className="flex flex-col items-center gap-1"
          >
            <MessageCircle className="w-7 h-7 text-white" />
            <span className="text-white text-[10px]">{formatCount(commentCount)}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => { handleShare(); }); }}
            className="flex flex-col items-center gap-1"
          >
            <Share2 className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(toggleSave, "save"); }}
            className="flex flex-col items-center gap-1"
          >
            <Bookmark className={`w-6 h-6 ${saved ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
          </button>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-14 z-20 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-20">
          <p className="text-white text-sm font-medium leading-snug mb-2">{short.title}</p>
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatCount(short.views)} views</span>
            <span>&middot;</span>
            <span>{short.timeAgo}</span>
          </div>
        </div>
      </div>

      {/* Comments panel — bottom sheet over the video, Instagram-style */}
      {commentsThread.open && (
        <div
          className="absolute inset-0 z-40 flex items-end justify-center"
          onClick={commentsThread.toggleOpen}
        >
          <div
            className="w-full max-w-sm max-h-[75vh] bg-white rounded-t-2xl flex flex-col animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0] flex-shrink-0">
              <span className="text-sm font-semibold text-[#0a0a0a]">{formatCount(commentCount)} comments</span>
              <button onClick={commentsThread.toggleOpen} className="p-1 hover:bg-[#f5f5f5] rounded-full transition-colors">
                <X className="w-4 h-4 text-[#737373]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
              {commentsThread.loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" /></div>
              ) : commentsThread.comments.length > 0 ? (
                <>
                  {commentsThread.comments.map((c) => (
                    <CommentThread
                      key={c.id}
                      comment={c}
                      currentUserId={currentUserId}
                      userTz={getUserTimezone()}
                      replyState={commentsThread.replyState[c.id]}
                      onDelete={handleDeleteComment}
                      onToggleReplies={commentsThread.toggleReplies}
                      onLoadMoreReplies={commentsThread.loadMoreReplies}
                      onSubmitReply={submitReply}
                    />
                  ))}
                  {commentsThread.hasMore && (
                    <button
                      onClick={commentsThread.loadMore}
                      disabled={commentsThread.loadingMore}
                      className="w-full text-xs text-[#737373] hover:text-[#0a0a0a] py-1.5 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {commentsThread.loadingMore ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {commentsThread.loadingMore ? "Loading…" : "Load more comments"}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-[#a3a3a3] text-center py-4">No comments yet</p>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-[#f0f0f0] flex-shrink-0 keyboard-aware">
              <div className="flex-1 flex items-center gap-1.5 bg-[#f5f5f5] rounded-full px-3 py-1.5">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
                  placeholder="Add a comment..."
                  className="flex-1 bg-transparent text-xs outline-none text-[#262626] placeholder:text-[#a3a3a3]"
                />
                <button onClick={submitComment} disabled={!commentText.trim() || postingComment} className="text-[#F44444] disabled:text-[#d5d5d5] transition-colors">
                  {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
