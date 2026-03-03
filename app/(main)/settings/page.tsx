"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronDown, LogOut, Check, ChevronRight, Globe, Copy, ExternalLink, Loader2, Trash2, ArrowRight } from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { settingsTabs, languageRegion as fallbackLang, quickSnapshot, newsAuthors, sponsoredPosts, domainConfig } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { AlbizLogo, VerifiedBadge } from "@/app/lib/shared-components";

const contentTopics = [
  { id: "tech", label: "Technology", tags: ["Technology", "Tech"] },
  { id: "business", label: "Business", tags: ["Business"] },
  { id: "ai", label: "AI & ML", tags: ["AI"] },
  { id: "startups", label: "Startups", tags: ["Startups"] },
  { id: "finance", label: "Finance", tags: ["Finance", "Investing"] },
  { id: "news", label: "News", tags: ["News"] },
  { id: "policy", label: "Policy", tags: ["Policy"] },
  { id: "space", label: "Space", tags: ["Space"] },
];

function PersonalizationTab() {
  const [topics, setTopics] = useState(() => contentTopics.map(t => ({ ...t, selected: true })));
  const [showAds, setShowAds] = useState(true);
  const [adFrequency, setAdFrequency] = useState<"normal" | "reduced">("normal");
  const [followedAuthors, setFollowedAuthors] = useState<Set<number>>(() => new Set(newsAuthors.map(a => a.id)));

  const toggleTopic = (id: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const selectAllTopics = () => setTopics(prev => prev.map(t => ({ ...t, selected: true })));
  const deselectAllTopics = () => setTopics(prev => prev.map(t => ({ ...t, selected: false })));
  const allSelected = topics.every(t => t.selected);

  const toggleAuthor = (id: number) => {
    setFollowedAuthors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Unique sponsors from sponsored posts
  const sponsors = sponsoredPosts.reduce((acc: { name: string; logo: string }[], post) => {
    if (!acc.find(s => s.name === post.sponsor.name)) acc.push(post.sponsor);
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {/* Content Topics */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Content Topics</p>
          <button
            onClick={allSelected ? deselectAllTopics : selectAllTopics}
            className="text-xs text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
        <p className="px-4 pt-3 pb-2 text-xs text-[#737373]">Choose which topics appear in your feed. Posts matching your selected topics will be prioritized.</p>
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2">
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => toggleTopic(topic.id)}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl border transition-all ${
                topic.selected
                  ? "border-[#F44444] bg-[#F44444]/5"
                  : "border-[#e5e5e5] hover:border-[#d5d5d5]"
              }`}
            >
              <span className={`text-sm ${topic.selected ? "text-[#0a0a0a] font-medium" : "text-[#737373]"}`}>{topic.label}</span>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                topic.selected ? "bg-[#F44444]" : "border border-[#d5d5d5]"
              }`}>
                {topic.selected && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ad Preferences */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Sponsored Content</p>
        </div>
        <div className="px-4 py-3.5 border-b border-[#f0f0f0] flex items-center justify-between">
          <div>
            <p className="text-sm text-[#0a0a0a]">Show sponsored articles</p>
            <p className="text-xs text-[#737373] mt-0.5">Sponsored articles from verified brands will appear in your feed</p>
          </div>
          <button
            onClick={() => setShowAds(!showAds)}
            className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${showAds ? "bg-[#F44444]" : "bg-[#d5d5d5]"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${showAds ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        {showAds && (
          <div className="px-4 py-3.5 border-b border-[#f0f0f0]">
            <p className="text-sm text-[#0a0a0a] mb-3">Frequency</p>
            <div className="flex gap-2">
              {(["normal", "reduced"] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setAdFrequency(opt)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                    adFrequency === opt
                      ? "bg-[#F44444] text-white"
                      : "bg-[#f5f5f5] text-[#525252] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                  }`}
                >
                  {opt === "normal" ? "Standard" : "Reduced"}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#737373] mt-2">
              {adFrequency === "normal" ? "You'll see sponsored content at regular intervals in your feed." : "You'll see fewer sponsored articles in your feed."}
            </p>
          </div>
        )}
        {showAds && sponsors.length > 0 && (
          <div className="px-4 py-3.5">
            <p className="text-xs text-[#737373] mb-3">Active sponsors on the platform</p>
            <div className="flex flex-wrap gap-2">
              {sponsors.map(s => (
                <div key={s.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5f5f5]">
                  <div className="w-4 h-4 rounded-full overflow-hidden">
                    <Image src={s.logo} alt={s.name} width={16} height={16} className="object-cover w-full h-full" />
                  </div>
                  <span className="text-xs text-[#525252]">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Authors */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Authors</p>
        </div>
        <p className="px-4 pt-3 pb-2 text-xs text-[#737373]">Manage which authors' articles appear in your feed.</p>
        {newsAuthors.map((author, i) => {
          const isFollowed = followedAuthors.has(author.id);
          return (
            <div key={author.id} className={`flex items-center gap-3 px-4 py-3 ${i < newsAuthors.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
              <Link href={`/author/${author.handle}`} className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                  <Image src={author.avatar} alt={author.name} width={40} height={40} className="object-cover w-full h-full" />
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/author/${author.handle}`} className="flex items-center gap-1 hover:underline">
                  <span className="text-sm font-medium text-[#0a0a0a] truncate">{author.name}</span>
                  <VerifiedBadge className="scale-75" />
                </Link>
                <span className="text-xs text-[#737373] truncate block">{author.role} @ {author.org}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleAuthor(author.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    isFollowed
                      ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                      : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                  }`}
                >
                  {isFollowed ? "Following" : "Follow"}
                </button>
                <Link href={`/author/${author.handle}`} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4 text-[#a3a3a3]" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileCircleTab({ userId, currentUser }: { userId: number; currentUser: { name: string; handle: string; title: string; avatar: string } | null }) {
  const [domain, setDomain] = useState("");
  const [verified, setVerified] = useState(false);
  const [inputDomain, setInputDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [showBranding, setShowBranding] = useState(true);
  const handle = currentUser?.handle || "you";

  useEffect(() => {
    api.getDomain(userId).then(data => {
      setDomain(data.domain || "");
      setVerified(data.verified || false);
      setShowBranding(data.showBranding ?? true);
      if (data.domain) setInputDomain(data.domain);
    }).catch(() => {});
  }, [userId]);

  const toggleBranding = () => {
    const next = !showBranding;
    setShowBranding(next);
    api.updateBranding(userId, next).catch(() => setShowBranding(!next));
  };

  const handleSave = async () => {
    if (!inputDomain.trim()) return;
    setSaving(true);
    setError("");
    try {
      const data = await api.setDomain(userId, inputDomain.trim());
      if (data.error) { setError(data.error); return; }
      setDomain(data.domain);
      setVerified(data.verified);
    } catch { setError("Failed to save domain"); }
    finally { setSaving(false); }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError("");
    try {
      const data = await api.verifyDomain(userId);
      if (data.error) { setError(data.error); return; }
      setVerified(data.verified);
    } catch { setError("Verification failed"); }
    finally { setVerifying(false); }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await api.removeDomain(userId);
      setDomain("");
      setVerified(false);
      setInputDomain("");
    } catch { setError("Failed to remove domain"); }
    finally { setRemoving(false); }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasDomain = domain.length > 0;
  const verificationToken = `albiz-verify=${handle}-${userId}`;

  return (
    <div className="space-y-6">
      {/* Current profile URL */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Your Profile</p>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#fafafa]">
            <Globe className="w-4 h-4 text-[#a3a3a3] flex-shrink-0" />
            <span className="text-sm text-[#525252] font-mono">{domainConfig.mainDomain}/{handle}</span>
            <button
              onClick={() => copyToClipboard(`${domainConfig.mainDomain}/${handle}`, "profile")}
              className="ml-auto p-1 hover:bg-[#e5e5e5] rounded transition-colors flex-shrink-0"
            >
              {copied === "profile" ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#a3a3a3]" />}
            </button>
          </div>
          {hasDomain && verified && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#fafafa] mt-2">
              <Globe className="w-4 h-4 text-[#22c55e] flex-shrink-0" />
              <span className="text-sm text-[#525252] font-mono">{domain}</span>
              <span className="text-[10px] font-medium text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">Active</span>
              <button
                onClick={() => copyToClipboard(domain, "custom")}
                className="ml-auto p-1 hover:bg-[#e5e5e5] rounded transition-colors flex-shrink-0"
              >
                {copied === "custom" ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#a3a3a3]" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Domain */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Custom Domain</p>
        </div>
        <div className="px-4 py-4 space-y-4">
          <p className="text-xs text-[#737373]">
            Connect your own domain to your profile. Visitors will see your profile at your custom URL with a small Albiz Media badge.
          </p>

          {/* Domain input */}
          <div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputDomain}
                  onChange={e => { setInputDomain(e.target.value); setError(""); }}
                  placeholder="yourdomain.com"
                  disabled={hasDomain && verified}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#e5e5e5] bg-white text-[#0a0a0a] placeholder:text-[#c5c5c5] focus:outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              {!hasDomain && (
                <button
                  onClick={handleSave}
                  disabled={saving || !inputDomain.trim()}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#F44444] text-white hover:bg-[#d63c3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Connect
                </button>
              )}
              {hasDomain && !verified && (
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#F44444] text-white hover:bg-[#d63c3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Verify
                </button>
              )}
            </div>
            {error && <p className="text-xs text-[#F44444] mt-1.5">{error}</p>}
          </div>

          {/* Status indicator */}
          {hasDomain && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg ${verified ? "bg-[#22c55e]/5 border border-[#22c55e]/20" : "bg-[#f59e0b]/5 border border-[#f59e0b]/20"}`}>
              <div className={`w-2 h-2 rounded-full ${verified ? "bg-[#22c55e]" : "bg-[#f59e0b] animate-pulse"}`} />
              <span className={`text-xs font-medium ${verified ? "text-[#15803d]" : "text-[#92400e]"}`}>
                {verified ? "Domain verified and active" : "Pending DNS verification"}
              </span>
            </div>
          )}

          {/* DNS Instructions — show when domain is set but not verified */}
          {hasDomain && !verified && (
            <div className="rounded-lg border border-[#e5e5e5] overflow-hidden">
              <div className="px-3 py-2.5 bg-[#fafafa] border-b border-[#e5e5e5]">
                <p className="text-xs font-medium text-[#0a0a0a]">DNS Configuration</p>
                <p className="text-[11px] text-[#737373] mt-0.5">Add these records at your domain registrar</p>
              </div>
              <div className="divide-y divide-[#f0f0f0]">
                {/* CNAME record */}
                <div className="px-3 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold tracking-wider text-[#737373] uppercase">CNAME Record</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between bg-[#fafafa] rounded px-2.5 py-2">
                      <div>
                        <span className="text-[10px] text-[#a3a3a3] block">Host</span>
                        <span className="text-xs text-[#0a0a0a] font-mono">@</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#a3a3a3] block">Points to</span>
                        <span className="text-xs text-[#0a0a0a] font-mono">{domainConfig.cnameTarget}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(domainConfig.cnameTarget, "cname")}
                        className="p-1 hover:bg-[#e5e5e5] rounded transition-colors"
                      >
                        {copied === "cname" ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3 text-[#a3a3a3]" />}
                      </button>
                    </div>
                  </div>
                </div>
                {/* TXT record for verification */}
                <div className="px-3 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold tracking-wider text-[#737373] uppercase">TXT Record</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#fafafa] rounded px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-[#a3a3a3] block">Value</span>
                      <span className="text-xs text-[#0a0a0a] font-mono truncate block">{verificationToken}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(verificationToken, "txt")}
                      className="p-1 hover:bg-[#e5e5e5] rounded transition-colors flex-shrink-0 ml-2"
                    >
                      {copied === "txt" ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3 text-[#a3a3a3]" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#a3a3a3] mt-2">DNS changes can take up to 48 hours to propagate.</p>
                </div>
              </div>
            </div>
          )}

          {/* Branding toggle — only show when domain is verified */}
          {hasDomain && verified && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-[#0a0a0a]">Show Albiz Media badge</p>
                <p className="text-xs text-[#737373] mt-0.5">A small badge appears on your custom domain profile</p>
              </div>
              <button
                onClick={toggleBranding}
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${showBranding ? "bg-[#F44444]" : "bg-[#d5d5d5]"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${showBranding ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          )}

          {/* Remove domain */}
          {hasDomain && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-2 text-xs text-[#a3a3a3] hover:text-[#F44444] transition-colors"
            >
              {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Remove custom domain
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {hasDomain && verified && (
        <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e5e5e5]">
            <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Preview</p>
          </div>
          <div className="px-4 py-4">
            <div className="rounded-lg border border-[#e5e5e5] overflow-hidden">
              {/* Fake browser bar */}
              <div className="bg-[#fafafa] border-b border-[#e5e5e5] px-3 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#e5e5e5]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#e5e5e5]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#e5e5e5]" />
                </div>
                <div className="flex-1 bg-white rounded px-2.5 py-1 text-xs text-[#525252] font-mono border border-[#e5e5e5]">
                  {domain}
                </div>
              </div>
              {/* Profile preview */}
              <div className="bg-white p-4 relative">
                <div className="flex items-center gap-3">
                  {currentUser && (
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                      <Image src={currentUser.avatar} alt={currentUser.name} width={40} height={40} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-[#0a0a0a]">{currentUser?.name}</span>
                      <VerifiedBadge className="scale-75" />
                    </div>
                    <span className="text-xs text-[#737373]">{currentUser?.title}</span>
                  </div>
                </div>
                {showBranding && (
                  <div className="mt-4 pt-3 border-t border-[#f0f0f0] flex items-center gap-1.5">
                    <AlbizLogo size={14} />
                    <span className="text-[10px] text-[#a3a3a3]">Powered by Albiz Media</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#a3a3a3] mt-3">This is how your profile appears when visited via your custom domain.</p>
          </div>
        </div>
      )}

      {/* Circle membership */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Circle Membership</p>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F44444]/10 flex items-center justify-center">
                <VerifiedBadge />
              </div>
              <div>
                <p className="text-sm font-medium text-[#0a0a0a]">Circle Member</p>
                <p className="text-xs text-[#737373]">Verified creator with full platform access</p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountTab({ accountInfo, languageRegion, signOut, router }: {
  accountInfo: { label: string; value: string }[];
  languageRegion: { label: string; value: string }[];
  signOut: () => void;
  router: any;
}) {
  return (
    <div className="space-y-6">
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
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { signOut, currentUserId } = useContext(AuthContext);
  const router = useRouter();
  const [accountInfo, setAccountInfo] = useState<{ label: string; value: string }[]>([]);
  const [languageRegion, setLanguageRegion] = useState(fallbackLang);
  const [currentUser, setCurrentUser] = useState<{ name: string; handle: string; title: string; avatar: string } | null>(null);

  useEffect(() => {
    api.getSettings(currentUserId)
      .then(data => {
        if (data.account?.length) setAccountInfo(data.account);
        if (data.language?.length) setLanguageRegion(data.language);
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, [currentUserId]);

  const tabName = settingsTabs[activeTab];

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

        <div className="pt-4 pb-6">
          {tabName === "Account" && (
            <AccountTab accountInfo={accountInfo} languageRegion={languageRegion} signOut={signOut} router={router} />
          )}
          {tabName === "Personalization" && <PersonalizationTab />}
          {tabName === "Profile & Circle" && <ProfileCircleTab userId={currentUserId} currentUser={currentUser} />}
          {tabName !== "Account" && tabName !== "Personalization" && tabName !== "Profile & Circle" && (
            <div className="text-center py-16">
              <p className="text-[#737373] text-sm">{tabName} settings coming soon.</p>
            </div>
          )}
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
