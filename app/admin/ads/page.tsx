"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Eye, MousePointer, DollarSign, TrendingUp, Pause, Play, MoreVertical, Plus, X, Calendar, Target, Pencil, ImagePlus, Search, Loader2, Copy, Trash2, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AdminStatCard, AdminChart, AdminPillTabs, StatusBadge, AdminModal, Dropdown } from "../admin-components";

const tabs = ["Live Ads", "Campaigns", "Performance", "Revenue", "Configuration", "Algorithm", "Placements"];

// Label with inline ? explanation that expands between the label and input.
function FieldLabel({ children, help }: { children: string; help?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-[#525252]">{children}</span>
        {help && (
          <button
            type="button"
            onClick={() => setOpen(p => !p)}
            className={`w-4 h-4 rounded-full border transition-colors flex items-center justify-center text-[9px] font-bold leading-none cursor-pointer flex-shrink-0 ${open ? "border-[#0a0a0a] text-[#0a0a0a]" : "border-[#d5d5d5] text-[#a3a3a3] hover:border-[#a3a3a3] hover:text-[#525252]"}`}
          >
            ?
          </button>
        )}
      </div>
      {open && help && (
        <div className="mt-1.5 px-2.5 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[11px] text-[#525252] leading-relaxed shadow-sm">
          {help}
        </div>
      )}
    </div>
  );
}

type AdCampaign = {
  id: number; name: string; advertiser: string; advertiserEmail?: string; status: string;
  budget: string; spent: string; budgetRaw: number; spentRaw: number;
  impressions: string; clicks: string; ctr: string; cpc: string;
  startDate: string; endDate: string; placement: string; placements: string[];
  promoteType?: string; image: string | null;
  headline: string; description: string; ctaText: string; ctaUrl: string;
  sponsorName: string; sponsorLogo: string | null;
  startDateRaw?: string | null; endDateRaw?: string | null; createdAtRaw?: string | null;
  cpcRaw?: number;
  impressionsRaw?: number; clicksRaw?: number;
  targetCountries?: string[]; targetTags?: string[]; targetAudience?: string;
  pacing?: string; dailyBudget?: number | null; frequencyCap?: number; priority?: number;
  creatives?: { id: number; headline: string; image: string | null; weight: number; impressions: number; clicks: number; ctr: string }[];
};

type PlacementZone = {
  id: number;
  name: string;
  key: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  zone: string;
  positionX: number;
  positionY: number;
  width: number | null;
  height: number | null;
};

function getDaysRemaining(endDateRaw: string | null): number | null {
  if (!endDateRaw) return null;
  return Math.ceil((new Date(endDateRaw).getTime() - Date.now()) / 86_400_000);
}

function getPacing(
  budgetRaw: number, spentRaw: number,
  startDateRaw: string | null, endDateRaw: string | null,
) {
  if (!startDateRaw || !endDateRaw || budgetRaw === 0) return null;
  const now = Date.now();
  const start = new Date(startDateRaw).getTime();
  const end = new Date(endDateRaw).getTime();
  const total = end - start;
  if (total <= 0) return null;
  const expectedPct = Math.min(1, Math.max(0, now - start) / total);
  const actualPct = Math.min(1, spentRaw / budgetRaw);
  const diff = actualPct - expectedPct;
  if (diff < -0.15) return { label: "Under-delivering", color: "#F59E0B", actualPct, expectedPct };
  if (diff > 0.15)  return { label: "Overspending",     color: "#F44444", actualPct, expectedPct };
  return                   { label: "On pace",           color: "#22c55e", actualPct, expectedPct };
}

function LiveAdsTab() {
  const [ads, setAds] = useState<{
    id: number; name: string; brand: string; headline: string; image: string | null;
    placement: string; status: string; impressions: string; clicks: string;
    ctr: string; spent: string; budget: string;
    budgetRaw: number; spentRaw: number;
    startDateRaw: string | null; endDateRaw: string | null;
    creatives: { id: number; headline: string; image: string | null; weight: number; impressions: number; clicks: number; ctr: string }[];
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ brand: "", headline: "", image: "" });

  const load = useCallback(() => {
    fetch("/api/admin/ads?status=active")
      .then(r => r.ok ? r.json() : [])
      .then((data: AdCampaign[]) => {
        setAds((Array.isArray(data) ? data : []).map(c => ({
          id: c.id, name: c.name, brand: c.sponsorName || c.advertiser, headline: c.headline,
          image: c.image || null, placement: c.placements.join(", ") || "Feed", status: c.status,
          impressions: c.impressions, clicks: c.clicks, ctr: c.ctr,
          spent: c.spent, budget: c.budget,
          budgetRaw: c.budgetRaw, spentRaw: c.spentRaw,
          startDateRaw: c.startDateRaw ?? null,
          endDateRaw: c.endDateRaw ?? null,
          creatives: c.creatives ?? [],
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const togglePause = async (adId: number, currentStatus: string) => {
    const next = currentStatus === "active" ? "paused" : "active";
    setAds(prev => prev.map(a => a.id === adId ? { ...a, status: next } : a));
    await fetch(`/api/admin/ads/${adId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => {});
  };

  const startEdit = (ad: typeof ads[0]) => {
    setEditingId(ad.id);
    setEditForm({ brand: ad.brand, headline: ad.headline, image: ad.image ?? "" });
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const id = editingId;
    setAds(prev => prev.map(a => a.id === id ? { ...a, brand: editForm.brand, headline: editForm.headline, image: editForm.image || a.image } : a));
    setEditingId(null);
    await fetch(`/api/admin/ads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: editForm.brand, headline: editForm.headline, image: editForm.image }),
    }).catch(() => {});
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-[#a3a3a3]"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (ads.length === 0) {
    return <p className="text-sm text-[#737373] py-8 text-center">No active ads. Create and activate a campaign to see live ads here.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#737373]">Preview and edit ads as they appear to users on the platform.</p>

      {ads.map(ad => {
        const daysLeft = getDaysRemaining(ad.endDateRaw);
        const pacing = getPacing(ad.budgetRaw, ad.spentRaw, ad.startDateRaw, ad.endDateRaw);
        return (
          <div key={ad.id} className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e5e5]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[#0a0a0a]">{ad.name}</span>
                <StatusBadge status={ad.status} />
                <span className="text-xs text-[#a3a3a3]">{ad.placement}</span>
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${daysLeft <= 2 ? "bg-[#FFF3CD] text-[#92400E]" : "bg-[#f5f5f5] text-[#737373]"}`}>
                    {daysLeft === 0 ? "Ends today" : `${daysLeft}d left`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-[#737373]">
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {ad.impressions}</span>
                <span className="flex items-center gap-1"><MousePointer className="w-3 h-3" /> {ad.clicks}</span>
                <span className="font-medium text-[#F44444]">{ad.ctr} CTR</span>
                <span className="font-medium text-[#22c55e]">{ad.spent}</span>
                <button
                  onClick={() => togglePause(ad.id, ad.status)}
                  className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
                  title={ad.status === "active" ? "Pause" : "Resume"}
                >
                  {ad.status === "active"
                    ? <Pause className="w-4 h-4 text-[#737373]" />
                    : <Play className="w-4 h-4 text-[#22c55e]" />}
                </button>
                <button onClick={() => startEdit(ad)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                  <Pencil className="w-4 h-4 text-[#525252]" />
                </button>
              </div>
            </div>

            <div className="flex gap-6 p-5">
              {/* Live Preview */}
              <div className="w-64 flex-shrink-0">
                <span className="text-[10px] font-semibold tracking-widest text-[#a3a3a3] uppercase block mb-2">Preview</span>
                <div className="rounded-2xl overflow-hidden relative bg-[#1a1a1a]" style={{ height: 380 }}>
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 rounded text-xs text-white z-10">Ad</div>
                  {ad.image ? (
                    <Image src={ad.image} alt={ad.name} width={400} height={600} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-xs text-white/20">No image</p>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-white font-semibold text-lg">{ad.brand}</span>
                    <p className="text-sm text-white mt-1 line-clamp-2">{ad.headline}</p>
                  </div>
                </div>
              </div>

              {/* Edit Form or Details */}
              {editingId === ad.id ? (
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Brand name</label>
                    <input type="text" value={editForm.brand} onChange={e => setEditForm(p => ({ ...p, brand: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Headline</label>
                    <textarea value={editForm.headline} onChange={e => setEditForm(p => ({ ...p, headline: e.target.value }))} rows={3} className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none resize-none focus:ring-2 focus:ring-[#F44444]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Image URL</label>
                    <div className="flex gap-2">
                      <input type="text" value={editForm.image} onChange={e => setEditForm(p => ({ ...p, image: e.target.value }))} className="flex-1 px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
                      <button className="px-3 py-2.5 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors">
                        <ImagePlus className="w-4 h-4 text-[#525252]" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveEdit} className="px-5 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Save</button>
                    <button onClick={() => setEditingId(null)} className="px-5 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[#e5e5e5] p-4">
                      <span className="text-xs text-[#a3a3a3]">Brand</span>
                      <p className="text-sm font-medium text-[#0a0a0a] mt-1">{ad.brand}</p>
                    </div>
                    <div className="rounded-xl border border-[#e5e5e5] p-4">
                      <span className="text-xs text-[#a3a3a3]">Placement</span>
                      <p className="text-sm font-medium text-[#0a0a0a] mt-1">{ad.placement}</p>
                    </div>
                    <div className="rounded-xl border border-[#e5e5e5] p-4 col-span-2">
                      <span className="text-xs text-[#a3a3a3]">Headline</span>
                      <p className="text-sm text-[#0a0a0a] mt-1">{ad.headline}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="rounded-xl border border-[#e5e5e5] p-3 text-center">
                      <span className="text-lg font-bold text-[#0a0a0a]">{ad.impressions}</span>
                      <p className="text-[10px] text-[#737373] mt-0.5">Impressions</p>
                    </div>
                    <div className="rounded-xl border border-[#e5e5e5] p-3 text-center">
                      <span className="text-lg font-bold text-[#0a0a0a]">{ad.clicks}</span>
                      <p className="text-[10px] text-[#737373] mt-0.5">Clicks</p>
                    </div>
                    <div className="rounded-xl border border-[#e5e5e5] p-3 text-center">
                      <span className="text-lg font-bold text-[#F44444]">{ad.ctr}</span>
                      <p className="text-[10px] text-[#737373] mt-0.5">CTR</p>
                    </div>
                    <div className="rounded-xl border border-[#e5e5e5] p-3 text-center">
                      <span className="text-lg font-bold text-[#22c55e]">{ad.spent}</span>
                      <p className="text-[10px] text-[#737373] mt-0.5">Revenue</p>
                    </div>
                  </div>

                  {pacing && (
                    <div className="mt-3 rounded-xl border border-[#e5e5e5] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#a3a3a3]">Budget pacing</span>
                        <span className="text-xs font-semibold" style={{ color: pacing.color }}>{pacing.label}</span>
                      </div>
                      <div className="h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, pacing.actualPct * 100)}%`, backgroundColor: pacing.color }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-[#a3a3a3]">{ad.spent} spent</span>
                        <span className="text-[10px] text-[#a3a3a3]">{ad.budget} budget</span>
                      </div>
                    </div>
                  )}

                  {ad.creatives.length > 1 && (() => {
                    const best = ad.creatives.reduce((a, b) => (parseFloat(b.ctr) > parseFloat(a.ctr) ? b : a));
                    return (
                      <div className="mt-3 rounded-xl border border-[#e5e5e5] p-4">
                        <span className="text-xs text-[#a3a3a3] block mb-2.5">A/B variants · {ad.creatives.length}</span>
                        <div className="space-y-2">
                          {ad.creatives.map((cr, i) => {
                            const isBest = cr.id === best.id && cr.impressions > 0;
                            return (
                              <div key={cr.id} className="flex items-center gap-3">
                                <span className="text-[10px] font-semibold text-[#a3a3a3] w-4">{String.fromCharCode(65 + i)}</span>
                                <p className="flex-1 min-w-0 text-xs text-[#0a0a0a] truncate">{cr.headline || "Untitled"}</p>
                                <span className="text-[10px] text-[#737373] tabular-nums">{cr.impressions} impr</span>
                                <span className={`text-xs font-medium tabular-nums w-12 text-right ${isBest ? "text-[#22c55e]" : "text-[#737373]"}`}>{cr.ctr}</span>
                                {isBest && <span className="text-[9px] font-semibold text-[#22c55e] uppercase tracking-wide">Lead</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PLACEMENTS = [
  { key: "Feed", label: "Feed", desc: "Between posts" },
  { key: "Sidebar", label: "Sidebar", desc: "Right panel" },
  { key: "Stories", label: "Stories", desc: "Between stories" },
  { key: "Custom", label: "Custom", desc: "Top banner in feed" },
];

const PROMOTE_TYPES = [
  { value: "article", label: "News / Article", description: "Promote a published article" },
  { value: "post",    label: "Post",           description: "Promote a specific post" },
  { value: "profile", label: "Profile",        description: "Promote a user or brand profile" },
  { value: "custom",  label: "Custom",         description: "Custom ad creative" },
];

function ArticlePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [articles, setArticles] = useState<{ id: number; title: string; image: string | null; date: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/posts?status=all")
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const arts = Array.isArray(data) ? data : [];
        setArticles(arts.filter(p => p.title && p.type === "article"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = articles.filter(a =>
    !query || a.title.toLowerCase().includes(query.toLowerCase())
  );

  const select = (a: typeof articles[0]) => {
    setQuery(a.title);
    onChange(String(a.id));
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] focus-within:border-[#F44444] focus-within:ring-1 focus-within:ring-[#F44444]/20 transition-all">
        <Search className="w-3.5 h-3.5 text-[#a3a3a3] flex-shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search articles…"
          className="flex-1 text-sm bg-transparent outline-none text-[#0a0a0a] placeholder:text-[#a3a3a3]"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); onChange(""); }} className="text-[#a3a3a3] hover:text-[#525252]">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden max-h-52 overflow-y-auto">
          {filtered.slice(0, 8).map(a => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => select(a)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#fafafa] transition-colors text-left"
            >
              {a.image && (
                <div className="w-10 h-7 rounded overflow-hidden flex-shrink-0 bg-[#f5f5f5]">
                  <Image src={a.image} alt="" width={40} height={28} className="object-cover w-full h-full" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#0a0a0a] truncate">{a.title}</p>
                <p className="text-[10px] text-[#a3a3a3]">{a.date}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
          <p className="text-xs text-[#a3a3a3]">No articles found</p>
        </div>
      )}
    </div>
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [variants, setVariants] = useState<{ headline: string; image: string; cta: string }[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("startDate:desc");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [extendingId, setExtendingId] = useState<number | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [customZones, setCustomZones] = useState<PlacementZone[]>([]);
  const [customZoneIds, setCustomZoneIds] = useState<number[]>([]);

  const loadCampaigns = () => {
    fetch("/api/admin/ads")
      .then(r => r.ok ? r.json() : [])
      .then((data: AdCampaign[]) => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadCampaigns(); }, []);

  useEffect(() => {
    fetch("/api/admin/ads/placements")
      .then(r => r.ok ? r.json() : [])
      .then((data: PlacementZone[]) => setCustomZones(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);


  const emptyForm = {
    name: "", advertiser: "", budget: "",
    placements: ["Feed"] as string[],
    promoteType: "custom",
    promoteTarget: "",
    adImage: "",
    adHeadline: "",
    adCta: "Learn More",
    adCtaUrl: "",
    startDate: "", endDate: "",
    // Targeting + pacing (algorithm inputs)
    targetCountries: [] as string[],
    targetTags: [] as string[],
    targetAudience: "all",
    pacing: "even",
    dailyBudget: "",
    frequencyCap: "",
    priority: "0",
  };
  const [newCampaign, setNewCampaign] = useState(emptyForm);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "ads");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const { url } = await res.json();
        setNewCampaign(p => ({ ...p, adImage: url }));
      }
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const filterTabs = ["All", "Active", "Paused", "Completed", "Scheduled"];
  const drafts = campaigns.filter(c => c.status === "draft");
  const [sortBy, sortDir] = sortKey.split(":");
  const filtered = campaigns
    .filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.advertiser.toLowerCase().includes(q)) return false;
      }
      if (filter === 1) return c.status === "active";
      if (filter === 2) return c.status === "paused";
      if (filter === 3) return c.status === "completed";
      if (filter === 4) return c.status === "scheduled";
      return true;
    })
    .sort((a, b) => {
      let val = 0;
      if (sortBy === "spend") val = a.spentRaw - b.spentRaw;
      else if (sortBy === "ctr") val = parseFloat(a.ctr) - parseFloat(b.ctr);
      else if (sortBy === "startDate") val = new Date(a.startDateRaw ?? 0).getTime() - new Date(b.startDateRaw ?? 0).getTime();
      else val = a.name.localeCompare(b.name);
      return sortDir === "asc" ? val : -val;
    });

  const setStatus = async (id: number, next: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: next } : c));
    const res = await fetch(`/api/admin/ads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (!res || !res.ok) loadCampaigns(); // revert to server truth on failure
  };

  const togglePause = (id: number) => {
    const current = campaigns.find(c => c.id === id);
    if (!current) return;
    setStatus(id, current.status === "active" ? "paused" : "active");
  };

  const deleteCampaign = async (id: number) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    const res = await fetch(`/api/admin/ads/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) loadCampaigns();
  };

  const togglePlacement = (key: string) => {
    setNewCampaign(p => ({
      ...p,
      placements: p.placements.includes(key)
        ? p.placements.filter(pl => pl !== key)
        : [...p.placements, key],
    }));
  };

  const toggleCustomZone = (id: number) => {
    setCustomZoneIds(prev =>
      prev.includes(id) ? prev.filter(z => z !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!newCampaign.name.trim() || !newCampaign.advertiser.trim()) return;
    if (newCampaign.placements.length === 0 && customZoneIds.length === 0) return;
    setCreating(true);
    setCreateError("");
    try {
      const body: any = { ...newCampaign, customZoneIds };
      if (variants.length > 0) {
        body.variants = variants.filter(v => v.headline.trim());
      }
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data?.error || "Failed to create campaign");
        return;
      }
      setCampaigns(prev => [data, ...prev]);
      setNewCampaign(emptyForm);
      setCustomZoneIds([]);
      setVariants([]);
      setShowCreate(false);
    } catch {
      setCreateError("Network error — please try again");
    } finally {
      setCreating(false);
    }
  };

  const duplicateCampaign = async (campaign: AdCampaign) => {
    setOpenMenuId(null);
    const res = await fetch("/api/admin/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaign.name + " (copy)",
        advertiser: campaign.advertiser,
        placements: campaign.placements,
        promoteType: campaign.promoteType ?? "custom",
        adImage: campaign.image,
        adHeadline: campaign.headline,
        adCta: campaign.ctaText,
        adCtaUrl: campaign.ctaUrl,
        budget: campaign.budgetRaw,
        cpc: campaign.cpcRaw ?? 0.35,
        targetCountries: campaign.targetCountries ?? [],
        targetTags: campaign.targetTags ?? [],
        targetAudience: campaign.targetAudience ?? "all",
        pacing: campaign.pacing ?? "even",
        dailyBudget: campaign.dailyBudget ?? null,
        frequencyCap: campaign.frequencyCap ?? 0,
        priority: campaign.priority ?? 0,
      }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setCampaigns(prev => [data, ...prev]);
    } else {
      const err = await res?.json().catch(() => null);
      alert(err?.error || "Failed to duplicate");
    }
  };

  const saveExtend = async () => {
    if (!extendingId || !extendDate) return;
    const id = extendingId;
    const formatted = new Date(extendDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, endDate: formatted, endDateRaw: extendDate } : c));
    setExtendingId(null);
    await fetch(`/api/admin/ads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: extendDate }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      {/* Search + sort + New */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a3a3a3] pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-[#525252] outline-none cursor-pointer"
        >
          <option value="startDate:desc">Newest</option>
          <option value="startDate:asc">Oldest</option>
          <option value="spend:desc">Highest spend</option>
          <option value="ctr:desc">Highest CTR</option>
          <option value="name:asc">Name A–Z</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      <AdminPillTabs tabs={filterTabs} activeTab={filter} onTabChange={setFilter} />

      {/* Review queue */}
      {filter === 0 && drafts.length > 0 && (
        <div className="rounded-xl border border-[#F59E0B]/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-[#F59E0B]/20 bg-[#FFFBEB]">
            <span className="text-xs font-semibold text-[#92400E]">
              {drafts.length} {drafts.length === 1 ? "campaign" : "campaigns"} pending review
            </span>
          </div>
          <div className="divide-y divide-[#FEF3C7]">
            {drafts.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 bg-[#FFFBEB]/50 hover:bg-[#FFFBEB] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{c.name}</p>
                  <p className="text-xs text-[#737373]">{c.advertiser} · {c.budget} · {c.startDate} – {c.endDate}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setStatus(c.id, "active")}
                    className="px-3 py-1.5 rounded-full bg-[#22c55e] text-white text-xs font-medium hover:bg-[#16a34a] transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => { if (confirm(`Reject and delete "${c.name}"?`)) deleteCampaign(c.id); }}
                    className="px-3 py-1.5 rounded-full border border-[#e5e5e5] text-[#737373] text-xs font-medium hover:bg-[#f5f5f5] transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-16 text-[#a3a3a3]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-[#737373] py-12 text-center">
            {search ? `No campaigns match "${search}"` : "No campaigns yet. Click \"New Campaign\" to create one."}
          </p>
        )}
        {filtered.map(campaign => (
          <div key={campaign.id} className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden hover:border-[#d5d5d5] transition-colors">
            <div className="flex items-start gap-4 p-5">
              {campaign.image && (
                <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block">
                  <Image src={campaign.image} alt={campaign.name} width={96} height={64} className="object-cover w-full h-full" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm text-[#0a0a0a] truncate">{campaign.name}</h3>
                  <StatusBadge status={campaign.status} />
                </div>
                <p className="text-xs text-[#737373] mb-1">{campaign.advertiser} &middot; {campaign.placement}</p>
                {extendingId === campaign.id ? (
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="date"
                      value={extendDate}
                      onChange={e => setExtendDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20"
                    />
                    <button onClick={saveExtend} className="text-xs font-medium text-white bg-[#F44444] px-3 py-1 rounded-full hover:bg-[#d64d3c] transition-colors">Save</button>
                    <button onClick={() => setExtendingId(null)} className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-[#737373]">{campaign.startDate} – {campaign.endDate}</span>
                    {(campaign.status === "active" || campaign.status === "paused") && (
                      <button
                        onClick={() => { setExtendingId(campaign.id); setExtendDate(campaign.endDateRaw ?? ""); }}
                        className="text-[10px] font-medium text-[#a3a3a3] hover:text-[#F44444] transition-colors"
                      >
                        Extend
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <span className="text-xs text-[#a3a3a3]">Budget</span>
                    <p className="text-sm font-medium text-[#0a0a0a]">{campaign.budget}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#a3a3a3]">Spent</span>
                    <p className="text-sm font-medium text-[#0a0a0a]">{campaign.spent}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#a3a3a3]">Impressions</span>
                    <p className="text-sm font-medium text-[#0a0a0a]">{campaign.impressions}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#a3a3a3]">Clicks</span>
                    <p className="text-sm font-medium text-[#0a0a0a]">{campaign.clicks}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#a3a3a3]">CTR</span>
                    <p className="text-sm font-medium text-[#F44444]">{campaign.ctr}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {(campaign.status === "draft" || campaign.status === "scheduled") && (
                  <button
                    onClick={() => setStatus(campaign.id, "active")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#22c55e] text-white text-xs font-medium hover:bg-[#16a34a] transition-colors"
                    title="Activate — start serving this ad"
                  >
                    <Play className="w-3.5 h-3.5" /> Activate
                  </button>
                )}
                {(campaign.status === "active" || campaign.status === "paused") && (
                  <button
                    onClick={() => togglePause(campaign.id)}
                    className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
                    title={campaign.status === "active" ? "Pause" : "Resume"}
                  >
                    {campaign.status === "active" ? <Pause className="w-4 h-4 text-[#737373]" /> : <Play className="w-4 h-4 text-[#22c55e]" />}
                  </button>
                )}
                <div className="relative">
                  {openMenuId === campaign.id && (
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                  )}
                  <button
                    onClick={() => setOpenMenuId(openMenuId === campaign.id ? null : campaign.id)}
                    className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4 text-[#737373]" />
                  </button>
                  {openMenuId === campaign.id && (
                    <div className="absolute right-0 top-9 z-20 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden min-w-[140px]">
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors text-left cursor-pointer"
                        onClick={() => duplicateCampaign(campaign)}
                      >
                        <Copy className="w-3.5 h-3.5 text-[#737373]" /> Duplicate
                      </button>
                      <button
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#F44444] hover:bg-[#fafafa] transition-colors text-left cursor-pointer"
                        onClick={() => { setOpenMenuId(null); deleteCampaign(campaign.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {campaign.status !== "scheduled" && campaign.budget !== "$0" && (
              <div className="px-5 pb-4">
                <div className="h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (parseFloat(campaign.spent.replace(/[$,]/g, "")) / parseFloat(campaign.budget.replace(/[$,]/g, ""))) * 100)}%`,
                      backgroundColor: campaign.status === "completed" ? "#22c55e" : "#F44444",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#a3a3a3]">{campaign.spent} spent</span>
                  <span className="text-[10px] text-[#a3a3a3]">{campaign.budget} budget</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Campaign creator slide-over ── */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-4xl bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5] flex-shrink-0">
                <span className="text-sm font-semibold text-[#0a0a0a]">New Campaign</span>
                <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors cursor-pointer">
                  <X className="w-4 h-4 text-[#737373]" />
                </button>
              </div>

              {/* Body — two columns */}
              <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* LEFT: Form */}
                <div className="w-80 flex-shrink-0 border-r border-[#e5e5e5] overflow-y-auto p-5 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Campaign name</label>
                    <input autoFocus type="text" value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Spring Launch" className="w-full px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Advertiser</label>
                    <input type="text" value={newCampaign.advertiser} onChange={e => setNewCampaign(p => ({ ...p, advertiser: e.target.value }))} placeholder="Company or brand name" className="w-full px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Promote</label>
                    <Dropdown value={newCampaign.promoteType} onChange={v => setNewCampaign(p => ({ ...p, promoteType: v, promoteTarget: "" }))} options={PROMOTE_TYPES} />
                  </div>

                  {newCampaign.promoteType !== "custom" && (
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">
                        {newCampaign.promoteType === "article" ? "Select article" : newCampaign.promoteType === "post" ? "Post ID" : "Profile handle"}
                      </label>
                      {newCampaign.promoteType === "article" ? (
                        <ArticlePicker value={newCampaign.promoteTarget} onChange={v => setNewCampaign(p => ({ ...p, promoteTarget: v }))} />
                      ) : (
                        <input type="text" value={newCampaign.promoteTarget} onChange={e => setNewCampaign(p => ({ ...p, promoteTarget: e.target.value }))} placeholder={newCampaign.promoteType === "post" ? "Post ID…" : "@handle…"} className="w-full px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                      )}
                    </div>
                  )}

                  {/* Custom creative fields */}
                  {newCampaign.promoteType === "custom" && (
                    <div className="space-y-3 rounded-xl border border-[#e5e5e5] p-3">
                      <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">Ad creative</p>
                      <div>
                        <label className="text-xs font-medium text-[#525252] block mb-1.5">Image</label>
                        <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        {newCampaign.adImage ? (
                          <div className="relative rounded-lg overflow-hidden h-28">
                            <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                            <button onClick={() => setNewCampaign(p => ({ ...p, adImage: "" }))} className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer">
                              <X className="w-3.5 h-3.5 text-white" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => imgInputRef.current?.click()} disabled={uploadingImg} className="w-full h-20 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] flex items-center justify-center gap-2 text-[#a3a3a3] transition-colors cursor-pointer disabled:opacity-50">
                            {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                            <span className="text-xs">{uploadingImg ? "Uploading…" : "Upload image"}</span>
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#525252] block mb-1.5">Headline</label>
                        <textarea value={newCampaign.adHeadline} onChange={e => setNewCampaign(p => ({ ...p, adHeadline: e.target.value }))} placeholder="Compelling ad copy…" rows={2} className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none resize-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-[#525252] block mb-1.5">CTA label</label>
                          <input type="text" value={newCampaign.adCta} onChange={e => setNewCampaign(p => ({ ...p, adCta: e.target.value }))} placeholder="Learn More" className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#525252] block mb-1.5">Link URL</label>
                          <input type="url" value={newCampaign.adCtaUrl} onChange={e => setNewCampaign(p => ({ ...p, adCtaUrl: e.target.value }))} placeholder="https://…" className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                        </div>
                      </div>

                      {/* A/B variant headlines */}
                      {variants.map((v, i) => (
                        <div key={i} className="rounded-xl border border-[#e5e5e5] p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">
                              Variant {String.fromCharCode(66 + i)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setVariants(p => p.filter((_, j) => j !== i))}
                              className="text-[#a3a3a3] hover:text-[#525252] transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[#525252] block mb-1.5">Headline</label>
                            <textarea
                              value={v.headline}
                              onChange={e => setVariants(p => p.map((x, j) => j === i ? { ...x, headline: e.target.value } : x))}
                              placeholder="Alternative ad copy to test…"
                              rows={2}
                              className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none resize-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                            />
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setVariants(p => [...p, { headline: "", image: "", cta: "" }])}
                        className="w-full py-2 rounded-xl border border-dashed border-[#e5e5e5] text-xs text-[#a3a3a3] hover:border-[#d5d5d5] hover:text-[#525252] transition-colors cursor-pointer"
                      >
                        + Add variant
                      </button>
                    </div>
                  )}

                  {/* Placements */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#525252] block">Placements</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PLACEMENTS.map(pl => {
                        const active = newCampaign.placements.includes(pl.key);
                        return (
                          <button key={pl.key} type="button" onClick={() => togglePlacement(pl.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${active ? "bg-[#F44444] text-white border-[#F44444]" : "bg-[#f5f5f5] text-[#525252] border-[#e5e5e5] hover:border-[#d5d5d5]"}`}>
                            {pl.label}
                          </button>
                        );
                      })}
                    </div>
                    {customZones.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] font-medium text-[#a3a3a3] uppercase tracking-wider">Custom zones</p>
                        {customZones.filter(z => z.isActive).map(zone => {
                          const active = customZoneIds.includes(zone.id);
                          return (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => toggleCustomZone(zone.id)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-colors cursor-pointer ${active ? "border-[#F44444] bg-[#FFF5F5] text-[#0a0a0a]" : "border-[#e5e5e5] bg-[#fafafa] text-[#525252] hover:border-[#d5d5d5]"}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${active ? "bg-[#F44444]" : "bg-[#d5d5d5]"}`} />
                                <span className="font-medium truncate">{zone.name}</span>
                              </div>
                              <span className="text-[10px] text-[#a3a3a3] flex-shrink-0 ml-2">{zone.zone}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {newCampaign.placements.length === 0 && customZoneIds.length === 0 && (
                      <p className="text-[10px] text-[#F44444]">Select at least one</p>
                    )}
                  </div>

                  {/* Budget + Dates */}
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Budget</label>
                    <input type="text" value={newCampaign.budget} onChange={e => setNewCampaign(p => ({ ...p, budget: e.target.value }))} placeholder="$5,000" className="w-full px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Start</label>
                      <input type="date" value={newCampaign.startDate} onChange={e => setNewCampaign(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">End</label>
                      <input type="date" value={newCampaign.endDate} onChange={e => setNewCampaign(p => ({ ...p, endDate: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-xs outline-none" />
                    </div>
                  </div>

                  {/* Targeting + pacing — feeds the ranking algorithm */}
                  <div className="space-y-3 rounded-xl border border-[#e5e5e5] p-3">
                    <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">Targeting</p>
                    <div>
                      <FieldLabel help="Who can see this ad. Everyone = all visitors. Members only = logged-in users. Guests only = logged-out visitors. Followers = only users who follow the promoted profile.">Audience</FieldLabel>
                      <Dropdown
                        value={newCampaign.targetAudience}
                        onChange={v => setNewCampaign(p => ({ ...p, targetAudience: v }))}
                        options={[
                          { value: "all", label: "Everyone", description: "Members and guests" },
                          { value: "members", label: "Members only", description: "Logged-in users" },
                          { value: "guests", label: "Guests only", description: "Logged-out visitors" },
                          { value: "followers", label: "Followers of promoted profile", description: "Requires a promoted profile" },
                        ]}
                      />
                    </div>
                    <div>
                      <FieldLabel help="Only show this ad to users in these countries. Use 2-letter codes: US, IN, GB, AE. Leave blank to show in all countries.">Countries</FieldLabel>
                      <input
                        type="text"
                        value={newCampaign.targetCountries.join(", ")}
                        onChange={e => setNewCampaign(p => ({ ...p, targetCountries: e.target.value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) }))}
                        placeholder="US, IN, GB — blank = all"
                        className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                      />
                    </div>
                    <div>
                      <FieldLabel help="Only show to users who have these interests. Tags must match the platform's interest list, e.g. tech, finance, sports. Leave blank to show to everyone regardless of interests.">Interest tags</FieldLabel>
                      <input
                        type="text"
                        value={newCampaign.targetTags.join(", ")}
                        onChange={e => setNewCampaign(p => ({ ...p, targetTags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                        placeholder="tech, finance — blank = all"
                        className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-start">
                      <div>
                        <FieldLabel help="Max times one user sees this per day. 0 = no limit.">Frequency cap</FieldLabel>
                        <input type="number" min="0" value={newCampaign.frequencyCap} onChange={e => setNewCampaign(p => ({ ...p, frequencyCap: e.target.value }))} placeholder="0 = ∞" className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                      </div>
                      <div>
                        <FieldLabel help="0 = normal ranking. 5 ≈ 1.5× score boost. Use for guaranteed placements.">Priority boost</FieldLabel>
                        <input type="number" min="0" value={newCampaign.priority} onChange={e => setNewCampaign(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 items-start">
                      <div>
                        <FieldLabel help="Even = spread across the day. Accelerated = spend as fast as clicks arrive.">Pacing</FieldLabel>
                        <Dropdown
                          value={newCampaign.pacing}
                          onChange={v => setNewCampaign(p => ({ ...p, pacing: v }))}
                          options={[
                            { value: "even", label: "Even", description: "Spread spend across the day" },
                            { value: "accelerated", label: "Accelerated", description: "Spend as fast as clicks arrive" },
                          ]}
                        />
                      </div>
                      <div>
                        <FieldLabel help="Max spend per day. Only applies with Even pacing.">Daily budget</FieldLabel>
                        <input type="text" value={newCampaign.dailyBudget} onChange={e => setNewCampaign(p => ({ ...p, dailyBudget: e.target.value }))} placeholder="Optional" disabled={newCampaign.pacing !== "even"} className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all disabled:opacity-40" />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {createError && <p className="text-xs text-[#F44444]">{createError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleCreate} disabled={creating || (newCampaign.placements.length === 0 && customZoneIds.length === 0) || !newCampaign.name.trim()} className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {creating ? "Creating…" : "Create Campaign"}
                    </button>
                    <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>

                {/* RIGHT: Placement previews */}
                <div className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6 space-y-6">
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">
                    {newCampaign.placements.length === 0 && customZoneIds.length === 0
                      ? "Select placements to see previews"
                      : "Placement previews"}
                  </p>

                  {/* Feed */}
                  {newCampaign.placements.includes("Feed") && (
                    <div>
                      <p className="text-xs font-medium text-[#525252] mb-2">Feed</p>
                      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white max-w-sm shadow-sm">
                        <div className="flex items-stretch gap-4 p-4">
                          <div className="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-[#f5f5f5] relative">
                            {newCampaign.adImage ? (
                              <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <p className="text-[10px] text-[#c5c5c5]">Image</p>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1.5">
                              <span className="text-[10px] text-[#F44444] font-medium">{newCampaign.advertiser || "Brand"}</span>
                              <span className="text-[10px] font-medium text-[#737373] tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#f0f0f0] flex-shrink-0 ml-2">Ad</span>
                            </div>
                            <h3 className="text-sm font-semibold leading-tight text-[#0a0a0a] mb-1.5 line-clamp-2">
                              {newCampaign.adHeadline || "Your ad headline will appear here"}
                            </h3>
                            <button className="px-3 py-1 bg-[#F44444] text-white text-[11px] font-medium rounded-full">
                              {newCampaign.adCta || "Read"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sidebar */}
                  {newCampaign.placements.includes("Sidebar") && (
                    <div>
                      <p className="text-xs font-medium text-[#525252] mb-2">Sidebar</p>
                      <div className="rounded-2xl overflow-hidden relative max-w-[180px] shadow-sm" style={{ height: 280 }}>
                        <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 rounded text-[10px] text-white z-10">Ad</div>
                        {newCampaign.adImage ? (
                          <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#e5e5e5] flex items-center justify-center">
                            <p className="text-[10px] text-[#c5c5c5]">Ad image</p>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10">
                          <span className="text-white font-semibold text-sm block leading-tight">{newCampaign.advertiser || "Brand"}</span>
                          <p className="text-[11px] text-white mt-1 line-clamp-2 leading-tight">{newCampaign.adHeadline || "Your ad headline appears here"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stories */}
                  {newCampaign.placements.includes("Stories") && (
                    <div>
                      <p className="text-xs font-medium text-[#525252] mb-2">Stories</p>
                      <div className="inline-block">
                        <div className="p-[2.5px] rounded-2xl bg-gradient-to-br from-[#F44444] to-[#F44444]/40">
                          <div className="rounded-[14px] overflow-hidden relative bg-[#0a0a0a]" style={{ width: 108, height: 192 }}>
                            {newCampaign.adImage ? (
                              <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <p className="text-[9px] text-white/40">Ad image</p>
                              </div>
                            )}
                            <div className="absolute inset-x-2 top-2 space-y-1.5">
                              <div className="h-0.5 bg-white/40 rounded-full overflow-hidden">
                                <div className="h-full w-1/2 bg-white rounded-full" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[7px] text-white font-bold flex-shrink-0">
                                  {(newCampaign.advertiser || "A").charAt(0)}
                                </div>
                                <span className="text-[8px] text-white font-medium truncate">{newCampaign.advertiser || "Brand"}</span>
                                <span className="text-[8px] text-white/60 ml-auto flex-shrink-0">Ad</span>
                              </div>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent pt-8">
                              <p className="text-[9px] font-semibold text-white leading-tight line-clamp-2 mb-1.5">{newCampaign.adHeadline || "Ad headline"}</p>
                              <button className="w-full py-0.5 rounded-full bg-white text-[8px] font-semibold text-[#0a0a0a]">{newCampaign.adCta || "Learn More"}</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom (top banner) */}
                  {newCampaign.placements.includes("Custom") && (
                    <div>
                      <p className="text-xs font-medium text-[#525252] mb-2">Custom (top banner)</p>
                      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white max-w-sm shadow-sm">
                        <div className="relative h-28 bg-[#f5f5f5]">
                          {newCampaign.adImage ? (
                            <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <p className="text-[10px] text-[#c5c5c5]">Banner image</p>
                            </div>
                          )}
                          <span className="absolute top-2 right-2 text-[10px] font-medium text-[#737373] px-1.5 py-0.5 rounded bg-white/80">Ad</span>
                        </div>
                        <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#0a0a0a] truncate">{newCampaign.adHeadline || "Your headline here"}</p>
                            <p className="text-[10px] text-[#737373]">{newCampaign.advertiser || "Brand"}</p>
                          </div>
                          <button className="flex-shrink-0 px-3 py-1 bg-[#F44444] text-white text-[11px] font-medium rounded-full">
                            {newCampaign.adCta || "Learn More"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom zone previews — one per selected zone */}
                  {customZones
                    .filter(z => customZoneIds.includes(z.id))
                    .map(zone => (
                      <div key={zone.id}>
                        <p className="text-xs font-medium text-[#525252] mb-2">{zone.name}</p>

                        {/* Overlay / Popup */}
                        {zone.zone === "overlay" && (
                          <div className="relative rounded-xl overflow-hidden bg-[#1a1a1a]/60 max-w-sm" style={{ height: 220 }}>
                            <div className="absolute inset-0 flex items-center justify-center p-4">
                              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full">
                                <div className="relative h-24 bg-[#f5f5f5]">
                                  {newCampaign.adImage ? (
                                    <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <p className="text-[10px] text-[#c5c5c5]">Ad image</p>
                                    </div>
                                  )}
                                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/35 backdrop-blur-sm">
                                    <span className="text-[8px] text-white/80 font-medium">Sponsored</span>
                                  </div>
                                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/40 flex items-center justify-center">
                                    <X className="w-2.5 h-2.5 text-white" />
                                  </div>
                                </div>
                                <div className="px-3 py-2.5">
                                  <p className="text-[10px] font-semibold text-[#0a0a0a] leading-tight truncate mb-1">{newCampaign.adHeadline || "Your ad headline"}</p>
                                  <p className="text-[9px] text-[#737373] mb-2">{newCampaign.advertiser || "Brand"}</p>
                                  <button className="w-full py-1 rounded-full bg-[#F44444] text-white text-[9px] font-medium">{newCampaign.adCta || "Learn More"}</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Header banner */}
                        {zone.zone === "header" && (
                          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white max-w-sm shadow-sm">
                            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#f0f0f0]">
                              <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-[#f5f5f5] flex-shrink-0">
                                {newCampaign.adImage ? (
                                  <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <p className="text-[8px] text-[#c5c5c5]">Img</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-[#0a0a0a] truncate">{newCampaign.adHeadline || "Your headline"}</p>
                                <p className="text-[9px] text-[#a3a3a3]">{newCampaign.advertiser || "Brand"} · Ad</p>
                              </div>
                              <button className="flex-shrink-0 px-2.5 py-1 bg-[#F44444] text-white text-[9px] font-medium rounded-full">{newCampaign.adCta || "Learn More"}</button>
                            </div>
                          </div>
                        )}

                        {/* Footer banner */}
                        {zone.zone === "footer" && (
                          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white max-w-sm shadow-sm">
                            <div className="flex items-center gap-3 px-3 py-2.5 border-t border-[#f0f0f0]">
                              <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-[#f5f5f5] flex-shrink-0">
                                {newCampaign.adImage ? (
                                  <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <p className="text-[8px] text-[#c5c5c5]">Img</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-[#0a0a0a] truncate">{newCampaign.adHeadline || "Your headline"}</p>
                                <p className="text-[9px] text-[#a3a3a3]">{newCampaign.advertiser || "Brand"} · Ad</p>
                              </div>
                              <button className="flex-shrink-0 px-2.5 py-1 bg-[#F44444] text-white text-[9px] font-medium rounded-full">{newCampaign.adCta || "Learn More"}</button>
                            </div>
                          </div>
                        )}

                        {/* Body inline card */}
                        {zone.zone === "body" && (
                          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white max-w-sm shadow-sm">
                            <div className="relative h-24 bg-[#f5f5f5]">
                              {newCampaign.adImage ? (
                                <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <p className="text-[10px] text-[#c5c5c5]">Ad image</p>
                                </div>
                              )}
                              <span className="absolute top-2 right-2 text-[9px] font-medium text-[#737373] px-1.5 py-0.5 rounded bg-white/80">Ad</span>
                            </div>
                            <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-[#0a0a0a] truncate">{newCampaign.adHeadline || "Your headline"}</p>
                                <p className="text-[10px] text-[#737373]">{newCampaign.advertiser || "Brand"}</p>
                              </div>
                              <button className="flex-shrink-0 px-2.5 py-1 bg-[#F44444] text-white text-[10px] font-medium rounded-full">{newCampaign.adCta || "Learn More"}</button>
                            </div>
                          </div>
                        )}

                        {/* Sidebar card */}
                        {zone.zone === "sidebar" && (
                          <div className="rounded-xl overflow-hidden relative max-w-[160px] shadow-sm" style={{ height: 240 }}>
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/50 rounded text-[9px] text-white z-10">Ad</div>
                            {newCampaign.adImage ? (
                              <Image src={newCampaign.adImage} alt="" fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full bg-[#e5e5e5] flex items-center justify-center">
                                <p className="text-[10px] text-[#c5c5c5]">Ad image</p>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8">
                              <span className="text-white font-semibold text-xs block leading-tight">{newCampaign.advertiser || "Brand"}</span>
                              <p className="text-[10px] text-white mt-0.5 line-clamp-2 leading-tight">{newCampaign.adHeadline || "Your ad headline"}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                  {newCampaign.placements.length === 0 && customZoneIds.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-[#e5e5e5] flex items-center justify-center py-16">
                      <p className="text-sm text-[#c5c5c5]">No placements selected</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

type AdStats = {
  stats: { label: string; value: string; change: number; up: boolean; sparkline: number[] }[];
  revenueOverTime: { date: string; value: number }[];
  placementPerformance: { placement: string; impressions: string; clicks: string; ctr: string; revenue: string }[];
};

function useAdStats(range = "all", granularity = "month") {
  const [stats, setStats] = useState<AdStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setStats(null);
    fetch(`/api/admin/ads/stats?range=${range}&granularity=${granularity}`)
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range, granularity]);
  return { stats, loading };
}

function useCampaigns() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  useEffect(() => {
    fetch("/api/admin/ads").then(r => r.ok ? r.json() : []).then((d) => setCampaigns(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  return campaigns;
}

function PerformanceTab() {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const { stats, loading: statsLoading } = useAdStats(range);
  const campaigns = useCampaigns();
  const [perfSort, setPerfSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "impressions", dir: "desc" });

  const placementPerformance = stats?.placementPerformance ?? [];
  const maxCtr = Math.max(0.001, ...placementPerformance.map(p => parseFloat(p.ctr)));

  const comparable = campaigns.filter(c => c.status !== "scheduled" && c.status !== "draft");

  const topCtr  = [...comparable].sort((a, b) => parseFloat(b.ctr) - parseFloat(a.ctr))[0];
  const topImpr = [...comparable].sort((a, b) => (b.impressionsRaw ?? 0) - (a.impressionsRaw ?? 0))[0];
  const topRev  = [...comparable].sort((a, b) => b.spentRaw - a.spentRaw)[0];

  const toggleSort = (col: string) =>
    setPerfSort(prev => prev.col === col
      ? { col, dir: prev.dir === "desc" ? "asc" : "desc" }
      : { col, dir: "desc" });

  const sortedCampaigns = [...comparable].sort((a, b) => {
    const d = perfSort.dir === "asc" ? 1 : -1;
    if (perfSort.col === "impressions") return d * ((a.impressionsRaw ?? 0) - (b.impressionsRaw ?? 0));
    if (perfSort.col === "clicks")      return d * ((a.clicksRaw ?? 0) - (b.clicksRaw ?? 0));
    if (perfSort.col === "ctr")         return d * (parseFloat(a.ctr) - parseFloat(b.ctr));
    if (perfSort.col === "revenue")     return d * (a.spentRaw - b.spentRaw);
    return 0;
  });

  const SORT_COLS = [
    { key: "impressions", label: "Impressions" },
    { key: "clicks",      label: "Clicks" },
    { key: "ctr",         label: "CTR" },
    { key: "revenue",     label: "Revenue" },
  ];

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex items-center gap-1 bg-[#f5f5f5] p-1 rounded-xl w-fit">
        {(["7d", "30d", "90d", "all"] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${range === r ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#737373] hover:text-[#525252]"}`}
          >
            {r === "all" ? "All time" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white h-24 animate-pulse" />
            ))
          : (stats?.stats ?? []).map(s => <AdminStatCard key={s.label} {...s} />)}
      </div>

      {/* Top performer callout */}
      {comparable.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {topCtr && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
              <p className="text-[10px] text-[#a3a3a3] mb-1.5">Best CTR</p>
              <p className="text-sm font-medium text-[#0a0a0a] truncate">{topCtr.name}</p>
              <p className="text-xl font-bold text-[#F44444] mt-0.5">{topCtr.ctr}</p>
            </div>
          )}
          {topImpr && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
              <p className="text-[10px] text-[#a3a3a3] mb-1.5">Most impressions</p>
              <p className="text-sm font-medium text-[#0a0a0a] truncate">{topImpr.name}</p>
              <p className="text-xl font-bold text-[#0a0a0a] mt-0.5">{topImpr.impressions}</p>
            </div>
          )}
          {topRev && topRev.spentRaw > 0 && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
              <p className="text-[10px] text-[#a3a3a3] mb-1.5">Most revenue</p>
              <p className="text-sm font-medium text-[#0a0a0a] truncate">{topRev.name}</p>
              <p className="text-xl font-bold text-[#22c55e] mt-0.5">{topRev.spent}</p>
            </div>
          )}
        </div>
      )}

      {/* Placement performance with CTR bars */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Placement performance</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#737373]">Placement</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">Impressions</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">Clicks</th>
                <th className="px-5 py-3 text-xs font-medium text-[#737373]">CTR</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {placementPerformance.map(p => {
                const barPct = (parseFloat(p.ctr) / maxCtr) * 100;
                return (
                  <tr key={p.placement} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-[#0a0a0a]">{p.placement}</td>
                    <td className="px-5 py-3.5 text-sm text-[#0a0a0a] text-right">{p.impressions}</td>
                    <td className="px-5 py-3.5 text-sm text-[#0a0a0a] text-right">{p.clicks}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-1 bg-[#f5f5f5] rounded-full overflow-hidden">
                          <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="text-sm font-medium text-[#F44444] w-12 text-right flex-shrink-0">{p.ctr}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-[#22c55e] text-right">{p.revenue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sortable campaign comparison */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Campaign comparison</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#737373]">Campaign</th>
                {SORT_COLS.map(col => (
                  <th key={col.key} className="text-right px-5 py-3">
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={`text-xs font-medium flex items-center gap-1 ml-auto cursor-pointer transition-colors ${perfSort.col === col.key ? "text-[#0a0a0a]" : "text-[#737373] hover:text-[#525252]"}`}
                    >
                      {col.label}
                      <span className="text-[10px] w-2.5 text-right">
                        {perfSort.col === col.key ? (perfSort.dir === "desc" ? "↓" : "↑") : ""}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCampaigns.map(c => {
                const ctrNum = parseFloat(c.ctr);
                return (
                  <tr key={c.id} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-[#0a0a0a]">{c.name}</p>
                      <p className="text-xs text-[#737373]">{c.advertiser}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#0a0a0a] text-right">{c.impressions}</td>
                    <td className="px-5 py-3.5 text-sm text-[#0a0a0a] text-right">{c.clicks}</td>
                    <td className={`px-5 py-3.5 text-sm font-medium text-right ${ctrNum > 3.3 ? "text-[#22c55e]" : ctrNum > 2.8 ? "text-[#F59E0B]" : "text-[#F44444]"}`}>{c.ctr}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-[#0a0a0a] text-right">{c.spent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RevenueTab() {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const granularity = range === "7d" || range === "30d" ? "day" : range === "90d" ? "week" : "month";
  const { stats } = useAdStats(range, granularity);
  const campaigns = useCampaigns();
  const revenueOverTime = stats?.revenueOverTime ?? [];
  const placementPerformance = stats?.placementPerformance ?? [];

  // Projected remaining revenue across all active campaigns
  const activeCampaigns = campaigns.filter(c => c.status === "active");
  const projectedRemaining = activeCampaigns.reduce((sum, c) => sum + Math.max(0, c.budgetRaw - c.spentRaw), 0);
  const totalEarned = campaigns.reduce((sum, c) => sum + c.spentRaw, 0);

  // Advertiser breakdown
  const byAdvertiser = Object.values(
    campaigns.reduce((acc, c) => {
      const k = c.advertiser;
      if (!acc[k]) acc[k] = { advertiser: k, spent: 0, budget: 0, campaigns: 0, active: 0 };
      acc[k].spent += c.spentRaw;
      acc[k].budget += c.budgetRaw;
      acc[k].campaigns += 1;
      if (c.status === "active") acc[k].active += 1;
      return acc;
    }, {} as Record<string, { advertiser: string; spent: number; budget: number; campaigns: number; active: number }>)
  ).sort((a, b) => b.spent - a.spent);

  const exportCSV = () => {
    const header = ["Campaign", "Advertiser", "Status", "Budget", "Spent", "Impressions", "Clicks", "CTR", "Start", "End"];
    const rows = campaigns.map(c => [
      `"${c.name}"`, `"${c.advertiser}"`, c.status, c.budget, c.spent,
      c.impressions, c.clicks, c.ctr, c.startDate, c.endDate,
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "ad-revenue.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

  return (
    <div className="space-y-4">
      {/* Range + export */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#f5f5f5] p-1 rounded-xl">
          {(["7d", "30d", "90d", "all"] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${range === r ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#737373] hover:text-[#525252]"}`}
            >
              {r === "all" ? "All time" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#e5e5e5] text-sm text-[#525252] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
        >
          <TrendingUp className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(stats?.stats ?? []).map(s => <AdminStatCard key={s.label} {...s} />)}
      </div>

      {/* Projected revenue */}
      {(totalEarned > 0 || projectedRemaining > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <p className="text-xs text-[#a3a3a3] mb-1">Earned to date</p>
            <p className="text-2xl font-bold text-[#22c55e]">{fmt(totalEarned)}</p>
            <p className="text-xs text-[#737373] mt-1">across {campaigns.filter(c => c.spentRaw > 0).length} campaigns</p>
          </div>
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <p className="text-xs text-[#a3a3a3] mb-1">Committed remaining</p>
            <p className="text-2xl font-bold text-[#0a0a0a]">{fmt(projectedRemaining)}</p>
            <p className="text-xs text-[#737373] mt-1">from {activeCampaigns.length} active {activeCampaigns.length === 1 ? "campaign" : "campaigns"}</p>
          </div>
        </div>
      )}

      {/* Revenue chart */}
      <AdminChart data={revenueOverTime} title="Revenue over time" color="#22c55e" />

      {/* By placement + by campaign */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">By placement</span>
          {placementPerformance.length === 0 && (
            <p className="text-xs text-[#a3a3a3] py-4 text-center">No data for this period</p>
          )}
          {placementPerformance.map(p => {
            const rev = parseFloat(p.revenue.replace(/[$,]/g, ""));
            const totalRev = placementPerformance.reduce((sum, pl) => sum + parseFloat(pl.revenue.replace(/[$,]/g, "")), 0) || 1;
            const pct = Math.round((rev / totalRev) * 100);
            return (
              <div key={p.placement} className="flex items-center gap-3 py-2.5">
                <span className="text-sm text-[#0a0a0a] w-20 flex-shrink-0">{p.placement}</span>
                <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium text-[#22c55e] w-20 text-right flex-shrink-0">{p.revenue}</span>
                <span className="text-xs text-[#737373] w-8 text-right flex-shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">By campaign</span>
          {campaigns.filter(c => c.spentRaw > 0).length === 0 && (
            <p className="text-xs text-[#a3a3a3] py-4 text-center">No spending recorded yet</p>
          )}
          {campaigns.filter(c => c.spentRaw > 0)
            .sort((a, b) => b.spentRaw - a.spentRaw)
            .map(c => {
              const utilPct = c.budgetRaw > 0 ? Math.min(100, (c.spentRaw / c.budgetRaw) * 100) : 0;
              return (
                <div key={c.id} className="py-2.5 border-b border-[#f0f0f0] last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0">
                      <p className="text-sm text-[#0a0a0a] truncate">{c.name}</p>
                      <span className="text-xs text-[#737373]">{c.advertiser}</span>
                    </div>
                    <span className="text-sm font-medium text-[#0a0a0a] flex-shrink-0 ml-4">{c.spent}</span>
                  </div>
                  {c.budgetRaw > 0 && (
                    <div className="h-1 bg-[#f5f5f5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${utilPct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Advertiser breakdown */}
      {byAdvertiser.length > 0 && (
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">By advertiser</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#737373]">Advertiser</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">Campaigns</th>
                  <th className="px-5 py-3 text-xs font-medium text-[#737373]">Budget utilization</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">Total spent</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {byAdvertiser.map(row => {
                  const utilPct = row.budget > 0 ? Math.min(100, (row.spent / row.budget) * 100) : 0;
                  return (
                    <tr key={row.advertiser} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-[#0a0a0a]">{row.advertiser}</p>
                        {row.active > 0 && (
                          <span className="text-[10px] text-[#22c55e] font-medium">{row.active} active</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#0a0a0a] text-right">{row.campaigns}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                            <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${utilPct}%` }} />
                          </div>
                          <span className="text-xs text-[#737373] w-8 text-right flex-shrink-0">{Math.round(utilPct)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-[#22c55e] text-right">{fmt(row.spent)}</td>
                      <td className="px-5 py-3.5 text-sm text-[#737373] text-right">{fmt(Math.max(0, row.budget - row.spent))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigurationTab() {
  const [settings, setSettings] = useState({
    maxAdsPerPage: "3",
    feedAdFrequency: "5",
    sidebarEnabled: true,
    storiesEnabled: true,
    autoApprove: false,
    minBudget: "500",
    defaultCpc: "0.35",
    maxCpcBid: "5.00",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ads/settings").then(r => r.ok ? r.json() : null).then((d) => {
      if (!d) return;
      setSettings({
        maxAdsPerPage: String(d.maxAdsPerPage),
        feedAdFrequency: String(d.feedAdFrequency),
        sidebarEnabled: !!d.sidebarEnabled,
        storiesEnabled: !!d.storiesEnabled,
        autoApprove: !!d.autoApprove,
        minBudget: String(d.minBudget),
        defaultCpc: String(d.defaultCpc),
        maxCpcBid: String(d.maxCpcBid),
      });
    }).catch(() => {});
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/ads/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Ad display settings</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Max ads per page</p>
              <span className="text-xs text-[#737373]">Maximum number of ads shown on any single page</span>
            </div>
            <input type="number" value={settings.maxAdsPerPage} onChange={e => setSettings(p => ({ ...p, maxAdsPerPage: e.target.value }))} className="w-20 px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-center outline-none focus:ring-2 focus:ring-[#F44444]/20" />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Feed ad frequency</p>
              <span className="text-xs text-[#737373]">Show one ad every N posts in the feed</span>
            </div>
            <input type="number" value={settings.feedAdFrequency} onChange={e => setSettings(p => ({ ...p, feedAdFrequency: e.target.value }))} className="w-20 px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-center outline-none focus:ring-2 focus:ring-[#F44444]/20" />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Sidebar ads</p>
              <span className="text-xs text-[#737373]">Enable advertisements in the right sidebar</span>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, sidebarEnabled: !p.sidebarEnabled }))} className={`w-12 h-7 rounded-full transition-colors relative ${settings.sidebarEnabled ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}>
              <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${settings.sidebarEnabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Stories ads</p>
              <span className="text-xs text-[#737373]">Enable advertisements in stories</span>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, storiesEnabled: !p.storiesEnabled }))} className={`w-12 h-7 rounded-full transition-colors relative ${settings.storiesEnabled ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}>
              <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${settings.storiesEnabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Campaign settings</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Auto-approve campaigns</p>
              <span className="text-xs text-[#737373]">Automatically approve new campaigns without review</span>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, autoApprove: !p.autoApprove }))} className={`w-12 h-7 rounded-full transition-colors relative ${settings.autoApprove ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}>
              <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${settings.autoApprove ? "left-6" : "left-1"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Minimum budget</p>
              <span className="text-xs text-[#737373]">Minimum campaign budget allowed</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[#737373]">$</span>
              <input type="text" value={settings.minBudget} onChange={e => setSettings(p => ({ ...p, minBudget: e.target.value }))} className="w-20 px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-center outline-none focus:ring-2 focus:ring-[#F44444]/20" />
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Default CPC</p>
              <span className="text-xs text-[#737373]">Default cost per click for new campaigns</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[#737373]">$</span>
              <input type="text" value={settings.defaultCpc} onChange={e => setSettings(p => ({ ...p, defaultCpc: e.target.value }))} className="w-20 px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-center outline-none focus:ring-2 focus:ring-[#F44444]/20" />
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm text-[#0a0a0a]">Maximum CPC bid</p>
              <span className="text-xs text-[#737373]">Maximum allowed cost per click bid</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-[#737373]">$</span>
              <input type="text" value={settings.maxCpcBid} onChange={e => setSettings(p => ({ ...p, maxCpcBid: e.target.value }))} className="w-20 px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-center outline-none focus:ring-2 focus:ring-[#F44444]/20" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Ad placements</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { name: "Feed", desc: "Between posts in the main feed", enabled: true },
              { name: "Sidebar", desc: "Right sidebar ad card slot", enabled: settings.sidebarEnabled },
              { name: "Stories", desc: "In the stories row", enabled: settings.storiesEnabled },
              { name: "Custom", desc: "Top banner above the feed", enabled: true },
            ].map(p => (
              <div key={p.name} className={`rounded-xl border p-4 ${p.enabled ? "border-[#F44444]/30 bg-[#FFF8F8]" : "border-[#e5e5e5] bg-[#fafafa]"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Target className={`w-4 h-4 ${p.enabled ? "text-[#F44444]" : "text-[#a3a3a3]"}`} />
                  <span className={`text-sm font-medium ${p.enabled ? "text-[#0a0a0a]" : "text-[#737373]"}`}>{p.name}</span>
                </div>
                <p className="text-xs text-[#737373]">{p.desc}</p>
                <span className={`text-[10px] font-semibold mt-2 inline-block px-2 py-0.5 rounded-full ${p.enabled ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#f5f5f5] text-[#a3a3a3]"}`}>
                  {p.enabled ? "Active" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={saveConfig} disabled={saving} className="px-5 py-2.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saved ? "Saved" : saving ? "Saving…" : "Save Configuration"}
      </button>
    </div>
  );
}

const DEFAULT_ALGORITHM = {
  bidWeight: 0.4,
  relevanceWeight: 0.4,
  recencyWeight: 0.2,
  ctrInfluence: 0.5,
  pacingStrictness: 0.5,
  minRelevance: 0,
  defaultFrequencyCap: 0,
  diversity: true,
};
type Algorithm = typeof DEFAULT_ALGORITHM;

// Mirror of the base ranking math in app/lib/ads-algorithm.ts, used only to
// preview how live campaigns would rank as the weights change. Relevance is
// assumed average (0.5) here since it depends on the individual viewer.
function previewScore(c: AdCampaign, w: Algorithm, maxCpc: number, now: number): number {
  const bidFactor = maxCpc > 0 ? Math.min(1, (c.cpcRaw ?? 0) / maxCpc) : 0;
  const ageHours = c.createdAtRaw ? Math.max((now - new Date(c.createdAtRaw).getTime()) / 3_600_000, 0) : 0;
  const recency = Math.pow(0.5, ageHours / (14 * 24));
  const base = w.bidWeight * bidFactor + w.relevanceWeight * 0.5 + w.recencyWeight * recency;
  const ctr = parseFloat(c.ctr) / 100 || 0;
  const ctrRatio = Math.min(2, ((c.clicksRaw ?? 0) + 1) / ((c.impressionsRaw ?? 0) + 20) / 0.05);
  void ctr;
  const ctrMult = 1 + w.ctrInfluence * (ctrRatio - 1);
  const priorityMult = 1 + Math.max(0, c.priority ?? 0) * 0.1;
  return base * ctrMult * priorityMult;
}

function InlineHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={() => setOpen(p => !p)}
        className={`w-4 h-4 rounded-full border transition-colors flex items-center justify-center text-[9px] font-bold leading-none cursor-pointer flex-shrink-0 ${open ? "border-[#0a0a0a] text-[#0a0a0a]" : "border-[#d5d5d5] text-[#a3a3a3] hover:border-[#a3a3a3] hover:text-[#525252]"}`}>?</button>
      {open && (
        <span className="mt-1.5 px-2.5 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[11px] text-[#525252] leading-relaxed shadow-sm block w-56">
          {text}
        </span>
      )}
    </span>
  );
}

function FreqCapHelp() {
  return <InlineHelp text="Applied to any campaign that did not set its own cap. If a campaign sets cap=3 it uses 3; if it sets nothing, this default applies. 0 means unlimited." />;
}

function DiversityHelp() {
  return <InlineHelp text="When on, the same brand cannot appear in two consecutive ad slots. If Nike is in slot 1, the next slot will be a different advertiser — even if Nike has the highest score." />;
}

function AlgorithmSlider({ label, desc, help, value, min, max, step, onChange, format }: {
  label: string; desc: string; help?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-[#0a0a0a]">{label}</p>
          {help && (
            <button type="button" onClick={() => setOpen(p => !p)}
              className={`w-4 h-4 rounded-full border transition-colors flex items-center justify-center text-[9px] font-bold leading-none cursor-pointer flex-shrink-0 ${open ? "border-[#0a0a0a] text-[#0a0a0a]" : "border-[#d5d5d5] text-[#a3a3a3] hover:border-[#a3a3a3] hover:text-[#525252]"}`}>?</button>
          )}
        </div>
        <span className="text-sm font-medium text-[#F44444] tabular-nums">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <span className="text-xs text-[#737373]">{desc}</span>
      {open && help && (
        <div className="mt-1.5 px-2.5 py-2 bg-white border border-[#e5e5e5] rounded-lg text-[11px] text-[#525252] leading-relaxed shadow-sm">
          {help}
        </div>
      )}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#F44444] cursor-pointer mt-2"
      />
    </div>
  );
}

function AlgorithmTab() {
  const [algo, setAlgo] = useState<Algorithm>(DEFAULT_ALGORITHM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const campaigns = useCampaigns();

  useEffect(() => {
    fetch("/api/admin/ads/algorithm").then(r => r.ok ? r.json() : null).then((d) => {
      if (d) setAlgo({ ...DEFAULT_ALGORITHM, ...d });
    }).catch(() => {});
  }, []);

  const set = (k: keyof Algorithm, v: number | boolean) => setAlgo(p => ({ ...p, [k]: v }));

  // Keep the three ranking weights readable as a 0–1 mix (they're relative).
  const weightSum = algo.bidWeight + algo.relevanceWeight + algo.recencyWeight || 1;

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/admin/ads/algorithm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(algo),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally { setSaving(false); }
  };

  const active = campaigns.filter(c => c.status === "active" || c.status === "paused");
  const maxCpc = Math.max(0.01, ...active.map(c => c.cpcRaw ?? 0));
  const now = Date.now();
  const ranked = [...active]
    .map(c => ({ c, score: previewScore(c, algo, maxCpc, now) }))
    .sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score || 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#737373]">
        Tune how the ad server ranks eligible campaigns. Every active ad is scored by a blend of bid, viewer
        relevance, freshness and proven click-through; the highest scores serve first.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weights */}
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">Ranking weights</span>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            <AlgorithmSlider label="Bid" desc="Higher CPC bids rank higher" help="Campaigns that pay more per click score higher. Raise this to maximise revenue. Lower it to let relevance and freshness matter more than who is paying the most." value={algo.bidWeight} min={0} max={1} step={0.05}
              onChange={v => set("bidWeight", v)} format={v => `${Math.round((v / weightSum) * 100)}%`} />
            <AlgorithmSlider label="Relevance" desc="Match to the viewer's country & interests" help="Ads that match the viewer's interests and country score higher. Raise this to show users more personally relevant ads even if those campaigns bid less." value={algo.relevanceWeight} min={0} max={1} step={0.05}
              onChange={v => set("relevanceWeight", v)} format={v => `${Math.round((v / weightSum) * 100)}%`} />
            <AlgorithmSlider label="Freshness" desc="Newer campaigns get a temporary lift" help="Newer campaigns get a short-lived score boost so they can compete against older campaigns that have built up click history. Fades out over two weeks." value={algo.recencyWeight} min={0} max={1} step={0.05}
              onChange={v => set("recencyWeight", v)} format={v => `${Math.round((v / weightSum) * 100)}%`} />
            <AlgorithmSlider label="CTR influence" desc="How strongly proven click-through boosts an ad" help="When one A/B variant is getting clicked more than the other, this controls how quickly the system shifts traffic toward it. At 0 all variants get equal exposure. At 1 the winner takes most traffic very fast." value={algo.ctrInfluence} min={0} max={1} step={0.05}
              onChange={v => set("ctrInfluence", v)} />
          </div>
        </div>

        {/* Guards */}
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">Delivery guards</span>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            <AlgorithmSlider label="Pacing strictness" desc="0 ignores daily budgets, 1 throttles hard when ahead of pace" help="When a campaign is spending faster than its daily budget allows, this throttles its ranking score to slow it down. At 0 pacing is ignored entirely. At 1 an overspending campaign gets heavily penalised until it falls back on track." value={algo.pacingStrictness} min={0} max={1} step={0.05}
              onChange={v => set("pacingStrictness", v)} />
            <AlgorithmSlider label="Minimum relevance" desc="Drop ads below this relevance to the viewer (0 = off)" help="A hard floor. Any ad whose relevance score falls below this threshold is dropped entirely and will not show — regardless of how much it bids. Set to 0 to disable and allow all ads through." value={algo.minRelevance} min={0} max={1} step={0.05}
              onChange={v => set("minRelevance", v)} />
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-[#0a0a0a]">Default frequency cap</p>
                  <FreqCapHelp />
                </div>
                <input type="number" min="0" value={algo.defaultFrequencyCap}
                  onChange={e => set("defaultFrequencyCap", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-20 px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-center outline-none focus:ring-2 focus:ring-[#F44444]/20" />
              </div>
              <span className="text-xs text-[#737373]">Per-user daily cap when a campaign sets none (0 = unlimited)</span>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-[#0a0a0a]">Advertiser diversity</p>
                  <DiversityHelp />
                </div>
                <button onClick={() => set("diversity", !algo.diversity)} className={`w-12 h-7 rounded-full transition-colors relative ${algo.diversity ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}>
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${algo.diversity ? "left-6" : "left-1"}`} />
                </button>
              </div>
              <span className="text-xs text-[#737373]">Avoid showing the same advertiser back-to-back</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live ranking preview */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0a0a0a]">Ranking preview</span>
          <span className="text-xs text-[#737373]">{active.length} eligible · relevance assumed average</span>
        </div>
        {ranked.length === 0 ? (
          <p className="text-sm text-[#737373] py-10 text-center">No active campaigns to rank.</p>
        ) : (
          <div className="divide-y divide-[#f0f0f0]">
            {ranked.map(({ c, score }, i) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-xs font-semibold text-[#a3a3a3] w-5 text-right tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{c.name}</p>
                  <p className="text-xs text-[#737373]">{c.advertiser} · {c.cpc} CPC · {c.ctr} CTR{c.priority ? ` · +${c.priority} priority` : ""}</p>
                </div>
                <div className="w-40 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${Math.max(4, (score / topScore) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[#0a0a0a] w-10 text-right tabular-nums">{score.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saved ? "Saved" : saving ? "Saving…" : "Save Algorithm"}
      </button>
    </div>
  );
}

// ─── Placement Zone Components ────────────────────────────────────────────────

function SortableZoneRow({
  zone,
  onToggle,
  onDelete,
}: {
  zone: PlacementZone;
  onToggle: (z: PlacementZone) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zone.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const zoneColor: Record<string, string> = {
    header: "#6366f1",
    sidebar: "#f59e0b",
    body: "#22c55e",
    footer: "#64748b",
    overlay: "#ec4899",
  };
  const color = zoneColor[zone.zone] ?? "#a3a3a3";

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3">
      <button
        {...attributes}
        {...listeners}
        className="text-[#d5d5d5] hover:text-[#a3a3a3] cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#0a0a0a] truncate">{zone.name}</p>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {zone.zone}
          </span>
        </div>
        <p className="text-xs text-[#a3a3a3] mt-0.5 font-mono truncate">{zone.key}</p>
      </div>
      {zone.description && (
        <p className="text-xs text-[#737373] hidden lg:block max-w-[180px] truncate flex-shrink-0">
          {zone.description}
        </p>
      )}
      <button
        onClick={() => onToggle(zone)}
        className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${zone.isActive ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm ${zone.isActive ? "left-5" : "left-1"}`}
        />
      </button>
      <button
        onClick={() => onDelete(zone.id)}
        className="text-[#d5d5d5] hover:text-[#F44444] transition-colors flex-shrink-0 cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function PageLayoutPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const zones = [
    { key: "header", label: "Header" },
    { key: "body", label: "Body" },
    { key: "sidebar", label: "Sidebar" },
    { key: "footer", label: "Footer" },
  ];

  return (
    <div className="space-y-2">
      {/* Wireframe grid */}
      <div
        className="rounded-xl border border-[#e5e5e5] overflow-hidden"
        style={{ display: "grid", gridTemplateColumns: "1fr 80px", gridTemplateRows: "44px 100px 44px", gap: 1, background: "#e5e5e5" }}
      >
        {/* Header — full width */}
        <button
          type="button"
          onClick={() => onChange("header")}
          style={{ gridColumn: "1 / -1" }}
          className={`text-xs font-medium transition-colors ${value === "header" ? "bg-[#F44444] text-white" : "bg-white text-[#a3a3a3] hover:bg-[#fafafa]"}`}
        >
          Header
        </button>
        {/* Body */}
        <button
          type="button"
          onClick={() => onChange("body")}
          className={`text-xs font-medium transition-colors ${value === "body" ? "bg-[#F44444] text-white" : "bg-white text-[#a3a3a3] hover:bg-[#fafafa]"}`}
        >
          Body
        </button>
        {/* Sidebar */}
        <button
          type="button"
          onClick={() => onChange("sidebar")}
          className={`text-xs font-medium transition-colors ${value === "sidebar" ? "bg-[#F44444] text-white" : "bg-white text-[#a3a3a3] hover:bg-[#fafafa]"}`}
        >
          Sidebar
        </button>
        {/* Footer — full width */}
        <button
          type="button"
          onClick={() => onChange("footer")}
          style={{ gridColumn: "1 / -1" }}
          className={`text-xs font-medium transition-colors ${value === "footer" ? "bg-[#F44444] text-white" : "bg-white text-[#a3a3a3] hover:bg-[#fafafa]"}`}
        >
          Footer
        </button>
      </div>
      {/* Overlay as a separate pill */}
      <button
        type="button"
        onClick={() => onChange("overlay")}
        className={`w-full py-2 rounded-xl border text-xs font-medium transition-colors ${value === "overlay" ? "bg-[#F44444] text-white border-[#F44444]" : "border-[#e5e5e5] text-[#a3a3a3] bg-white hover:border-[#d5d5d5]"}`}
      >
        Overlay / Popup
      </button>
    </div>
  );
}

function PlacementZoneCreator({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (z: PlacementZone) => void;
}) {
  const emptyZoneForm = { name: "", key: "", description: "", zone: "body", width: "", height: "" };
  const [form, setForm] = useState(emptyZoneForm);
  const [keyEdited, setKeyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toKey(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  const handleNameChange = (name: string) => {
    setForm(p => ({ ...p, name, key: keyEdited ? p.key : toKey(name) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.key.trim()) { setError("Key is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ads/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          width: form.width ? parseInt(form.width) : null,
          height: form.height ? parseInt(form.height) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Failed to create"); return; }
      onCreated(data);
      setForm(emptyZoneForm);
      setKeyEdited(false);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-[151] w-full max-w-2xl bg-white shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5] flex-shrink-0">
              <span className="text-sm font-semibold text-[#0a0a0a]">New Placement Zone</span>
              <button onClick={onClose} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors cursor-pointer">
                <X className="w-4 h-4 text-[#737373]" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* LEFT: Form */}
              <div className="w-64 flex-shrink-0 border-r border-[#e5e5e5] overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g., Homepage Banner"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Key</label>
                  <input
                    type="text"
                    value={form.key}
                    onChange={e => { setKeyEdited(true); setForm(p => ({ ...p, key: e.target.value })); }}
                    placeholder="homepage_banner"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                  />
                  <p className="text-[10px] text-[#a3a3a3] mt-1">Used to serve ads at this position in code</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Where does this ad appear?"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none resize-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Width (px)</label>
                    <input
                      type="number"
                      value={form.width}
                      onChange={e => setForm(p => ({ ...p, width: e.target.value }))}
                      placeholder="auto"
                      className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-1.5">Height (px)</label>
                    <input
                      type="number"
                      value={form.height}
                      onChange={e => setForm(p => ({ ...p, height: e.target.value }))}
                      placeholder="auto"
                      className="w-full px-3 py-2 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-[#F44444]">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? "Saving…" : "Create Zone"}
                  </button>
                  <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>

              {/* RIGHT: Visual zone picker */}
              <div className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6 space-y-4">
                <p className="text-xs font-medium text-[#525252]">Page position</p>
                <PageLayoutPicker value={form.zone} onChange={z => setForm(p => ({ ...p, zone: z }))} />
                <p className="text-[10px] text-[#a3a3a3] leading-relaxed">
                  Select where this zone appears in the page layout. Reference the key in your component to serve ads at this position.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PlacementsTab() {
  const [zones, setZones] = useState<PlacementZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/ads/placements")
      .then(r => r.ok ? r.json() : [])
      .then((data: PlacementZone[]) => setZones(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = zones.findIndex(z => z.id === active.id);
    const newIndex = zones.findIndex(z => z.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(zones, oldIndex, newIndex);
    setZones(reordered);
    await fetch("/api/admin/ads/placements/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map(z => z.id) }),
    }).catch(() => {});
  };

  const toggleActive = async (zone: PlacementZone) => {
    const next = !zone.isActive;
    setZones(prev => prev.map(z => z.id === zone.id ? { ...z, isActive: next } : z));
    await fetch(`/api/admin/ads/placements/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    }).catch(() => {});
  };

  const deleteZone = async (id: number) => {
    setZones(prev => prev.filter(z => z.id !== id));
    await fetch(`/api/admin/ads/placements/${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-[#737373] max-w-lg">
          Custom placement zones let you serve ads at any position in the app — beyond the standard Feed, Sidebar, and Stories slots. Drag to set priority order.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> New Placement
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" />
        </div>
      ) : zones.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#e5e5e5] flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-[#a3a3a3]">No custom placements yet</p>
          <button onClick={() => setShowCreate(true)} className="text-xs text-[#F44444] hover:underline cursor-pointer">
            Create your first placement zone
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={zones.map(z => z.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-[#f0f0f0]">
                {zones.map(zone => (
                  <SortableZoneRow key={zone.id} zone={zone} onToggle={toggleActive} onDelete={deleteZone} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <PlacementZoneCreator
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={z => { setZones(prev => [...prev, z]); setShowCreate(false); }}
      />
    </div>
  );
}

export default function AdminAds() {
  const [activeTab, setActiveTab] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ads/stats")
      .then(r => r.ok ? r.json() : null)
      .then((d) => setTotalRevenue(d?.stats?.find((s: any) => s.label === "Total Revenue")?.value ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Ads Management</h1>
        <div className="flex items-center gap-2 text-xs text-[#737373]">
          <DollarSign className="w-4 h-4 text-[#22c55e]" />
          <span className="font-medium text-[#0a0a0a]">{totalRevenue ?? "—"}</span>
          <span>total revenue</span>
        </div>
      </div>

      <div className="mb-6">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 0 && <LiveAdsTab />}
      {activeTab === 1 && <CampaignsTab />}
      {activeTab === 2 && <PerformanceTab />}
      {activeTab === 3 && <RevenueTab />}
      {activeTab === 4 && <ConfigurationTab />}
      {activeTab === 5 && <AlgorithmTab />}
      {activeTab === 6 && <PlacementsTab />}
    </div>
  );
}
