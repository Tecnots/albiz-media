"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, Video, Settings, ArrowLeft, Loader2, Plus } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";
import { ShortsContext, type ShortsUser } from "./context";

const navItems = [
  { label: "Overview",   href: "/uploader",          icon: LayoutDashboard, exact: true },
  { label: "My Shorts",  href: "/uploader/my-shorts", icon: Video },
];

export default function UploaderLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const { data: session, status } = useSession();

  const loading      = status === "loading";
  const userRole     = (session?.user as any)?.role;
  const isAuthorized = status === "authenticated" &&
    (userRole === "SHORTS_CREATOR" || userRole === "ADMIN");

  const user: ShortsUser | null = isAuthorized && session?.user ? {
    id:     (session.user as any).id,
    name:   session.user.name ?? "",
    handle: (session.user as any).handle,
    role:   userRole,
    avatar: (session.user as any).avatar,
  } : null;

  if (loading || !isAuthorized) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#404040] animate-spin" />
      </div>
    );
  }

  return (
    <ShortsContext.Provider value={{ user, loading }}>
      <div className="h-screen bg-[#0a0a0a] flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 flex flex-col border-r border-[#1a1a1a] py-6">
          <div className="px-5 mb-8">
            <AlbizLogo size={28} />
            <p className="text-[10px] font-semibold text-[#404040] uppercase tracking-widest mt-1.5">
              Shorts
            </p>
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
                      ? "bg-[#1a1a1a] text-[#fafafa] font-medium"
                      : "text-[#737373] hover:bg-[#141414] hover:text-[#d4d4d4]"
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
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-[#737373]">
                      {user.name?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#d4d4d4] truncate">{user.name}</p>
                  <p className="text-[10px] text-[#525252] truncate">@{user.handle}</p>
                </div>
              </div>
            )}
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-[#404040] hover:text-[#737373] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to feed
            </Link>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
          {children}
        </main>
      </div>
    </ShortsContext.Provider>
  );
}
