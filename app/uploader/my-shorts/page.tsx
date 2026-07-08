"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Video, Pencil, Trash2, Loader2, AlertCircle, Eye, Heart, Share2 } from "lucide-react";

interface Short {
  id: number;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: string;
  format: string;
  views: number;
  likes: number;
  shares: number;
  rejectionNote: string | null;
  createdAt: string;
  publishedAt: string | null;
}

type TabId = "all" | "draft" | "in_review" | "approved" | "published" | "rejected";

const TABS: { id: TabId; label: string }[] = [
  { id: "all",       label: "All"        },
  { id: "draft",     label: "Drafts"     },
  { id: "in_review", label: "In review"  },
  { id: "approved",  label: "Approved"   },
  { id: "published", label: "Published"  },
  { id: "rejected",  label: "Rejected"   },
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-[#f5f5f5] text-[#737373] border border-[#e5e5e5]" },
  in_review: { label: "In review", className: "bg-amber-500/10 text-amber-600 border border-amber-500/20" },
  approved:  { label: "Approved",  className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" },
  published: { label: "Published", className: "bg-blue-500/10 text-blue-600 border border-blue-500/20" },
  rejected:  { label: "Rejected",  className: "bg-red-500/10 text-red-600 border border-red-500/20" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function ShortCard({
  short,
  onDelete,
}: {
  short: Short;
  onDelete: (id: number) => void;
}) {
  const canEdit = short.status === "draft" || short.status === "rejected";
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="bg-white border border-[#f0f0f0] rounded-xl overflow-hidden hover:border-[#e5e5e5] transition-colors">
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-[#f5f5f5] overflow-hidden border-b border-[#f0f0f0]">
        {short.thumbnailUrl ? (
          <img src={short.thumbnailUrl} alt={short.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-8 h-8 text-[#a3a3a3]" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={short.status} />
        </div>
        {canEdit && (
          <Link
            href={`/uploader/create?id=${short.id}`}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/90 border border-[#f0f0f0] flex items-center justify-center hover:bg-white transition-colors shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5 text-[#0a0a0a]" />
          </Link>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-[#0a0a0a] truncate mb-1">{short.title}</p>
        <p className="text-xs text-[#a3a3a3]">{fmtDate(short.createdAt)}</p>

        {/* Rejection note */}
        {short.status === "rejected" && short.rejectionNote && (
          <div className="mt-2 px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-[10px] text-red-600 font-medium mb-0.5">Rejection note</p>
            <p className="text-[10px] text-red-600/90 leading-relaxed">{short.rejectionNote}</p>
          </div>
        )}

        {/* Stats (published only) */}
        {short.status === "published" && (
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-[#a3a3a3]">
              <Eye className="w-3 h-3" /> {short.views.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#a3a3a3]">
              <Heart className="w-3 h-3" /> {short.likes.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#a3a3a3]">
              <Share2 className="w-3 h-3" /> {short.shares.toLocaleString()}
            </span>
          </div>
        )}

        {/* Delete (draft/rejected only) */}
        {canEdit && (
          <button
            onClick={() => onDelete(short.id)}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] text-[#737373] hover:text-red-600 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function MyShortsPage() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const initialTab    = (searchParams.get("tab") as TabId) ?? "all";

  const [activeTab,  setActiveTab]  = useState<TabId>(initialTab);
  const [shorts,     setShorts]     = useState<Short[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error,      setError]      = useState("");

  const loadShorts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs  = activeTab !== "all" ? `?status=${activeTab}&limit=50` : "?limit=50";
      const res = await fetch(`/api/shorts${qs}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShorts(data.shorts ?? []);
    } catch {
      setError("Failed to load shorts");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadShorts(); }, [loadShorts]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    router.replace(`/uploader/my-shorts${tab !== "all" ? `?tab=${tab}` : ""}`, { scroll: false });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this short? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/shorts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to delete");
        return;
      }
      setShorts(s => s.filter(x => x.id !== id));
    } catch {
      setError("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const counts = shorts.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <p className="text-xl font-semibold text-[#0a0a0a] mb-6">My shorts</p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#f0f0f0]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-2 text-sm transition-colors relative ${
              activeTab === tab.id
                ? "text-[#0a0a0a] font-medium"
                : "text-[#737373] hover:text-[#0a0a0a]"
            }`}
          >
            {tab.label}
            {tab.id !== "all" && counts[tab.id] > 0 && (
              <span className="ml-1.5 text-[10px] text-[#a3a3a3]">
                {counts[tab.id]}
              </span>
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F44444] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-[#f5f5f5] rounded-xl border border-[#f0f0f0] aspect-[9/16] animate-pulse" />
          ))}
        </div>
      ) : shorts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Video className="w-10 h-10 text-[#d4d4d4] mb-4" />
          <p className="text-sm text-[#a3a3a3]">
            {activeTab === "all" ? "No shorts yet" : `No ${TABS.find(t => t.id === activeTab)?.label.toLowerCase()} shorts`}
          </p>
          {activeTab === "all" && (
            <Link
              href="/uploader/create"
              className="mt-3 text-xs text-[#F44444] hover:text-[#d64d3c] transition-colors"
            >
              Create your first short →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {shorts.map(s => (
            <div key={s.id} className={deletingId === s.id ? "opacity-40 pointer-events-none" : ""}>
              <ShortCard short={s} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
