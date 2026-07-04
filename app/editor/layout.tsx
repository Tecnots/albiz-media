"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, InboxIcon, Settings, ArrowLeft, Loader2, History, BarChart2 } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

import { EditorContext, type EditorUser } from "./context";

const navItems = [
  { label: "Dashboard", href: "/editor", icon: LayoutDashboard, exact: true },
  { label: "Queue", href: "/editor/queue", icon: InboxIcon },
  { label: "Activity", href: "/editor/activity", icon: History },
  { label: "Analytics", href: "/editor/analytics", icon: BarChart2 },
  { label: "Settings", href: "/editor/settings", icon: Settings },
];

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<EditorUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.user || (data.user.role !== "EDITOR" && data.user.role !== "ADMIN")) {
          router.push("/");
          return;
        }
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    );
  }

  return (
    <EditorContext.Provider value={{ user, loading }}>
      <div className="h-screen bg-white flex overflow-hidden">
        <aside className="w-52 flex-shrink-0 flex flex-col border-r border-[#f0f0f0] py-6">
          <div className="px-5 mb-8">
            <AlbizLogo size={30} />
            <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest mt-1.5">Editor</p>
          </div>

          <nav className="flex flex-col gap-0.5 px-2">
            {navItems.map(item => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-[#f5f5f5] text-[#0a0a0a] font-medium"
                      : "text-[#737373] hover:bg-[#fafafa] hover:text-[#0a0a0a]"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="px-4 space-y-3">
            {user && (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#f0f0f0] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-[#525252]">{user.name?.[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#0a0a0a] truncate">{user.name}</p>
                  <p className="text-[10px] text-[#a3a3a3] truncate">@{user.handle}</p>
                </div>
              </div>
            )}
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to feed
            </Link>
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </EditorContext.Provider>
  );
}
