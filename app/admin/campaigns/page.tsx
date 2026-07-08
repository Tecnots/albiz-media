"use client";

import { useState } from "react";
import { AdminPillTabs } from "@/app/admin/admin-components";
import DashboardTab   from "./_tabs/dashboard";
import BroadcastsTab  from "./_tabs/broadcasts-tab";
import TemplatesTab   from "./_tabs/templates-tab";
import AnalyticsTab   from "./_tabs/analytics-tab";
import LogsTab        from "./_tabs/logs-tab";
import HistoryTab     from "./_tabs/history-tab";
import SettingsTab    from "./_tabs/settings-tab";

const TABS = ["Dashboard", "Broadcasts", "Templates", "Analytics", "Logs", "History", "Settings"];

export default function BroadcastsPage() {
  const [tab, setTab] = useState(0);

  return (
    <div className="h-full flex flex-col bg-[#fafafa]">
      <div className="flex-shrink-0 bg-white border-b border-[#e5e5e5] px-6 pt-4 pb-0">
        <p className="text-sm font-semibold text-[#0a0a0a] mb-3">Broadcasts</p>
        <AdminPillTabs tabs={TABS} activeTab={tab} onTabChange={setTab} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 0 && <DashboardTab />}
        {tab === 1 && <BroadcastsTab />}
        {tab === 2 && <TemplatesTab />}
        {tab === 3 && <AnalyticsTab />}
        {tab === 4 && <LogsTab />}
        {tab === 5 && <HistoryTab />}
        {tab === 6 && <SettingsTab />}
      </div>
    </div>
  );
}
