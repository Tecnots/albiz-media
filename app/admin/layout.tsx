"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, ShieldCheck, Newspaper, BarChart3, Megaphone, ArrowLeft } from "lucide-react";
import { AlbizLogo } from "./admin-components";

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: FileText, label: "Content", href: "/admin/content" },
  { icon: ShieldCheck, label: "Approvals", href: "/admin/approvals" },
  { icon: Newspaper, label: "Post News", href: "/admin/news" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Megaphone, label: "Ads", href: "/admin/ads" },
];

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 h-screen sticky top-0 flex-col bg-white border-r border-[#e5e5e5] overflow-y-auto flex-shrink-0">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        <AlbizLogo size={32} />
        <span className="text-[#737373] text-sm font-medium">Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          const isExactDashboard = item.href === "/admin" && pathname === "/admin";
          const active = isExactDashboard || (item.href !== "/admin" && isActive);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                active
                  ? "bg-[#f0f0f0] text-[#0a0a0a] border-l-2 border-[#F44444]"
                  : "text-[#525252] hover:text-[#0a0a0a] hover:bg-[#fafafa] border-l-2 border-transparent"
              }`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to App */}
      <div className="px-3 py-4 border-t border-[#e5e5e5]">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#525252] hover:text-[#0a0a0a] hover:bg-[#fafafa] transition-all duration-200"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
          <span className="text-sm font-medium">Back to App</span>
        </Link>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#fafafa]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
