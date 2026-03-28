"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, FileText, ShieldCheck, Newspaper, BarChart3, Megaphone, Mail, ArrowLeft, ShieldOff, Eye, EyeOff, Loader2 } from "lucide-react";
import { AlbizLogo } from "./admin-components";

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: FileText, label: "Content", href: "/admin/content" },
  { icon: ShieldCheck, label: "Approvals", href: "/admin/approvals" },
  { icon: Newspaper, label: "Post News", href: "/admin/news" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Megaphone, label: "Ads", href: "/admin/ads" },
  { icon: Mail, label: "Emails", href: "/admin/emails" },
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
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Restore auth from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("albiz_admin_auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id && (parsed.role === "ADMIN" || parsed.role === "AUTHOR")) {
          setAuthed(true);
        }
      }
    } catch {}
    setChecking(false);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        if (data.role === "ADMIN" || data.role === "AUTHOR") {
          localStorage.setItem("albiz_admin_auth", JSON.stringify({ id: data.id, role: data.role }));
          setAuthed(true);
        } else {
          setError("This account doesn't have admin or author access");
        }
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
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
            <p className="text-xs text-[#737373] text-center mb-5">Sign in with an admin or author account</p>

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
    <div className="min-h-screen flex bg-[#fafafa]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
