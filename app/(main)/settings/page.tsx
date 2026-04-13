"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronDown, LogOut, Check, ChevronRight, Globe, Copy, ExternalLink, Loader2, Trash2, ArrowRight, Shield, X, Link2, MessageSquare, Eye, EyeOff, Sparkles } from "lucide-react";
import OnboardModal from "@/app/components/OnboardModal";
import { AuthContext } from "@/app/lib/contexts";
import { settingsTabs, languageRegion as fallbackLang, quickSnapshot, newsAuthors, domainConfig } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { AlbizLogo, VerifiedBadge } from "@/app/lib/shared-components";

function PersonalizationTab() {
  const [followedAuthors, setFollowedAuthors] = useState<Set<number>>(() => new Set(newsAuthors.map(a => a.id)));
  const [showOnboard, setShowOnboard] = useState(false);

  const toggleAuthor = (id: number) => {
    setFollowedAuthors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  return (
    <div className="space-y-6">
      {/* Onboarding Suggestions */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-gradient-to-r from-[#F44444]/5 to-transparent">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F44444]/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#F44444]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0a0a0a]">Discover more content</p>
              <p className="text-xs text-[#737373]">Get personalized recommendations based on your interests</p>
            </div>
          </div>
          <button
            onClick={() => setShowOnboard(true)}
            className="px-4 py-2 text-sm font-medium text-[#F44444] hover:text-white hover:bg-[#F44444] rounded-full border border-[#F44444] transition-all"
          >
            Explore
          </button>
        </div>
      </div>

      {showOnboard && <OnboardModal isOpen={showOnboard} onClose={() => setShowOnboard(false)} />}

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

function PrivacySafetyTab({ userId }: { userId: number }) {
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getBlockedUsers(userId)
      .then(setBlockedUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleUnblock = async (blockedId: number) => {
    setUnblocking(blockedId);
    try {
      await api.unblockUser(userId, blockedId);
      setBlockedUsers(prev => prev.filter(u => u.blockedId !== blockedId));
    } catch {}
    setUnblocking(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#737373]" />
            <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Blocked Users</p>
          </div>
        </div>
        <p className="px-4 pt-3 pb-2 text-xs text-[#737373]">
          Blocked users cannot see your profile, posts, or interact with you. You can unblock them anytime.
        </p>
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" /></div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-8 h-8 text-[#e5e5e5] mx-auto mb-2" />
              <p className="text-sm text-[#737373]">No blocked users</p>
              <p className="text-xs text-[#a3a3a3] mt-1">You haven&apos;t blocked anyone yet</p>
            </div>
          ) : (
            <div className="space-y-1 mt-2">
              {blockedUsers.map(person => (
                <div key={person.blockedId} className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors">
                  <Link href={`/${person.handle}`} className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                      <Image src={person.avatar} alt={person.name} width={40} height={40} className="object-cover w-full h-full" />
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[#0a0a0a] truncate">{person.name}</span>
                      {person.verified && <VerifiedBadge className="scale-75" />}
                      {(person.role === "CIRCLE" || person.role === "ADMIN") && (
                        <span className="px-1.5 py-0.5 bg-[#F44444]/10 text-[#F44444] text-[9px] font-semibold rounded">Circle</span>
                      )}
                    </div>
                    <span className="text-xs text-[#737373] truncate block">@{person.handle}</span>
                  </div>
                  <button
                    onClick={() => handleUnblock(person.blockedId)}
                    disabled={unblocking === person.blockedId}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {unblocking === person.blockedId ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SVG brand icons (simple, on-brand) ─────────────────────────────────────

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function MessengerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.26 5.889-3.26-6.56 6.963z" />
    </svg>
  );
}

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const PLATFORMS = [
  {
    key: "twitter",
    label: "X (Twitter)",
    description: "Sync direct messages from X",
    Icon: XIcon,
    color: "#0a0a0a",
    bg: "#f5f5f5",
  },
  {
    key: "instagram",
    label: "Instagram",
    description: "Receive Instagram DMs",
    Icon: InstagramIcon,
    color: "#E1306C",
    bg: "#FFF0F6",
  },
  {
    key: "messenger",
    label: "Messenger",
    description: "Connect Facebook Messenger",
    Icon: MessengerIcon,
    color: "#0084FF",
    bg: "#EFF6FF",
  },
  {
    key: "facebook",
    label: "Facebook",
    description: "Facebook Page messages",
    Icon: FacebookIcon,
    color: "#1877F2",
    bg: "#EFF6FF",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "WhatsApp Business messages",
    Icon: WhatsAppIcon,
    color: "#25D366",
    bg: "#F0FFF4",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    description: "Receive LinkedIn messages",
    Icon: LinkedInIcon,
    color: "#0A66C2",
    bg: "#EFF6FF",
  },
];

// Live avatar — routes through our server proxy to avoid CORS and Instagram blocks.
// WhatsApp is phone-based; shows letter initial immediately.
function SocialAvatar({ platform, handle }: { platform: string; handle: string }) {
  const [failed, setFailed] = useState(false);

  // Reset when handle or platform changes
  useEffect(() => { setFailed(false); }, [handle, platform]);

  if (!handle) return null;

  const noAvatar = platform === "whatsapp";
  const src = `/api/social/avatar?platform=${encodeURIComponent(platform)}&handle=${encodeURIComponent(handle)}`;

  return (
    <div className="w-14 h-14 rounded-2xl bg-[#f5f5f5] overflow-hidden flex items-center justify-center flex-shrink-0">
      {noAvatar || failed ? (
        <span className="text-xl font-bold text-[#0a0a0a]">{handle.charAt(0).toUpperCase()}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={handle}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function ConnectedAccountsTab({ userId }: { userId: number }) {
  const [connections, setConnections] = useState<{ id: number; platform: string; platformHandle: string; platformAvatarUrl: string | null; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Pre-connect modal state
  const [connectModal, setConnectModal] = useState<string | null>(null); // platform key
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/social/connections?userId=${userId}`)
      .then(r => r.ok ? r.json() : { connections: [] })
      .then(d => setConnections(d.connections ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const social = searchParams.get("social");
    const platform = searchParams.get("platform");
    if (social === "connected" && platform) {
      setToast(`${PLATFORMS.find(p => p.key === platform)?.label ?? platform} connected successfully`);
      setTimeout(() => setToast(null), 4000);
    } else if (social === "error") {
      setToast("Connection failed — please try again");
      setTimeout(() => setToast(null), 4000);
    }
  }, [userId]);

  const openConnectModal = (platform: string) => {
    setHandle("");
    setPassword("");
    setShowPassword(false);
    setAgreed(false);
    setConnectModal(platform);
  };

  const handleConnect = () => {
    if (!connectModal || !agreed) return;
    // Pass handle as login_hint to OAuth — actual auth happens on the platform's page
    const hint = handle.replace(/^@/, "").trim();
    window.location.href = `/api/social/connect/${connectModal}?userId=${userId}${hint ? `&login_hint=${encodeURIComponent(hint)}` : ""}`;
  };

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform);
    await fetch("/api/social/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, platform }),
    }).catch(() => {});
    load();
    setDisconnecting(null);
  };

  const connectedMap = new Map(connections.filter(c => c.active).map(c => [c.platform, c]));
  const modalPlatform = PLATFORMS.find(p => p.key === connectModal);

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${toast.includes("failed") ? "bg-[#FFF0F0] text-[#F44444]" : "bg-[#f0fff4] text-[#15803d]"}`}>
          {toast.includes("failed") ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {toast}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#737373]" />
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Social Inbox</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-[#737373] leading-relaxed">
            Connect your social accounts to receive all your DMs in one place. Messages from X, Instagram, Facebook, and LinkedIn will appear in your Albiz inbox alongside regular messages.
          </p>
        </div>
      </div>

      {/* Platforms */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Connect Accounts</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" /></div>
        ) : (
          <div className="divide-y divide-[#f5f5f5]">
            {PLATFORMS.map(platform => {
              const conn = connectedMap.get(platform.key);
              const isConnected = !!conn;
              return (
                <div key={platform.key} className="flex items-center gap-4 px-4 py-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: platform.bg, color: platform.color }}>
                    <platform.Icon size={18} />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#0a0a0a]">{platform.label}</span>
                      {isConnected && (
                        <span className="text-[10px] font-semibold text-[#22c55e] bg-[#22c55e]/10 px-1.5 py-0.5 rounded-full">Connected</span>
                      )}
                    </div>
                    {isConnected ? (
                      <span className="text-xs text-[#737373]">{conn.platformHandle}</span>
                    ) : (
                      <span className="text-xs text-[#a3a3a3]">{platform.description}</span>
                    )}
                  </div>
                  {/* Action */}
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(platform.key)}
                      disabled={disconnecting === platform.key}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {disconnecting === platform.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => openConnectModal(platform.key)}
                      className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#0a0a0a] text-white hover:bg-[#262626] transition-colors flex items-center gap-1.5"
                    >
                      <Link2 className="w-3 h-3" />
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Setup guide */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Setup</p>
        </div>
        <div className="divide-y divide-[#f5f5f5]">
          {[
            {
              step: "1",
              title: "Configure app credentials",
              desc: "Add your platform API keys to the .env file: TWITTER_CLIENT_ID, META_APP_ID, META_APP_SECRET, LINKEDIN_CLIENT_ID.",
            },
            {
              step: "2",
              title: "Register redirect URIs",
              desc: `Point each platform's redirect URI to: ${typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/social/callback/[platform]`,
            },
            {
              step: "3",
              title: "Configure webhooks",
              desc: `Set webhook URLs in each platform's developer portal: ${typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/social/webhook/[platform]`,
            },
            {
              step: "4",
              title: "Connect your accounts",
              desc: "Click Connect above to authorize Albiz to access your DMs. Messages will appear in your Albiz inbox.",
            },
          ].map((item, i, arr) => (
            <div key={item.step} className={`flex gap-3 px-4 py-3.5 ${i < arr.length - 1 ? "" : ""}`}>
              <div className="w-5 h-5 rounded-full bg-[#F44444] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.step}</div>
              <div>
                <p className="text-xs font-medium text-[#0a0a0a]">{item.title}</p>
                <p className="text-xs text-[#737373] mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Connect modal ── */}
      {connectModal && modalPlatform && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConnectModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

            {/* Header with platform branding */}
            <div className="px-6 pt-7 pb-5 text-center">
              {/* Platform icon + live-fetched avatar */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: modalPlatform.bg, color: modalPlatform.color }}>
                  <modalPlatform.Icon size={28} />
                </div>
                {handle.trim() && (
                  <SocialAvatar
                    platform={connectModal!}
                    handle={handle.replace(/^@/, "").trim()}
                  />
                )}
              </div>
              <p className="text-base font-semibold text-[#0a0a0a]">Connect {modalPlatform.label}</p>
              <p className="text-xs text-[#737373] mt-1">Your credentials are entered securely on {modalPlatform.label}&apos;s page.</p>
            </div>

            <div className="px-6 pb-6 space-y-3">
              {/* Handle / Phone */}
              <div>
                <label className="text-xs font-medium text-[#525252] block mb-1.5">
                  {connectModal === "whatsapp" ? "Phone number" : "Username or handle"}
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] focus-within:border-[#0a0a0a] focus-within:ring-1 focus-within:ring-[#0a0a0a]/10 transition-all">
                  <span className="text-[#a3a3a3] text-sm">
                    {connectModal === "whatsapp" ? "+" : "@"}
                  </span>
                  <input
                    autoFocus
                    type={connectModal === "whatsapp" ? "tel" : "text"}
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                    placeholder={connectModal === "whatsapp" ? "91XXXXXXXXXX" : "yourhandle"}
                    className="flex-1 bg-transparent outline-none text-sm text-[#0a0a0a] placeholder:text-[#c5c5c5]"
                  />
                </div>
              </div>

              {/* Password — hidden for WhatsApp (OTP-based, no password) */}
              {connectModal !== "whatsapp" && (
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Password</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] focus-within:border-[#0a0a0a] focus-within:ring-1 focus-within:ring-[#0a0a0a]/10 transition-all">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="flex-1 bg-transparent outline-none text-sm text-[#0a0a0a] placeholder:text-[#c5c5c5]"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="text-[#a3a3a3] hover:text-[#525252] flex-shrink-0">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* T&C */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                <div
                  onClick={() => setAgreed(v => !v)}
                  className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border transition-all ${agreed ? "bg-[#0a0a0a] border-[#0a0a0a]" : "border-[#d5d5d5] group-hover:border-[#a3a3a3]"}`}
                >
                  {agreed && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs text-[#737373] leading-relaxed">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" className="text-[#0a0a0a] underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" target="_blank" className="text-[#0a0a0a] underline">Privacy Policy</a>
                  . Albiz will access your {modalPlatform.label} messages to display them in your inbox.
                </span>
              </label>

              <button
                onClick={handleConnect}
                disabled={!handle.trim() || !agreed}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: agreed && handle.trim() ? modalPlatform.color : "#a3a3a3", color: "#fff" }}
              >
                Connect to {modalPlatform.label}
              </button>

              <button onClick={() => setConnectModal(null)} className="w-full py-1.5 text-xs text-[#a3a3a3] hover:text-[#525252] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
      <main className="flex-1 min-w-0 px-3 sm:px-4 md:px-6 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-30 py-2.5 md:py-4 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-2.5 md:mb-4">
            <h1 className="text-lg md:text-xl font-semibold text-[#0a0a0a]">Settings</h1>
            <button className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg">
              <Search className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#737373]" />
            </button>
          </div>
          <div className="flex gap-1 md:gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
            {settingsTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
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

        <div className="pt-3 md:pt-4 pb-6">
          {tabName === "Account" && (
            <AccountTab accountInfo={accountInfo} languageRegion={languageRegion} signOut={signOut} router={router} />
          )}
          {tabName === "Personalization" && <PersonalizationTab />}
          {tabName === "Profile & Circle" && <ProfileCircleTab userId={currentUserId} currentUser={currentUser} />}
          {tabName === "Privacy & Safety" && <PrivacySafetyTab userId={currentUserId} />}
          {tabName === "Connected Accounts" && <ConnectedAccountsTab userId={currentUserId} />}
          {tabName !== "Account" && tabName !== "Personalization" && tabName !== "Profile & Circle" && tabName !== "Privacy & Safety" && tabName !== "Connected Accounts" && (
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
