"use client";

import { useCallback, useState } from "react";

// Shared comment-thread state/orchestration for both Posts and Shorts —
// the two previously kept byte-for-byte duplicate copies of this logic
// (PostCard and ProfilePostCard); Shorts now reuses the same hook instead of
// growing a third copy. Comment-count display/formatting stays the caller's
// responsibility (Posts show a formatted string like "1.2k", Shorts a plain
// number) — this hook only manages the comment/reply lists and pagination.

export interface CommentItem {
  id: number;
  text: string;
  userId: number;
  name: string;
  handle?: string;
  avatar: string | null;
  verified?: boolean;
  createdAt: string;
  parentId?: number | null;
  replyCount?: number;
}

export interface CommentsPage {
  comments: CommentItem[];
  nextCursor: number | null;
  hasMore: boolean;
}

export interface CommentsAdapter {
  list: (cursor?: number | null, limit?: number) => Promise<CommentsPage>;
  listReplies: (parentId: number, cursor?: number | null, limit?: number) => Promise<CommentsPage>;
  add: (text: string, parentId?: number) => Promise<any>;
  remove: (commentId: number) => Promise<{ success?: boolean; removedCount?: number; totalComments?: number }>;
}

interface ReplyState {
  items: CommentItem[];
  cursor: number | null;
  hasMore: boolean;
  loading: boolean;
  expanded: boolean;
}

const emptyReplyState: ReplyState = { items: [], cursor: null, hasMore: false, loading: false, expanded: false };

export function useComments(adapter: CommentsAdapter) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyState, setReplyState] = useState<Record<number, ReplyState>>({});

  const load = useCallback(() => {
    setLoading(true);
    adapter.list()
      .then((result) => {
        setComments((prev) => {
          if (prev.length === 0) return result.comments;
          const loadedIds = new Set(result.comments.map((c) => c.id));
          const optimistic = prev.filter((c) => !loadedIds.has(c.id));
          return [...optimistic, ...result.comments];
        });
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adapter]);

  const toggleOpen = useCallback(() => {
    const opening = !open;
    setOpen(opening);
    if (opening && comments.length === 0) load();
  }, [open, comments.length, load]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || cursor == null) return;
    setLoadingMore(true);
    adapter.list(cursor)
      .then((result) => {
        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          return [...prev, ...result.comments.filter((c) => !existingIds.has(c.id))];
        });
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [adapter, cursor, hasMore, loadingMore]);

  const addComment = useCallback(async (text: string) => {
    const created = await adapter.add(text);
    if (created?.id) setComments((prev) => [created, ...prev]);
    return created;
  }, [adapter]);

  const toggleReplies = useCallback((parentId: number) => {
    const current = replyState[parentId] ?? emptyReplyState;
    const expanding = !current.expanded;
    const needsFetch = expanding && current.items.length === 0 && !current.loading;

    setReplyState((prev) => ({
      ...prev,
      [parentId]: { ...current, expanded: expanding, loading: needsFetch ? true : current.loading },
    }));

    if (needsFetch) {
      adapter.listReplies(parentId)
        .then((result) => {
          setReplyState((prev) => ({ ...prev, [parentId]: { items: result.comments, cursor: result.nextCursor, hasMore: result.hasMore, loading: false, expanded: true } }));
        })
        .catch(() => {
          setReplyState((prev) => ({ ...prev, [parentId]: { ...(prev[parentId] ?? current), loading: false } }));
        });
    }
  }, [adapter, replyState]);

  const loadMoreReplies = useCallback((parentId: number) => {
    const state = replyState[parentId];
    if (!state || !state.hasMore || state.loading || state.cursor == null) return;
    setReplyState((prev) => ({ ...prev, [parentId]: { ...state, loading: true } }));
    adapter.listReplies(parentId, state.cursor)
      .then((result) => {
        setReplyState((prev) => {
          const cur = prev[parentId] ?? state;
          const existingIds = new Set(cur.items.map((c) => c.id));
          return { ...prev, [parentId]: { items: [...cur.items, ...result.comments.filter((c) => !existingIds.has(c.id))], cursor: result.nextCursor, hasMore: result.hasMore, loading: false, expanded: true } };
        });
      })
      .catch(() => {
        setReplyState((prev) => ({ ...prev, [parentId]: { ...(prev[parentId] ?? state), loading: false } }));
      });
  }, [adapter, replyState]);

  const addReply = useCallback(async (parentId: number, text: string) => {
    const created = await adapter.add(text, parentId);
    if (created?.id) {
      setReplyState((prev) => {
        const state = prev[parentId] ?? emptyReplyState;
        return { ...prev, [parentId]: { ...state, items: [...state.items, created], expanded: true } };
      });
      setComments((prev) => prev.map((c) => (c.id === parentId ? { ...c, replyCount: (c.replyCount ?? 0) + 1 } : c)));
    }
    return created;
  }, [adapter]);

  const deleteComment = useCallback(async (commentId: number, parentId?: number) => {
    const res = await adapter.remove(commentId);
    if (parentId) {
      setReplyState((prev) => {
        const state = prev[parentId];
        if (!state) return prev;
        return { ...prev, [parentId]: { ...state, items: state.items.filter((c) => c.id !== commentId) } };
      });
      setComments((prev) => prev.map((c) => (c.id === parentId ? { ...c, replyCount: Math.max(0, (c.replyCount ?? 1) - 1) } : c)));
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      // The server cascades a top-level delete to its replies too.
      setReplyState((prev) => {
        if (!(commentId in prev)) return prev;
        const { [commentId]: _dropped, ...rest } = prev;
        return rest;
      });
    }
    return res;
  }, [adapter]);

  // Clears all thread state — needed when the caller's underlying target
  // (e.g. which Short is on screen) changes but the component holding this
  // hook stays mounted, so stale comments from the previous target don't
  // linger.
  const reset = useCallback(() => {
    setOpen(false);
    setComments([]);
    setCursor(null);
    setHasMore(false);
    setLoading(false);
    setLoadingMore(false);
    setReplyState({});
  }, []);

  return {
    open, toggleOpen,
    comments, loading, hasMore, loadMore, loadingMore,
    replyState, toggleReplies, loadMoreReplies,
    addComment, addReply, deleteComment,
    reset,
  };
}
