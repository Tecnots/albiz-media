"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, PenTool, File, Settings, Loader2 } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

export default function AuthorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; handle: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.user || (data.user.role !== "AUTHOR" && data.user.role !== "ADMIN")) {
          router.push("/");
          return;
        }
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        router.push("/");
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="bg-white border-b border-[#e5e5e5]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlbizLogo size={32} />
            <span className="font-semibold text-[#0a0a0a]">Author Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#737373]">{user?.name}</span>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-[#0a0a0a] mb-8">Welcome, {user?.name}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/authors/my-articles")}
            className="bg-white border border-[#e5e5e5] rounded-xl p-6 text-left hover:border-[#F44444] transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-[#F44444]" />
              <h2 className="font-semibold text-[#0a0a0a]">My Articles</h2>
            </div>
            <p className="text-sm text-[#737373]">View and manage your published articles</p>
          </button>

          <button
            onClick={() => router.push("/authors/create")}
            className="bg-white border border-[#e5e5e5] rounded-xl p-6 text-left hover:border-[#F44444] transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <PenTool className="w-5 h-5 text-[#F44444]" />
              <h2 className="font-semibold text-[#0a0a0a]">Create Article</h2>
            </div>
            <p className="text-sm text-[#737373]">Write and publish a new article</p>
          </button>

          <button
            onClick={() => router.push("/authors/drafts")}
            className="bg-white border border-[#e5e5e5] rounded-xl p-6 text-left hover:border-[#F44444] transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <File className="w-5 h-5 text-[#F44444]" />
              <h2 className="font-semibold text-[#0a0a0a]">Drafts</h2>
            </div>
            <p className="text-sm text-[#737373]">Continue working on your draft articles</p>
          </button>

          <button
            onClick={() => router.push("/authors/settings")}
            className="bg-white border border-[#e5e5e5] rounded-xl p-6 text-left hover:border-[#F44444] transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <Settings className="w-5 h-5 text-[#F44444]" />
              <h2 className="font-semibold text-[#0a0a0a]">Profile Settings</h2>
            </div>
            <p className="text-sm text-[#737373]">Update your author profile information</p>
          </button>
        </div>
      </main>
    </div>
  );
}
