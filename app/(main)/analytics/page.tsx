"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import { Eye, ThumbsUp, MessageCircle, Share2, Users, UserPlus, UserMinus, TrendingUp, ArrowUpRight, ArrowDownRight, Globe, Smartphone, Monitor, ChevronDown } from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { users as fallbackUsers, posts as fallbackPosts, quickSnapshot as fallbackSnapshot } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { Sparkline, SuggestedProfiles } from "@/app/lib/shared-components";

// ─── Programmatic analytics data ───

const overviewStats = [
  { label: "Accounts reached", value: "12,847", change: 18.2, up: true, sparkline: [30, 40, 35, 50, 45, 60, 55, 70, 65, 80, 75, 90] },
  { label: "Accounts engaged", value: "3,421", change: 24.5, up: true, sparkline: [20, 28, 25, 35, 30, 42, 38, 50, 45, 55, 52, 65] },
  { label: "Profile visits", value: "1,284", change: 3.2, up: false, sparkline: [50, 48, 45, 47, 42, 40, 38, 41, 36, 35, 37, 34] },
  { label: "New followers", value: "+342", change: 42.1, up: true, sparkline: [8, 12, 10, 18, 15, 22, 20, 30, 28, 35, 32, 42] },
];

const reachData = [
  { date: "14 Feb", value: 420 }, { date: "15 Feb", value: 580 }, { date: "16 Feb", value: 510 },
  { date: "17 Feb", value: 650 }, { date: "18 Feb", value: 490 }, { date: "19 Feb", value: 720 },
  { date: "20 Feb", value: 680 }, { date: "21 Feb", value: 550 }, { date: "22 Feb", value: 810 },
  { date: "23 Feb", value: 740 }, { date: "24 Feb", value: 630 }, { date: "25 Feb", value: 850 },
  { date: "26 Feb", value: 920 }, { date: "27 Feb", value: 880 },
];

const engagementBreakdown = [
  { label: "Likes", value: 4521, pct: 52, color: "#F44444" },
  { label: "Comments", value: 1234, pct: 14, color: "#525252" },
  { label: "Shares", value: 892, pct: 10, color: "#22c55e" },
  { label: "Saves", value: 2108, pct: 24, color: "#3B82F6" },
];

const followerDemographics = {
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

const savesValues = [423, 312, 287, 198, 156, 134];
const topContentItems = fallbackPosts.slice(0, 6).map((p, i) => ({
  id: p.id,
  title: p.type === "article" && "title" in p ? p.title : (p.content?.slice(0, 60) + "..."),
  type: p.type,
  image: "image" in p ? p.image : undefined,
  reach: `${Math.round((12 - i) * 32) / 10}k`,
  engagement: `${Math.round((12 - i) * 11) / 10}k`,
  saves: `${savesValues[i]}`,
}));

const followerGrowth = [
  { date: "Jan", gained: 245, lost: 32 }, { date: "Feb", gained: 310, lost: 28 },
  { date: "Mar", gained: 280, lost: 35 }, { date: "Apr", gained: 350, lost: 25 },
  { date: "May", gained: 320, lost: 40 }, { date: "Jun", gained: 380, lost: 30 },
  { date: "Jul", gained: 400, lost: 38 }, { date: "Aug", gained: 420, lost: 42 },
  { date: "Sep", gained: 390, lost: 28 }, { date: "Oct", gained: 450, lost: 35 },
  { date: "Nov", gained: 480, lost: 30 }, { date: "Dec", gained: 520, lost: 45 },
];

// ─── Chart component ───

function AreaChart({ data, color = "#F44444", height = 180 }: { data: { date: string; value: number }[]; color?: string; height?: number }) {
  const w = 500;
  const pad = { top: 10, right: 10, bottom: 30, left: 10 };
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map(d => d.value));

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * innerW,
    y: pad.top + innerH - (d.value / max) * innerH,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${pad.top + innerH} L ${pts[0].x} ${pad.top + innerH} Z`;

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
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />)}
      {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0 || i === data.length - 1).map((d, i, arr) => {
        const idx = data.indexOf(d);
        const x = pad.left + (idx / (data.length - 1)) * innerW;
        return <text key={i} x={x} y={height - 6} textAnchor="middle" className="fill-[#a3a3a3]" style={{ fontSize: "9px" }}>{d.date}</text>;
      })}
    </svg>
  );
}

// ─── Tabs ───
const tabs = ["Overview", "Content", "Audience", "Reach"];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { userRole } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE";
  const [quickSnapshot, setSnapshot] = useState(fallbackSnapshot);

  useEffect(() => {
    api.getAnalytics()
      .then(data => { if (data.snapshot) setSnapshot(data.snapshot); })
      .catch(() => {});
  }, []);

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
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-[#fafafa]">
              Last 30 days <ChevronDown className="w-3.5 h-3.5" />
            </button>
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
                <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Accounts reached</span>
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
                <span className="text-xs text-[#737373]">Sorted by reach</span>
              </div>
              {topContentItems.map((item, i) => (
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
                      <span className="text-[10px]">Reach</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium text-[#0a0a0a] block">{item.engagement}</span>
                      <span className="text-[10px]">Engagement</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium text-[#0a0a0a] block">{item.saves}</span>
                      <span className="text-[10px]">Saves</span>
                    </div>
                  </div>
                </div>
              ))}
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
                  {followerGrowth.slice(-6).map(month => (
                    <div key={month.date} className="flex items-center gap-3">
                      <span className="text-xs text-[#737373] w-8">{month.date}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 h-4 bg-[#f5f5f5] rounded-full overflow-hidden">
                          <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${(month.gained / 550) * 100}%` }} />
                        </div>
                        <span className="text-xs text-[#22c55e] w-10 text-right">+{month.gained}</span>
                      </div>
                      <span className="text-xs text-[#F44444] w-8">-{month.lost}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Demographics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Top Cities */}
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Top locations</span>
                  <div className="space-y-2.5">
                    {followerDemographics.topCities.map(city => (
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
                    {followerDemographics.ageRanges.map(age => (
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
                    {followerDemographics.genderSplit.map(g => (
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
                    {followerDemographics.devices.map(d => (
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
          <h2 className="text-sm font-semibold text-[#0a0a0a] mb-3">Quick snapshot</h2>
          <div className="space-y-1">
            {quickSnapshot.map(item => (
              <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#fafafa] transition-colors">
                <span className="text-xs text-[#525252]">{item.label}</span>
                <span className="text-xs font-semibold text-[#0a0a0a]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#0a0a0a] mb-3">Account health</h2>
          <div className="space-y-2">
            {[
              { label: "Posting frequency", value: "4.2/week", status: "good" },
              { label: "Reply rate", value: "89%", status: "good" },
              { label: "Avg. engagement", value: "5.2%", status: "good" },
              { label: "Growth rate", value: "+2.1%/mo", status: "good" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#fafafa]">
                <span className="text-xs text-[#525252]">{item.label}</span>
                <span className="text-xs font-medium text-[#22c55e]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <SuggestedProfiles />
      </aside>
    </>
  );
}
