"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, Video, Settings, ArrowLeft, Loader2, Plus, BarChart2 } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";
import { Avatar } from "@/app/components/Avatar";
import { ShortsContext, type ShortsUser } from "./context";

const navItems = [
  { label: "Overview",   href: "/uploader",          icon: LayoutDashboard, exact: true },
  { label: "My Shorts",  href: "/uploader/my-shorts", icon: Video },
  { label: "Analytics",  href: "/uploader/analytics", icon: BarChart2 },
  { label: "Settings",   href: "/uploader/settings",  icon: Settings },
];

export default function UploaderLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const { data: session, status } = useSession();

  const loading      = status === "loading";
  const userRole     = (session?.user as any)?.role;
  const isAuthorized = status === "authenticated" &&
    (userRole === "UPLOADER" || userRole === "ADMIN");

  const user: ShortsUser | null = isAuthorized && session?.user ? {
    id:     (session.user as any).id,
    name:   session.user.name ?? "",
    handle: (session.user as any).handle,
    role:   userRole,
    avatar: (session.user as any).avatar,
  } : null;

  if (loading || !isAuthorized) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    );
  }

  return (
    <ShortsContext.Provider value={{ user, loading }}>
      <div className="h-screen bg-white flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 flex flex-col border-r border-[#f0f0f0] py-6">
          <div className="px-5 mb-8">
            <AlbizLogo size={30} />
            <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-widest mt-1.5">Uploader</p>
          </div>

          <div className="px-4 mb-6">
            <Link
              href="/uploader/create"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              New short
            </Link>
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
                <Avatar src={user.avatar} name={user.name} size={28} className="bg-[#f0f0f0]" />
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

        <main className="flex-1 min-w-0 overflow-y-auto bg-white">
          {children}
        </main>
      </div>
    </ShortsContext.Provider>
  );
}
