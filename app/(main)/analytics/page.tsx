"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, Users, UserPlus, UserMinus, TrendingUp, ArrowUpRight, ArrowDownRight, Globe, Smartphone, Monitor, ChevronDown } from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { api } from "@/app/lib/api";
import { Sparkline, SuggestedProfiles } from "@/app/lib/shared-components";

// ─── Default fallback data ───

const defaultOverviewStats = [
  { label: "Total views", value: "0", change: 0, up: true, sparkline: Array(12).fill(0) },
  { label: "Total likes", value: "0", change: 0, up: true, sparkline: Array(12).fill(0) },
  { label: "Followers", value: "0", change: 0, up: true, sparkline: Array(12).fill(0) },
  { label: "Engagement", value: "0%", change: 0, up: true, sparkline: Array(12).fill(0) },
];

const defaultReachData = Array(14).fill(0).map((_, i) => ({
  date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  value: 0,
}));

const defaultEngagementBreakdown = [
  { label: "Likes", value: 0, pct: 50, color: "#F44444" },
  { label: "Comments", value: 0, pct: 30, color: "#525252" },
  { label: "Shares", value: 0, pct: 20, color: "#22c55e" },
];

const defaultFollowerDemographics = {
  topCities: [
    { name: "San Francisco", pct: 18 },
    { name: "New York", pct: 14 },
    { name: "London", pct: 11 },
    { name: "Bangalore", pct: 9 },
    { name: "Singapore", pct: 7 },
  ],
  ageRanges: [
    { range: "18-24", pct: 12 },
    { range: "25-34", pct: 38 },
    { range: "35-44", pct: 28 },
    { range: "45-54", pct: 14 },
    { range: "55+", pct: 8 },
  ],
  genderSplit: [
    { label: "Male", pct: 62 },
    { label: "Female", pct: 34 },
    { label: "Other", pct: 4 },
  ],
  devices: [
    { label: "Mobile", pct: 72, icon: Smartphone },
    { label: "Desktop", pct: 24, icon: Monitor },
    { label: "Other", pct: 4, icon: Globe },
  ],
};

const defaultFollowerGrowth = Array(6).fill(0).map((_, i) => {
  const date = new Date();
  date.setMonth(date.getMonth() - (5 - i));
  return { date: date.toLocaleString("default", { month: "short" }), gained: 0, lost: 0 };
});

// ─── Chart component ───

function AreaChart({ data, color = "#F44444", height = 180 }: { data: { date: string; value: number }[]; color?: string; height?: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[180px] flex items-center justify-center text-xs text-[#737373]">
        No data available
      </div>
    );
  }

  const w = 500;
  const pad = { top: 10, right: 10, bottom: 30, left: 10 };
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map(d => d.value), 1);

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1 || 1)) * innerW,
    y: pad.top + innerH - (d.value / max) * innerH,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1]?.x ?? 0} ${pad.top + innerH} L ${pts[0]?.x ?? 0} ${pad.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={String(p.x)} cy={String(p.y)} r="2" fill={color} />)}
      {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0 || i === data.length - 1).map((d, i, arr) => {
        const idx = data.indexOf(d);
        const x = pad.left + (idx / (data.length - 1 || 1)) * innerW;
        return <text key={i} x={String(x)} y={height - 6} textAnchor="middle" className="fill-[#a3a3a3]" style={{ fontSize: "9px" }}>{d.date}</text>;
      })}
    </svg>
  );
}

// ─── Tabs ───
const tabs = ["Overview", "Content", "Audience", "Reach"];

const dateRanges = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
  { label: "All time", days: null },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<number | null>(30);
  const { userRole, currentUserId } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE";
  
  const [overviewStats, setOverviewStats] = useState(defaultOverviewStats);
  const [reachData, setReachData] = useState(defaultReachData);
  const [engagementBreakdown, setEngagementBreakdown] = useState(defaultEngagementBreakdown);
  const [followerGrowth, setFollowerGrowth] = useState(defaultFollowerGrowth);
  const [topContentItems, setTopContentItems] = useState<any[]>([]);
  const [quickSnapshot, setSnapshot] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUserId || !isCircle) return;
    
    const startDate = selectedRange ? new Date(Date.now() - selectedRange * 24 * 60 * 60 * 1000).toISOString() : null;
    
    api.getAnalytics(startDate)
      .then((data: any) => {
        if (data.stats) setOverviewStats(data.stats);
        if (data.views) setReachData(data.views);
        if (data.engagementBreakdown) setEngagementBreakdown(data.engagementBreakdown);
        if (data.followerGrowth) setFollowerGrowth(data.followerGrowth);
        if (data.topPosts) {
          setTopContentItems(data.topPosts.map((p: any) => ({
            id: p.id,
            title: p.title,
            type: p.type,
            image: p.image,
            reach: p.views.toLocaleString(),
            engagement: (p.likes + p.comments).toLocaleString(),
            saves: p.shares?.toLocaleString() || "0",
          })));
        }
        if (data.snapshot) setSnapshot(data.snapshot);
      })
      .catch(() => {});
  }, [currentUserId, isCircle, selectedRange]);

  if (!isCircle) {
    return (
      <>
        <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white flex items-center justify-center py-20">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-[#FFF0F0] flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-[#F44444]" />
            </div>
            <h2 className="text-lg font-semibold text-[#0a0a0a] mb-2">Analytics for Circle members</h2>
            <p className="text-sm text-[#737373] mb-4">Track your reach, engagement, and audience growth with detailed analytics.</p>
            <button className="px-5 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors">Upgrade to Circle</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">Analytics</h1>
            <div className="relative">
              <button 
                onClick={() => setDateRangeOpen(!dateRangeOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-[#fafafa]"
              >
                {dateRanges.find(r => r.days === selectedRange)?.label || "All time"} <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {dateRangeOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg border border-[#e5e5e5] shadow-lg z-50">
                  {dateRanges.map(range => (
                    <button
                      key={range.label}
                      onClick={() => {
                        setSelectedRange(range.days ?? null);
                        setDateRangeOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-[#fafafa] ${selectedRange === range.days ? "bg-[#f5f5f5] font-medium" : "text-[#525252]"}`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {tabs.map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === activeTab ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"}`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-5">
          {/* Overview Tab */}
          {activeTab === 0 && (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {overviewStats.map(stat => (
                  <div key={stat.label} className="rounded-xl border border-[#e5e5e5] p-4">
                    <p className="text-xs text-[#737373] mb-2">{stat.label}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold text-[#0a0a0a]">{stat.value}</span>
                        <span className={`text-[11px] font-medium flex items-center gap-0.5 mt-1 ${stat.up ? "text-[#22c55e]" : "text-[#F44444]"}`}>
                          {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {stat.change}%
                        </span>
                      </div>
                      <Sparkline data={stat.sparkline} color={stat.up ? "#F44444" : "#a3a3a3"} width={60} height={24} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Reach Chart */}
              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Views over time</span>
                <AreaChart data={reachData} />
              </div>

              {/* Engagement Breakdown */}
              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Engagement breakdown</span>
                <div className="flex gap-4 mb-4">
                  {engagementBreakdown.map(item => (
                    <div key={item.label} className="flex-1 text-center">
                      <span className="text-lg font-bold text-[#0a0a0a]">{item.value.toLocaleString()}</span>
                      <p className="text-[11px] text-[#737373] mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="h-3 rounded-full overflow-hidden flex bg-[#f5f5f5]">
                  {engagementBreakdown.map(item => (
                    <div key={item.label} className="h-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  {engagementBreakdown.map(item => (
                    <span key={item.label} className="flex items-center gap-1.5 text-xs text-[#737373]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label} {item.pct}%
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Content Tab */}
          {activeTab === 1 && (
            <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#0a0a0a]">Content performance</span>
                <span className="text-xs text-[#737373]">Sorted by views</span>
              </div>
              {topContentItems.length > 0 ? (
                topContentItems.map((item, i) => (
                  <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-[#fafafa] transition-colors ${i < topContentItems.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
                    <span className="text-sm font-medium text-[#a3a3a3] w-6">{i + 1}</span>
                    {item.image && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                        <Image src={item.image} alt="" width={48} height={48} className="object-cover w-full h-full" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0a0a0a] truncate">{item.title}</p>
                      <span className="text-[10px] text-[#737373] uppercase">{item.type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#737373] flex-shrink-0">
                      <div className="text-center">
                        <span className="text-sm font-medium text-[#0a0a0a] block">{item.reach}</span>
                        <span className="text-[10px]">Views</span>
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-medium text-[#0a0a0a] block">{item.engagement}</span>
                        <span className="text-[10px]">Engagement</span>
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-medium text-[#0a0a0a] block">{item.saves}</span>
                        <span className="text-[10px]">Shares</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-sm text-[#737373]">
                  No posts yet. Start creating content to see your analytics.
                </div>
              )}
            </div>
          )}

          {/* Audience Tab */}
          {activeTab === 2 && (
            <>
              {/* Follower growth */}
              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-[#0a0a0a]">Follower growth</span>
                  <div className="flex items-center gap-3 text-xs text-[#737373]">
                    <span className="flex items-center gap-1"><UserPlus className="w-3 h-3 text-[#22c55e]" /> Gained</span>
                    <span className="flex items-center gap-1"><UserMinus className="w-3 h-3 text-[#F44444]" /> Lost</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {followerGrowth.slice(-6).map(month => {
                    const maxGained = Math.max(...followerGrowth.map(f => f.gained), 1);
                    return (
                      <div key={month.date} className="flex items-center gap-3">
                        <span className="text-xs text-[#737373] w-8">{month.date}</span>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="flex-1 h-4 bg-[#f5f5f5] rounded-full overflow-hidden">
                            <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${(month.gained / maxGained) * 100}%` }} />
                          </div>
                          <span className="text-xs text-[#22c55e] w-10 text-right">+{month.gained}</span>
                        </div>
                        <span className="text-xs text-[#F44444] w-8">-{month.lost}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Demographics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Top Cities */}
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Top locations</span>
                  <div className="space-y-2.5">
                    {defaultFollowerDemographics.topCities.map(city => (
                      <div key={city.name} className="flex items-center gap-3">
                        <span className="text-xs text-[#0a0a0a] flex-1">{city.name}</span>
                        <div className="w-24 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                          <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${city.pct * 3}%` }} />
                        </div>
                        <span className="text-xs text-[#737373] w-8 text-right">{city.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Age Ranges */}
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Age distribution</span>
                  <div className="space-y-2.5">
                    {defaultFollowerDemographics.ageRanges.map(age => (
                      <div key={age.range} className="flex items-center gap-3">
                        <span className="text-xs text-[#0a0a0a] w-10">{age.range}</span>
                        <div className="flex-1 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                          <div className="h-full bg-[#525252] rounded-full" style={{ width: `${age.pct * 2.5}%` }} />
                        </div>
                        <span className="text-xs text-[#737373] w-8 text-right">{age.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gender Split */}
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Gender</span>
                  <div className="flex gap-3">
                    {defaultFollowerDemographics.genderSplit.map(g => (
                      <div key={g.label} className="flex-1 text-center rounded-lg bg-[#fafafa] py-3">
                        <span className="text-lg font-bold text-[#0a0a0a]">{g.pct}%</span>
                        <p className="text-[11px] text-[#737373] mt-0.5">{g.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Devices */}
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Devices</span>
                  <div className="space-y-3">
                    {defaultFollowerDemographics.devices.map(d => (
                      <div key={d.label} className="flex items-center gap-3">
                        <d.icon className="w-4 h-4 text-[#737373]" />
                        <span className="text-xs text-[#0a0a0a] flex-1">{d.label}</span>
                        <div className="w-20 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                          <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${d.pct}%` }} />
                        </div>
                        <span className="text-xs text-[#737373] w-8 text-right">{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Reach Tab */}
          {activeTab === 3 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <p className="text-xs text-[#737373] mb-1">Total impressions</p>
                  <span className="text-2xl font-bold text-[#0a0a0a]">45,210</span>
                  <span className="text-[11px] text-[#22c55e] flex items-center gap-0.5 mt-1"><ArrowUpRight className="w-3 h-3" /> 12.4% vs last period</span>
                </div>
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <p className="text-xs text-[#737373] mb-1">Unique accounts</p>
                  <span className="text-2xl font-bold text-[#0a0a0a]">12,847</span>
                  <span className="text-[11px] text-[#22c55e] flex items-center gap-0.5 mt-1"><ArrowUpRight className="w-3 h-3" /> 18.2% vs last period</span>
                </div>
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <p className="text-xs text-[#737373] mb-1">Avg. reach per post</p>
                  <span className="text-2xl font-bold text-[#0a0a0a]">2,341</span>
                  <span className="text-[11px] text-[#F44444] flex items-center gap-0.5 mt-1"><ArrowDownRight className="w-3 h-3" /> 3.1% vs last period</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Reach over time</span>
                <AreaChart data={reachData} color="#F44444" />
              </div>

              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Discovery sources</span>
                <div className="space-y-2.5">
                  {[
                    { source: "Feed", pct: 45 },
                    { source: "Explore", pct: 28 },
                    { source: "Profile", pct: 15 },
                    { source: "Search", pct: 8 },
                    { source: "Other", pct: 4 },
                  ].map(s => (
                    <div key={s.source} className="flex items-center gap-3">
                      <span className="text-xs text-[#0a0a0a] w-14">{s.source}</span>
                      <div className="flex-1 h-2.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                        <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${s.pct}%` }} />
                      </div>
                      <span className="text-xs text-[#737373] w-8 text-right">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Right Sidebar - Quick Stats */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#0a0a0a] mb-3">Quick stats</h2>
          <div className="space-y-2">
            {quickSnapshot.length > 0 ? (
              quickSnapshot.map((item: any) => (
                <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#fafafa]">
                  <span className="text-xs text-[#525252]">{item.label}</span>
                  <span className="text-xs font-medium text-[#0a0a0a]">{item.value}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#737373] px-3 py-2">Loading stats...</div>
            )}
          </div>
        </div>

        <SuggestedProfiles />
      </aside>
    </>
  );
}
