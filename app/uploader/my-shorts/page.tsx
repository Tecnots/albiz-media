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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "#737373", bg: "#1a1a1a"  },
  in_review: { label: "In review", color: "#D97706", bg: "#2a1f0a"  },
  approved:  { label: "Approved",  color: "#16A34A", bg: "#0a1f0e"  },
  published: { label: "Published", color: "#2563EB", bg: "#0a0f1f"  },
  rejected:  { label: "Rejected",  color: "#DC2626", bg: "#1f0a0a"  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
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
    <div className="bg-[#141414] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#262626] transition-colors">
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-[#0d0d0d] overflow-hidden">
        {short.thumbnailUrl ? (
          <img src={short.thumbnailUrl} alt={short.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-8 h-8 text-[#262626]" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={short.status} />
        </div>
        {canEdit && (
          <Link
            href={`/uploader/create?id=${short.id}`}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-[#0a0a0a]/80 flex items-center justify-center hover:bg-[#0a0a0a] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-[#d4d4d4]" />
          </Link>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-[#d4d4d4] truncate mb-1">{short.title}</p>
        <p className="text-xs text-[#404040]">{fmtDate(short.createdAt)}</p>

        {/* Rejection note */}
        {short.status === "rejected" && short.rejectionNote && (
          <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#1f0a0a] border border-[#2a1010]">
            <p className="text-[10px] text-[#DC2626] font-medium mb-0.5">Rejection note</p>
            <p className="text-[10px] text-[#8a3333] leading-relaxed">{short.rejectionNote}</p>
          </div>
        )}

        {/* Stats (published only) */}
        {short.status === "published" && (
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-[#525252]">
              <Eye className="w-3 h-3" /> {short.views.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#525252]">
              <Heart className="w-3 h-3" /> {short.likes.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#525252]">
              <Share2 className="w-3 h-3" /> {short.shares.toLocaleString()}
            </span>
          </div>
        )}

        {/* Delete (draft/rejected only) */}
        {canEdit && (
          <button
            onClick={() => onDelete(short.id)}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] text-[#525252] hover:text-[#DC2626] hover:bg-[#1a0a0a] transition-colors"
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
    <div className="px-8 py-8">
      <p className="text-xl font-semibold text-[#fafafa] mb-6">My shorts</p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[#1a1a1a]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-2 text-sm transition-colors relative ${
              activeTab === tab.id
                ? "text-[#fafafa] font-medium"
                : "text-[#525252] hover:text-[#737373]"
            }`}
          >
            {tab.label}
            {tab.id !== "all" && counts[tab.id] > 0 && (
              <span className="ml-1.5 text-[10px] text-[#525252]">
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1f0a0a] border border-[#2a1010] mb-4">
          <AlertCircle className="w-4 h-4 text-[#DC2626]" />
          <p className="text-sm text-[#DC2626]">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-[#141414] rounded-xl border border-[#1a1a1a] aspect-[9/16] animate-pulse" />
          ))}
        </div>
      ) : shorts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Video className="w-10 h-10 text-[#262626] mb-4" />
          <p className="text-sm text-[#525252]">
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
