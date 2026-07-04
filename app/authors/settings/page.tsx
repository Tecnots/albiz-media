"use client";

import { useEffect, useState } from "react";
import { Loader2, Upload, MapPin, Globe, User } from "lucide-react";
import { useAuthorContext } from "../context";

export default function ProfileSettingsPage() {
  const { user, loading: authLoading } = useAuthorContext();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [websiteError, setWebsiteError] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setTitle((user as any).title || "");
    setBio((user as any).bio || "");
    setLocation((user as any).location || "");
    setWebsite((user as any).website || "");
    setGender((user as any).gender || "");
    setBirthYear((user as any).birthYear ? String((user as any).birthYear) : "");
    setAvatarPreview((user as any).avatar || "");
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const validateWebsite = (value: string): boolean => {
    if (!value.trim()) { setWebsiteError(""); return true; }
    try {
      const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
      const u = new URL(candidate);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        setWebsiteError("Website must use http or https");
        return false;
      }
      setWebsiteError("");
      return true;
    } catch {
      setWebsiteError("Enter a valid website URL");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateWebsite(website)) return;
    setSaving(true);
    try {
      let avatarUrl = avatarPreview;
      if (avatar) {
        const formData = new FormData();
        formData.append("file", avatar);
        formData.append("type", "avatar");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
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
          gender: gender || null,
          birthYear: birthYear || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all";

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <p className="text-xl font-bold text-[#0a0a0a] mb-8">Profile settings</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-5 pb-5 border-b border-[#f0f0f0]">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[#f0f0f0] flex items-center justify-center">
              {avatarPreview
                ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                : <User className="w-7 h-7 text-[#c0c0c0]" />
              }
            </div>
            <label className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#F44444] flex items-center justify-center cursor-pointer hover:bg-[#d64d3c] transition-colors">
              <Upload className="w-2.5 h-2.5 text-white" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-[#0a0a0a]">{user?.name}</p>
            <p className="text-xs text-[#a3a3a3]">@{user?.handle}</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Designation</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Frontend Engineer" className={inputClass} />
        </div>

        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell readers about yourself"
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Location</label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c0c0c0]" />
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className={`${inputClass} pl-9`} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Website</label>
          <div className="relative">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c0c0c0]" />
            <input
              type="text"
              value={website}
              onChange={e => { setWebsite(e.target.value); if (websiteError) validateWebsite(e.target.value); }}
              onBlur={e => validateWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              className={`${inputClass} pl-9 ${websiteError ? "border-[#F44444] focus:ring-[#F44444]/20" : ""}`}
            />
          </div>
          {websiteError && <p className="text-xs text-[#F44444] mt-1">{websiteError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#f0f0f0]">
          <div>
            <label className="text-xs font-medium text-[#525252] block mb-1.5">
              Gender <span className="text-[#c0c0c0] font-normal">optional</span>
            </label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className={inputClass}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-binary</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#525252] block mb-1.5">
              Birth year <span className="text-[#c0c0c0] font-normal">optional</span>
            </label>
            <div className="relative">
              <select
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                className={`${inputClass} appearance-none cursor-pointer bg-white`}
              >
                <option value="">Select year</option>
                {Array.from(
                  { length: new Date().getFullYear() - 1950 + 1 },
                  (_, i) => new Date().getFullYear() - i
                ).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-[#737373]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-[#a3a3a3] -mt-3">Used only for audience demographics in your analytics.</p>

        <div className="flex items-center justify-between pt-4 border-t border-[#f0f0f0]">
          {saved && <p className="text-xs text-[#a3a3a3]">Changes saved</p>}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
