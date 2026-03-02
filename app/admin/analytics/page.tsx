"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, ThumbsUp, Monitor, Smartphone, Tablet, Globe, Clock, MousePointer, TrendingUp, Users, ArrowDown } from "lucide-react";
import { AdminStatCard, AdminChart, AdminPillTabs, Sparkline } from "../admin-components";
import {
  analyticsOverviewStats, userGrowthData, contentProductionData, topPerformingPosts,
  siteTrafficStats, pageViewsOverTime, trafficSources, topPages, deviceBreakdown,
  geoData, userBehaviorFlow, realtimeStats, engagementMetrics, retentionData,
} from "../admin-data";

const tabs = ["Traffic", "Users", "Content", "Engagement", "Realtime"];

const deviceIcons: Record<string, typeof Monitor> = { Mobile: Smartphone, Desktop: Monitor, Tablet: Tablet };

function HorizontalBar({ label, value, pct, color = "#F44444" }: { label: string; value: string; pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-[#0a0a0a] w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-[#f5f5f5] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-medium text-[#0a0a0a] w-16 text-right flex-shrink-0">{value}</span>
      <span className="text-xs text-[#737373] w-10 text-right flex-shrink-0">{pct}%</span>
    </div>
  );
}

function FunnelChart({ data }: { data: typeof userBehaviorFlow }) {
  const maxUsers = data[0].users;
  return (
    <div className="space-y-1">
      {data.map((step, i) => {
        const widthPct = (step.users / maxUsers) * 100;
        return (
          <div key={step.step}>
            <div className="flex items-center gap-3 py-1.5">
              <span className="text-xs text-[#737373] w-36 flex-shrink-0">{step.step}</span>
              <div className="flex-1 flex justify-center">
                <div
                  className="h-8 rounded-lg flex items-center justify-center text-xs font-medium text-white transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: `hsl(${0 + i * 8}, ${70 - i * 5}%, ${50 + i * 3}%)`,
                    minWidth: "60px",
                  }}
                >
                  {(step.users / 1000).toFixed(0)}k
                </div>
              </div>
              {step.dropoff > 0 && (
                <span className="text-xs text-[#F44444] w-14 text-right flex-shrink-0 flex items-center gap-0.5 justify-end">
                  <ArrowDown className="w-3 h-3" />{step.dropoff}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrafficTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {siteTrafficStats.map(s => <AdminStatCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AdminChart data={pageViewsOverTime} title="Page views" color="#F44444" />
        </div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Traffic sources</span>
          {trafficSources.map(s => (
            <HorizontalBar key={s.source} label={s.source} value={s.visits} pct={s.pct} color={
              s.source === "Direct" ? "#F44444" : s.source === "Organic Search" ? "#22c55e" :
              s.source === "Social Media" ? "#3B82F6" : s.source === "Referral" ? "#8B5CF6" :
              s.source === "Email" ? "#F59E0B" : "#525252"
            } />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">Top pages</span>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {topPages.map(page => (
              <div key={page.path} className="flex items-center justify-between px-5 py-3 hover:bg-[#fafafa] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm text-[#0a0a0a] truncate">{page.name}</p>
                  <span className="text-xs text-[#a3a3a3]">{page.path}</span>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                  <span className="text-sm font-medium text-[#0a0a0a]">{page.views}</span>
                  <span className="text-xs text-[#737373] flex items-center gap-1"><Clock className="w-3 h-3" /> {page.avgTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
            <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Devices</span>
            <div className="flex gap-4">
              {deviceBreakdown.map(d => {
                const Icon = deviceIcons[d.device] || Monitor;
                return (
                  <div key={d.device} className="flex-1 text-center rounded-xl border border-[#e5e5e5] p-4">
                    <Icon className="w-5 h-5 text-[#525252] mx-auto mb-2" />
                    <span className="text-lg font-bold text-[#0a0a0a] block">{d.pct}%</span>
                    <p className="text-xs text-[#737373]">{d.device}</p>
                    <p className="text-xs text-[#a3a3a3] mt-0.5">{d.sessions}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
            <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Geography</span>
            {geoData.map(g => (
              <HorizontalBar key={g.country} label={g.country} value={g.visitors} pct={g.pct} color="#3B82F6" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {analyticsOverviewStats.map(s => <AdminStatCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminChart data={userGrowthData} title="User growth" color="#F44444" />
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">User retention</span>
          <div className="space-y-3">
            {retentionData.map(d => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="text-xs text-[#737373] w-14 flex-shrink-0">{d.day}</span>
                <div className="flex-1 h-6 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="text-sm font-medium text-[#0a0a0a] w-10 text-right">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
        <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">User behavior funnel</span>
        <FunnelChart data={userBehaviorFlow} />
      </div>
    </div>
  );
}

function ContentTab() {
  const postsChartData = contentProductionData.map(d => ({ date: d.date, value: d.posts }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminChart data={postsChartData} title="Posts per week" color="#525252" />
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Weekly content breakdown</span>
          <div className="space-y-2">
            {contentProductionData.map(week => {
              const total = week.posts + week.articles;
              const postPct = (week.posts / total) * 100;
              return (
                <div key={week.date} className="flex items-center gap-3">
                  <span className="text-xs text-[#737373] w-16 flex-shrink-0">{week.date}</span>
                  <div className="flex-1 h-5 bg-[#f5f5f5] rounded-full overflow-hidden flex">
                    <div className="bg-[#F44444] h-full rounded-l-full" style={{ width: `${postPct}%` }} />
                    <div className="bg-[#525252] h-full rounded-r-full" style={{ width: `${100 - postPct}%` }} />
                  </div>
                  <div className="flex gap-3 text-xs text-[#737373] w-20 flex-shrink-0">
                    <span>{week.posts}p</span><span>{week.articles}a</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-[#737373]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F44444]" /> Posts</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#525252]" /> Articles</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Top performing content</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {topPerformingPosts.map((post, i) => (
            <div key={post.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#fafafa] transition-colors">
              <span className="text-sm font-medium text-[#a3a3a3] w-6">{i + 1}</span>
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                <Image src={post.avatar} alt={post.author} width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0a0a0a] truncate">{post.title}</p>
                <span className="text-xs text-[#737373]">{post.author}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#737373] flex-shrink-0">
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views}</span>
                <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EngagementTab() {
  const metrics = engagementMetrics;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total likes", value: metrics.totalLikes },
          { label: "Total comments", value: metrics.totalComments },
          { label: "Total shares", value: metrics.totalShares },
          { label: "Total saves", value: metrics.totalSaves },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-center">
            <span className="text-2xl font-bold text-[#0a0a0a]">{m.value}</span>
            <p className="text-xs text-[#737373] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Avg. likes / post", value: metrics.avgLikesPerPost },
          { label: "Avg. comments / post", value: metrics.avgCommentsPerPost },
          { label: "Viral coefficient", value: metrics.viralCoefficient },
          { label: "Retention rate", value: metrics.retentionRate },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-center">
            <span className="text-xl font-bold text-[#F44444]">{m.value}</span>
            <p className="text-xs text-[#737373] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
        <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">User behavior funnel</span>
        <FunnelChart data={userBehaviorFlow} />
      </div>
    </div>
  );
}

function RealtimeTab() {
  const rt = realtimeStats;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
          <div className="w-3 h-3 rounded-full bg-[#22c55e] mx-auto mb-3 animate-pulse" />
          <span className="text-4xl font-bold text-[#0a0a0a]">{rt.activeNow.toLocaleString()}</span>
          <p className="text-sm text-[#737373] mt-1">Active users right now</p>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
          <MousePointer className="w-5 h-5 text-[#F44444] mx-auto mb-3" />
          <span className="text-4xl font-bold text-[#0a0a0a]">{rt.pageViewsPerMin}</span>
          <p className="text-sm text-[#737373] mt-1">Page views per minute</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Active pages</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {rt.activePages.map(page => (
            <div key={page.page} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] transition-colors">
              <span className="text-sm text-[#0a0a0a]">{page.page}</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                <span className="text-sm font-medium text-[#0a0a0a]">{page.users}</span>
                <span className="text-xs text-[#737373]">users</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Analytics</h1>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-white transition-colors">
          Last 30 days
        </button>
      </div>

      <div className="mb-6">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 0 && <TrafficTab />}
      {activeTab === 1 && <UsersTab />}
      {activeTab === 2 && <ContentTab />}
      {activeTab === 3 && <EngagementTab />}
      {activeTab === 4 && <RealtimeTab />}
    </div>
  );
}
