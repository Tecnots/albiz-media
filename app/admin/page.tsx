"use client";

import Image from "next/image";
import { AdminStatCard, AdminChart } from "./admin-components";
import { platformStats, quickStats, platformActivityData, generateActivityLog } from "./admin-data";

const activityLog = generateActivityLog();

export default function AdminDashboard() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Dashboard</h1>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-white transition-colors">
          Last 30 days
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {platformStats.map(stat => (
          <AdminStatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Chart + Quick Stats */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <AdminChart data={platformActivityData} title="Platform Activity" />
        </div>
        <div className="lg:w-64 rounded-xl border border-[#e5e5e5] p-4 bg-white flex-shrink-0">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Quick Stats</span>
          <div className="space-y-0.5">
            {quickStats.map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 px-1">
                <span className="text-sm text-[#525252]">{item.label}</span>
                <span className="text-sm font-medium text-[#0a0a0a]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e5e5]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Recent Activity</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {activityLog.slice(0, 10).map(item => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                <Image src={item.avatar} alt={item.userName} width={32} height={32} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#0a0a0a]">
                  <span className="font-medium">{item.userName}</span>
                  <span className="text-[#525252]"> {item.action}</span>
                </p>
              </div>
              <span className="text-xs text-[#a3a3a3] flex-shrink-0">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
