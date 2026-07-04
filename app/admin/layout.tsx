"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from "next-auth/react";
import { Capacitor } from "@capacitor/core";
import { LayoutDashboard, Users, FileText, ShieldCheck, Newspaper, BarChart3, Megaphone, Mail, KeyRound, Settings, UserCheck, ArrowLeft, ShieldOff, Eye, EyeOff, Loader2, LogOut, Bell, PenLine, Activity, SendHorizonal, Clapperboard } from "lucide-react";
import { AlbizLogo } from "./admin-components";

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: FileText, label: "Content Manager", href: "/admin/content" },
  { icon: ShieldCheck, label: "Approvals", href: "/admin/approvals" },
  { icon: Newspaper, label: "News & Editorial", href: "/admin/news" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Megaphone, label: "Ads", href: "/admin/ads" },
  { icon: UserCheck, label: "Authors", href: "/admin/authors" },
  { icon: PenLine, label: "Editors", href: "/admin/editors" },
  { icon: Clapperboard, label: "Uploaders", href: "/admin/shorts" },
  { icon: Activity, label: "System Tasks", href: "/admin/jobs" },
  { icon: KeyRound, label: "Roles", href: "/admin/roles" },
  { icon: Mail, label: "Emails", href: "/admin/emails" },
  { icon: SendHorizonal, label: "Broadcasts", href: "/admin/campaigns" },
  { icon: Bell, label: "Notifications", href: "/admin/notifications" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

interface AdminUser { id: number; name: string; email: string; role: string; }

function AdminSidebar({ user, onSignOut }: { user: AdminUser | null; onSignOut: () => void }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/admin/notifications");
        const text = await res.text();
        if (!text) return;
        const data = JSON.parse(text);
        setUnreadCount(data.unreadCount ?? 0);
      } catch { }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="hidden md:flex w-64 h-full flex-col bg-white border-r border-[#e5e5e5] flex-shrink-0">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-3 flex-shrink-0">
        <AlbizLogo size={32} />
        <span className="text-[#737373] text-sm font-medium">Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          const isExactDashboard = item.href === "/admin" && pathname === "/admin";
          const active = isExactDashboard || (item.href !== "/admin" && isActive);

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => item.label === "Notifications" && setUnreadCount(0)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${active
                  ? "bg-[#f0f0f0] text-[#0a0a0a] border-l-2 border-[#F44444]"
                  : "text-[#525252] hover:text-[#0a0a0a] hover:bg-[#fafafa] border-l-2 border-transparent"
                }`}
            >
              <div className="relative flex-shrink-0">
                <item.icon className="w-[18px] h-[18px]" />
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#F44444] text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium">{item.label}</span>
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="ml-auto text-[10px] font-semibold text-[#F44444]">{unreadCount}</span>
              )}
            </Link>
          );
        })}

      </nav>

      {/* Footer — user info + actions */}
      <div className="flex-shrink-0 border-t border-[#e5e5e5]">
        <Link
          href="/"
          className="flex items-center gap-3 px-6 py-3 text-[#525252] hover:text-[#0a0a0a] hover:bg-[#fafafa] transition-colors"
        >
          <ArrowLeft className="w-[16px] h-[16px] flex-shrink-0" />
          <span className="text-xs font-medium">Back to App</span>
        </Link>

        <div className="px-6 py-2">
          <span className="text-[10px] text-[#d4d4d4] font-medium tabular-nums">{process.env.NEXT_PUBLIC_APP_VERSION}</span>
        </div>

        {user && (
          <div className="px-4 pb-4 pt-1">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#f0f0f0]">
              {/* Avatar initial */}
              <div className="w-8 h-8 rounded-full bg-[#F44444]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-[#F44444]">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#0a0a0a] truncate">{user.name}</p>
                <p className="text-[10px] text-[#a3a3a3] truncate">{user.email}</p>
              </div>
              <button
                onClick={onSignOut}
                title="Sign out"
                className="p-1.5 rounded-lg text-[#a3a3a3] hover:text-[#F44444] hover:bg-[#FFF0F0] transition-colors cursor-pointer flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Block admin access from native mobile app
  useEffect(() => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      router.replace('/');
    }
  }, [router]);

  const userRole = (session?.user as any)?.role;
  const authed = status === "authenticated" && userRole === "ADMIN";
  const checking = status === "loading";

  const adminUser: AdminUser | null = authed && session?.user ? {
    id: (session.user as any).id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: userRole
  } : null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await nextAuthSignIn("credentials", { redirect: false, email, password });
      if (res?.error) {
        setError(res.error);
      } else {
        // Successful login will automatically update the session
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { getFirebaseAuth } = await import("@/lib/firebase-client");
      await getFirebaseAuth().signOut();
    } catch (err) { }
    await nextAuthSignOut({ callbackUrl: "/", redirect: true });
  };

  if (checking) return null;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-full max-w-sm px-6">
          <div className="flex justify-center mb-6"><AlbizLogo size={40} /></div>
          <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
            <div className="w-12 h-12 rounded-full bg-[#FFF0F0] flex items-center justify-center mx-auto mb-4">
              <ShieldOff className="w-6 h-6 text-[#F44444]" />
            </div>
            <h2 className="text-lg font-semibold text-center text-[#0a0a0a] mb-1">Admin access</h2>
            <p className="text-xs text-[#737373] text-center mb-5">Sign in with an admin account</p>

            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    placeholder="Enter your password"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-[#F44444] text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full py-2.5 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d63c3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign in
              </button>
            </form>

            <div className="mt-4 space-y-1.5">
              <button type="button" onClick={() => { setEmail("support@tecnots.com"); setPassword("C0mplex@#408"); setError(""); }} className="w-full px-3 py-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] hover:border-[#0a0a0a]/20 transition-all cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#0a0a0a] font-medium">support@tecnots.com</p>
                  <span className="text-[10px] font-semibold text-[#0a0a0a] bg-[#e5e5e5] px-1.5 py-0.5 rounded">ADMIN</span>
                </div>
              </button>
              <button type="button" onClick={() => { setEmail("author@demo.albiz.com"); setPassword("demo123"); setError(""); }} className="w-full px-3 py-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] hover:border-[#8B5CF6]/30 transition-all cursor-pointer text-left">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#0a0a0a] font-medium">author@demo.albiz.com</p>
                  <span className="text-[10px] font-semibold text-[#8B5CF6] bg-[#F5F3FF] px-1.5 py-0.5 rounded">AUTHOR</span>
                </div>
              </button>
            </div>
          </div>

          <div className="text-center mt-4">
            <Link href="/" className="text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors">Back to app</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-[#fafafa]">
      <AdminSidebar user={adminUser} onSignOut={handleSignOut} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}