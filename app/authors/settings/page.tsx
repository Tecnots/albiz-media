"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Upload, User, MapPin, Globe } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{
    id: number;
    name: string;
    handle: string;
    title: string;
    bio: string | null;
    location: string | null;
    website: string | null;
    avatar: string;
    role: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.user || (data.user.role !== "AUTHOR" && data.user.role !== "ADMIN")) {
          router.push("/");
          return;
        }
        setUser(data.user);
        setName(data.user.name || "");
        setTitle(data.user.title || "");
        setBio(data.user.bio || "");
        setLocation(data.user.location || "");
        setWebsite(data.user.website || "");
        setAvatarPreview(data.user.avatar || "");
        setLoading(false);
      })
      .catch(() => {
        router.push("/");
      });
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      let avatarUrl = avatarPreview;
      if (avatar) {
        const formData = new FormData();
        formData.append("file", avatar);
        formData.append("type", "avatar");
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        avatarUrl = uploadData.url;
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          bio: bio.trim() || null,
          location: location.trim() || null,
          website: website.trim() || null,
          avatar: avatarUrl,
        }),
      });

      if (res.ok) {
        router.push("/authors");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update profile");
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlbizLogo size={32} />
            <span className="font-semibold text-[#0a0a0a]">Profile Settings</span>
          </div>
          <button
            onClick={() => router.push("/authors")}
            className="text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#e5e5e5] flex items-center justify-center">
                    <User className="w-8 h-8 text-[#a3a3a3]" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-1.5 bg-[#F44444] rounded-full cursor-pointer hover:bg-[#d64d3c] transition-colors">
                  <Upload className="w-3 h-3 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[#0a0a0a] mb-1">{user?.name}</h2>
              <p className="text-sm text-[#737373]">@{user?.handle}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Designation</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Frontend Engineer"
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Location</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="City, Country"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#525252] block mb-2">Website</label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-[#e5e5e5]">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
