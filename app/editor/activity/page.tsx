"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Loader2 } from "lucide-react";

const PAGE_SIZE = 20;

interface ActivityItem {
  id: number;
  action: string;
  createdAt: string;
  post: {
    id: number;
    title: string | null;
    section: { id: number; name: string; color: string } | null;
  };
}

import { ACTION_META } from "../action-meta";

function resolveActionKey(raw: string): string {
  if (raw.startsWith("STATUS_CHANGE|")) {
    try {
      const parsed = JSON.parse(raw.slice("STATUS_CHANGE|".length));
      return parsed.action ?? "note";
    } catch {
      return "note";
    }
  }
  return raw;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function EditorActivityPage() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch(`/api/editor/activity?limit=${PAGE_SIZE}&offset=0`)
      .then(r => r.ok ? r.json() : { activity: [], hasMore: false })
      .then(d => {
        setActivity(d.activity ?? []);
        setHasMore(d.hasMore ?? false);
      })
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, []);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    fetch(`/api/editor/activity?limit=${PAGE_SIZE}&offset=${activity.length}`)
      .then(r => r.ok ? r.json() : { activity: [], hasMore: false })
      .then(d => {
        setActivity(prev => [...prev, ...(d.activity ?? [])]);
        setHasMore(d.hasMore ?? false);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="p-8 max-w-2xl">
      <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Activity</p>
      <p className="text-xs text-[#a3a3a3] mb-6">Your recent editorial actions.</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-[#f5f5f5] animate-pulse" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <History className="w-8 h-8 text-[#d4d4d4] mb-3" />
          <p className="text-sm text-[#a3a3a3]">No activity yet</p>
          <p className="text-xs text-[#c4c4c4] mt-1">Notes, revisions, approvals and publishes will appear here.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activity.map(item => {
            const meta = ACTION_META[resolveActionKey(item.action)] ?? ACTION_META.note;
            return (
              <Link
                key={item.id}
                href={`/editor/review/${item.post.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#f0f0f0] bg-white hover:border-[#e5e5e5] transition-colors"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0a0a0a] truncate">
                    <span className="text-[#737373]">{meta.verb}</span>{" "}
                    {item.post.title ?? "Untitled"}
                  </p>
                  {item.post.section && (
                    <span className="text-xs text-[#a3a3a3]">{item.post.section.name}</span>
                  )}
                </div>
                <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{timeAgo(item.createdAt)}</span>
              </Link>
            );
          })}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 py-3 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors disabled:opacity-50"
            >
              {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
