"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, LogOut } from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { settingsTabs, accountInfo as fallbackAccount, languageRegion as fallbackLang, quickSnapshot } from "@/app/lib/data";
import { api } from "@/app/lib/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { signOut } = useContext(AuthContext);
  const router = useRouter();
  const [accountInfo, setAccountInfo] = useState(fallbackAccount);
  const [languageRegion, setLanguageRegion] = useState(fallbackLang);

  useEffect(() => {
    api.getSettings()
      .then(data => { if (data.account) setAccountInfo(data.account); if (data.language) setLanguageRegion(data.language); })
      .catch(() => {});
  }, []);

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-[#0a0a0a]">Settings</h1>
            <button className="p-2 hover:bg-[#f5f5f5] rounded-lg">
              <Search className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {settingsTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  i === activeTab
                    ? "bg-[#F44444] text-white"
                    : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-6">
          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Account Information</p>
            </div>
            {accountInfo.map((item, i) => (
              <div key={item.label} className={`flex items-center justify-between px-4 py-3.5 ${i < accountInfo.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
                <div>
                  <p className="text-xs text-[#737373]">{item.label}</p>
                  <p className="text-sm text-[#0a0a0a] mt-0.5">{item.value}</p>
                </div>
                <button className="text-xs text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors">Edit</button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Language & Region</p>
            </div>
            {languageRegion.map((item, i) => (
              <div key={item.label} className={`flex items-center justify-between px-4 py-3.5 ${i < languageRegion.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
                <div>
                  <p className="text-xs text-[#737373]">{item.label}</p>
                  <p className="text-sm text-[#0a0a0a] mt-0.5">{item.value}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-[#737373]" />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Account Management</p>
            </div>
            <div className="px-4 py-4">
              <div className="rounded-lg bg-[#FFF0F0] px-4 py-3">
                <p className="text-sm text-[#0a0a0a] mb-1">Want to take a break or leave?</p>
                <button className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors">
                  Deactivate or Delete Account
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => { signOut(); router.push("/"); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      </main>

      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-[#0a0a0a] mb-3">Quick Snapshot</h2>
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] divide-y divide-[#f0f0f0]">
            {quickSnapshot.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#737373]">{stat.label}</span>
                <span className="text-sm font-semibold text-[#0a0a0a]">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
