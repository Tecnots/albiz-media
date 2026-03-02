"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, MousePointer, DollarSign, TrendingUp, Pause, Play, MoreVertical, Plus, X, Calendar, Target, Pencil, ImagePlus } from "lucide-react";
import { AdminStatCard, AdminChart, AdminPillTabs, StatusBadge, AdminModal } from "../admin-components";
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

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState(adCampaigns);
  const [filter, setFilter] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", advertiser: "", budget: "", placement: "feed", startDate: "", endDate: "" });

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
      placement: newCampaign.placement,
      image: `https://picsum.photos/seed/ad-new-${prev.length + 1}/400/200`,
    }, ...prev]);
    setNewCampaign({ name: "", advertiser: "", budget: "", placement: "feed", startDate: "", endDate: "" });
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

      <AdminModal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Campaign">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#525252] block mb-1.5">Campaign name</label>
            <input type="text" value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Spring Product Launch" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-[#525252] block mb-1.5">Advertiser</label>
            <input type="text" value={newCampaign.advertiser} onChange={e => setNewCampaign(p => ({ ...p, advertiser: e.target.value }))} placeholder="Company name" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Budget</label>
              <input type="text" value={newCampaign.budget} onChange={e => setNewCampaign(p => ({ ...p, budget: e.target.value }))} placeholder="$5,000" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Placement</label>
              <select value={newCampaign.placement} onChange={e => setNewCampaign(p => ({ ...p, placement: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none">
                <option value="feed">Feed</option>
                <option value="sidebar">Sidebar</option>
                <option value="stories">Stories</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Start date</label>
              <input type="date" value={newCampaign.startDate} onChange={e => setNewCampaign(p => ({ ...p, startDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">End date</label>
              <input type="date" value={newCampaign.endDate} onChange={e => setNewCampaign(p => ({ ...p, endDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleCreate} className="px-5 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Create Campaign</button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
          </div>
        </div>
      </AdminModal>
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
