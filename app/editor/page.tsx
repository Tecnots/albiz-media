"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { useEditorContext } from "./context";
import { ACTION_META } from "./action-meta";

interface QueueSummary {
  total: number;
  submitted: number;
  under_review: number;
  revision_requested: number;
  approved: number;
  unresolvedNotes: number;
}

interface Section {
  id: number;
  name: string;
  color: string;
  canPublish: boolean;
}

interface QueueArticle {
  id: number;
  title: string | null;
  status: string;
  createdAt: string;
  unresolvedNotes: number;
  user: { name: string };
  section: { name: string; color: string } | null;
}

interface ActivityItem {
  id: number;
  action: string;
  createdAt: string;
  post: { id: number; title: string | null };
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

export default function EditorDashboard() {
  const { user } = useEditorContext();
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [needsAttention, setNeedsAttention] = useState<QueueArticle[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/editor/queue").then(r => r.ok ? r.json() : { articles: [] }),
      fetch("/api/editor/sections").then(r => r.ok ? r.json() : { sections: [] }),
      fetch("/api/editor/activity?limit=5").then(r => r.ok ? r.json() : { activity: [] }),
    ]).then(([queueData, sectionsData, activityData]) => {
      const articles: QueueArticle[] = queueData.articles ?? [];
      setSummary({
        total: articles.length,
        submitted: articles.filter(a => a.status === "submitted").length,
        under_review: articles.filter(a => a.status === "under_review").length,
        revision_requested: articles.filter(a => a.status === "revision_requested").length,
        approved: articles.filter(a => a.status === "approved").length,
        unresolvedNotes: articles.reduce((sum, a) => sum + (a.unresolvedNotes ?? 0), 0),
      });

      setNeedsAttention(
        articles
          .filter(a => a.status === "submitted" || a.status === "revision_requested")
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(0, 5)
      );

      setSections(
        (sectionsData.sections ?? []).map((es: { sectionId: number; name: string; color: string; canPublish: boolean }) => ({
          id: es.sectionId,
          name: es.name,
          color: es.color,
          canPublish: es.canPublish,
        }))
      );

      setActivity(activityData.activity ?? []);
    });
  }, []);

  const stats = summary
    ? [
        { label: "In queue", value: summary.total },
        { label: "Submitted", value: summary.submitted },
        { label: "Awaiting publish", value: summary.approved },
        { label: "Open notes", value: summary.unresolvedNotes },
      ]
    : [];

  return (
    <div className="p-8 max-w-3xl">
      <p className="text-sm font-semibold text-[#0a0a0a] mb-1">
        {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Editor Studio"}
      </p>
      <p className="text-xs text-[#a3a3a3] mb-8">Your editorial queue at a glance.</p>

      {summary !== null && (
        <div className="grid grid-cols-4 gap-3 mb-10">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-xl border border-[#f0f0f0] bg-white p-4">
              <p className="text-2xl font-bold text-[#0a0a0a]">{stat.value}</p>
              <p className="text-xs text-[#a3a3a3] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-[#525252] mb-3">Needs attention</p>
          <div className="space-y-2">
            {needsAttention.map(a => (
              <Link
                key={a.id}
                href={`/editor/review/${a.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#f0f0f0] bg-white hover:border-[#e5e5e5] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{a.title ?? "Untitled"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#737373]">{a.user.name}</span>
                    {a.section && (
                      <span className="flex items-center gap-1 text-xs text-[#737373]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.section.color }} />
                        {a.section.name}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={a.status === "revision_requested"
                    ? { background: "#FFF5F5", color: "#F44444" }
                    : { background: "#EFF6FF", color: "#3B82F6" }}
                >
                  {a.status === "revision_requested" ? "Revision" : "Submitted"}
                </span>
                <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{timeAgo(a.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {activity.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#525252]">Recent activity</p>
            <Link href="/editor/activity" className="text-xs text-[#0EA5E9] hover:underline">View all</Link>
          </div>
          <div className="space-y-1.5">
            {activity.map(item => {
              const meta = ACTION_META[item.action] ?? ACTION_META.note;
              return (
                <Link
                  key={item.id}
                  href={`/editor/review/${item.post.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#f0f0f0] bg-white hover:border-[#e5e5e5] transition-colors"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                  <p className="flex-1 min-w-0 text-sm text-[#0a0a0a] truncate">
                    <span className="text-[#737373]">{meta.verb}</span> {item.post.title ?? "Untitled"}
                  </p>
                  <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{timeAgo(item.createdAt)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-[#525252] mb-3">Your sections</p>
          <div className="space-y-2">
            {sections.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#f0f0f0] bg-white">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-sm text-[#0a0a0a]">{s.name}</span>
                </div>
                {s.canPublish && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#0EA5E9]">
                    Can publish
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary !== null && summary.total === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <InboxIcon className="w-8 h-8 text-[#d4d4d4] mb-3" />
          <p className="text-sm text-[#a3a3a3]">No articles in your queue</p>
          <p className="text-xs text-[#c4c4c4] mt-1">Articles submitted in your sections will appear here.</p>
        </div>
      )}

      {summary !== null && summary.total > 0 && (
        <Link
          href="/editor/queue"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0EA5E9] text-white text-sm font-medium hover:bg-[#0284c7] transition-colors"
        >
          <InboxIcon className="w-3.5 h-3.5" />
          View queue ({summary.total})
        </Link>
      )}
    </div>
  );
}
