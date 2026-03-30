"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Eye, MousePointer, DollarSign, TrendingUp, Pause, Play, MoreVertical, Plus, X, Calendar, Target, Pencil, ImagePlus, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AdminStatCard, AdminChart, AdminPillTabs, StatusBadge, AdminModal, Dropdown } from "../admin-components";
import { adCampaigns, adRevenueStats, adRevenueOverTime, adPlacementPerformance } from "../admin-data";

const tabs = ["Live Ads", "Campaigns", "Performance", "Revenue", "Configuration"];

function LiveAdsTab() {
  const [ads, setAds] = useState([
    { id: 1, name: "Inito Diagnostics", brand: "inito", headline: "At-home diagnostics startup Inito raises $29 million from BII, Fireside Ventures", image: "https://picsum.photos/seed/ad-startup/400/600", placement: "Sidebar", status: "active", impressions: "245k", clicks: "8.2k", ctr: "3.35%" },
    { id: 2, name: "YC Applications", brand: "Y Combinator", headline: "Applications for YC Winter 2026 batch are now open. Build something people want.", image: "https://picsum.photos/seed/ad-yc/400/600", placement: "Feed", status: "active", impressions: "520k", clicks: "18.4k", ctr: "3.54%" },
    { id: 3, name: "Azure AI Platform", brand: "Microsoft Azure", headline: "Build, deploy, and scale AI models with Azure AI. Start free today.", image: "https://picsum.photos/seed/ad-azure/400/600", placement: "Feed", status: "active", impressions: "890k", clicks: "24.1k", ctr: "2.71%" },
  ]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ brand: "", headline: "", image: "" });

  const startEdit = (ad: typeof ads[0]) => {
    setEditingId(ad.id);
    setEditForm({ brand: ad.brand, headline: ad.headline, image: ad.image });
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setAds(prev => prev.map(a => a.id === editingId ? { ...a, brand: editForm.brand, headline: editForm.headline, image: editForm.image } : a));
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#737373]">Preview and edit ads as they appear to users on the platform.</p>

      {ads.map(ad => (
        <div key={ad.id} className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e5e5]">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#0a0a0a]">{ad.name}</span>
              <StatusBadge status={ad.status} />
              <span className="text-xs text-[#a3a3a3]">{ad.placement}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#737373]">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {ad.impressions}</span>
              <span className="flex items-center gap-1"><MousePointer className="w-3 h-3" /> {ad.clicks}</span>
              <span className="font-medium text-[#F44444]">{ad.ctr} CTR</span>
              <button onClick={() => startEdit(ad)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Pencil className="w-4 h-4 text-[#525252]" />
              </button>
            </div>
          </div>

          <div className="flex gap-6 p-5">
            {/* Live Preview */}
            <div className="w-64 flex-shrink-0">
              <span className="text-[10px] font-semibold tracking-widest text-[#a3a3a3] uppercase block mb-2">Preview</span>
              <div className="rounded-2xl overflow-hidden relative" style={{ height: 380 }}>
                <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 rounded text-xs text-white z-10">Ad</div>
                <Image src={ad.image} alt={ad.name} width={400} height={600} className="object-cover w-full h-full" />
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
                <div className="grid grid-cols-3 gap-3 mt-4">
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
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const PLACEMENTS = [
  { key: "Feed", label: "Feed", desc: "Between posts" },
  { key: "Sidebar", label: "Sidebar", desc: "Right panel" },
  { key: "Stories", label: "Stories", desc: "Between stories" },
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
  const [campaigns, setCampaigns] = useState(adCampaigns);
  const [filter, setFilter] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
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
  };
  const [newCampaign, setNewCampaign] = useState(emptyForm);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", "13");
      form.append("category", "posts");
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
  const filtered = campaigns.filter(c => {
    if (filter === 1) return c.status === "active";
    if (filter === 2) return c.status === "paused";
    if (filter === 3) return c.status === "completed";
    if (filter === 4) return c.status === "scheduled";
    return true;
  });

  const togglePause = (id: number) => {
    setCampaigns(prev => prev.map(c =>
      c.id === id ? { ...c, status: (c.status === "active" ? "paused" : "active") as typeof c.status } : c
    ));
  };

  const togglePlacement = (key: string) => {
    setNewCampaign(p => ({
      ...p,
      placements: p.placements.includes(key)
        ? p.placements.filter(pl => pl !== key)
        : [...p.placements, key],
    }));
  };

  const handleCreate = () => {
    if (!newCampaign.name.trim() || !newCampaign.advertiser.trim()) return;
    setCampaigns(prev => [{
      id: prev.length + 1,
      name: newCampaign.name,
      advertiser: newCampaign.advertiser,
      status: "scheduled" as const,
      budget: newCampaign.budget || "$0",
      spent: "$0",
      impressions: "0",
      clicks: "0",
      ctr: "0%",
      cpc: "$0",
      startDate: newCampaign.startDate || "TBD",
      endDate: newCampaign.endDate || "TBD",
      placement: newCampaign.placements.join(", "),
      image: `https://picsum.photos/seed/ad-new-${prev.length + 1}/400/200`,
    }, ...prev]);
    setNewCampaign(emptyForm);
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <AdminPillTabs tabs={filterTabs} activeTab={filter} onTabChange={setFilter} />
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      <div className="space-y-2">
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
                <p className="text-xs text-[#737373] mb-3">{campaign.advertiser} &middot; {campaign.placement} &middot; {campaign.startDate} - {campaign.endDate}</p>

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
                {(campaign.status === "active" || campaign.status === "paused") && (
                  <button
                    onClick={() => togglePause(campaign.id)}
                    className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
                    title={campaign.status === "active" ? "Pause" : "Resume"}
                  >
                    {campaign.status === "active" ? <Pause className="w-4 h-4 text-[#737373]" /> : <Play className="w-4 h-4 text-[#22c55e]" />}
                  </button>
                )}
                <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-[#737373]" />
                </button>
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
                    </div>
                  )}

                  {/* Placements */}
                  <div>
                    <label className="text-xs font-medium text-[#525252] block mb-2">Placements</label>
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
                    {newCampaign.placements.length === 0 && <p className="text-[10px] text-[#F44444] mt-1">Select at least one</p>}
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

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleCreate} disabled={newCampaign.placements.length === 0 || !newCampaign.name.trim()} className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      Create Campaign
                    </button>
                    <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-[#525252] text-sm hover:bg-[#fafafa] transition-colors cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>

                {/* RIGHT: Placement previews */}
                <div className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6 space-y-6">
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider">
                    {newCampaign.placements.length === 0 ? "Select placements to see previews" : "Placement previews"}
                  </p>

                  {/* Feed preview — matches SponsoredArticleCard in app/(main)/page.tsx */}
                  {newCampaign.placements.includes("Feed") && (
                    <div>
                      <p className="text-xs font-medium text-[#525252] mb-2">Feed</p>
                      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white max-w-sm shadow-sm">
                        <div className="flex items-stretch gap-4 p-4">
                          {/* Image — left side like SponsoredArticleCard */}
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
                            {/* Top row: tag + Ad badge */}
                            <div className="flex items-start justify-between mb-1.5">
                              <span className="text-[10px] text-[#F44444] font-medium">{newCampaign.advertiser || "Brand"}</span>
                              <span className="text-[10px] font-medium text-[#737373] tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#f0f0f0] flex-shrink-0 ml-2">Ad</span>
                            </div>
                            {/* Title */}
                            <h3 className="text-sm font-semibold leading-tight text-[#0a0a0a] mb-1.5 line-clamp-2">
                              {newCampaign.adHeadline || "Your ad headline will appear here"}
                            </h3>
                            {/* CTA — red pill button like "Read" */}
                            <button className="px-3 py-1 bg-[#F44444] text-white text-[11px] font-medium rounded-full">
                              {newCampaign.adCta || "Read"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sidebar preview — matches AdCard in shared-components.tsx */}
                  {newCampaign.placements.includes("Sidebar") && (
                    <div>
                      <p className="text-xs font-medium text-[#525252] mb-2">Sidebar</p>
                      {/* Same structure as AdCard — full-bleed image with gradient overlay */}
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
                          <span className="text-white font-semibold text-sm block leading-tight">
                            {newCampaign.advertiser || "Brand"}
                          </span>
                          <p className="text-[11px] text-white mt-1 line-clamp-2 leading-tight">
                            {newCampaign.adHeadline || "Your ad headline appears here"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stories preview — matches the story card format in the app */}
                  {newCampaign.placements.includes("Stories") && (
                    <div>
                      <p className="text-xs font-medium text-[#525252] mb-2">Stories</p>
                      {/* Story ring wrapper around a vertical 9:16 card */}
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
                            {/* Story top bar — progress + header */}
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
                            {/* Bottom gradient + CTA */}
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent pt-8">
                              <p className="text-[9px] font-semibold text-white leading-tight line-clamp-2 mb-1.5">
                                {newCampaign.adHeadline || "Ad headline"}
                              </p>
                              <button className="w-full py-0.5 rounded-full bg-white text-[8px] font-semibold text-[#0a0a0a]">
                                {newCampaign.adCta || "Learn More"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {newCampaign.placements.length === 0 && (
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

function PerformanceTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {adRevenueStats.map(s => <AdminStatCard key={s.label} {...s} />)}
      </div>

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
                <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">CTR</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#737373]">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {adPlacementPerformance.map(p => (
                <tr key={p.placement} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-[#0a0a0a]">{p.placement}</td>
                  <td className="px-5 py-3.5 text-sm text-[#0a0a0a] text-right">{p.impressions}</td>
                  <td className="px-5 py-3.5 text-sm text-[#0a0a0a] text-right">{p.clicks}</td>
                  <td className="px-5 py-3.5 text-sm text-[#F44444] font-medium text-right">{p.ctr}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-[#22c55e] text-right">{p.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Campaign comparison</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {adCampaigns.filter(c => c.status !== "scheduled").map(c => {
            const ctrNum = parseFloat(c.ctr);
            return (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#fafafa] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{c.name}</p>
                  <span className="text-xs text-[#737373]">{c.advertiser}</span>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0 text-xs text-[#737373]">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {c.impressions}</span>
                  <span className="flex items-center gap-1"><MousePointer className="w-3 h-3" /> {c.clicks}</span>
                  <span className={`font-medium ${ctrNum > 3.3 ? "text-[#22c55e]" : ctrNum > 2.8 ? "text-[#F59E0B]" : "text-[#F44444]"}`}>{c.ctr}</span>
                  <span className="font-medium text-[#0a0a0a]">{c.spent}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RevenueTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {adRevenueStats.map(s => <AdminStatCard key={s.label} {...s} />)}
      </div>

      <AdminChart data={adRevenueOverTime} title="Ad revenue over time" color="#22c55e" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Revenue by placement</span>
          {adPlacementPerformance.map(p => {
            const rev = parseFloat(p.revenue.replace(/[$,]/g, ""));
            const totalRev = adPlacementPerformance.reduce((sum, pl) => sum + parseFloat(pl.revenue.replace(/[$,]/g, "")), 0);
            const pct = Math.round((rev / totalRev) * 100);
            return (
              <div key={p.placement} className="flex items-center gap-3 py-2.5">
                <span className="text-sm text-[#0a0a0a] w-20 flex-shrink-0">{p.placement}</span>
                <div className="flex-1 h-6 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium text-[#22c55e] w-20 text-right flex-shrink-0">{p.revenue}</span>
                <span className="text-xs text-[#737373] w-10 text-right flex-shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Revenue by campaign</span>
          {adCampaigns.filter(c => parseFloat(c.spent.replace(/[$,]/g, "")) > 0).sort((a, b) =>
            parseFloat(b.spent.replace(/[$,]/g, "")) - parseFloat(a.spent.replace(/[$,]/g, ""))
          ).map(c => (
            <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-[#f0f0f0] last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-[#0a0a0a] truncate">{c.name}</p>
                <span className="text-xs text-[#737373]">{c.advertiser}</span>
              </div>
              <span className="text-sm font-medium text-[#0a0a0a] flex-shrink-0 ml-4">{c.spent}</span>
            </div>
          ))}
        </div>
      </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { name: "Feed", desc: "Between posts in the main feed", enabled: true },
              { name: "Sidebar", desc: "Right sidebar ad card slot", enabled: settings.sidebarEnabled },
              { name: "Stories", desc: "Between user stories", enabled: settings.storiesEnabled },
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

      <button className="px-5 py-2.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">
        Save Configuration
      </button>
    </div>
  );
}

export default function AdminAds() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Ads Management</h1>
        <div className="flex items-center gap-2 text-xs text-[#737373]">
          <DollarSign className="w-4 h-4 text-[#22c55e]" />
          <span className="font-medium text-[#0a0a0a]">$48,760</span>
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
    </div>
  );
}
