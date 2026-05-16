"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronDown, LogOut, Check, ChevronRight, ChevronLeft, Globe, Copy, ExternalLink, Loader2, Trash2, ArrowRight, Shield, X, Link2, MessageSquare, Eye, EyeOff, Sparkles, Laptop, Briefcase, Bot, Rocket, TrendingUp, Palette, Megaphone, FlaskConical, Heart, Film, Trophy, Landmark } from "lucide-react";
import OnboardModal from "@/app/components/OnboardModal";
import { AuthContext } from "@/app/lib/contexts";
import { settingsTabs, languageRegion as fallbackLang, quickSnapshot, newsAuthors, domainConfig } from "@/app/lib/data";
import { api } from "@/app/lib/api";
import { AlbizLogo, VerifiedBadge, RecentStories, SuggestedProfiles, AdCard } from "@/app/lib/shared-components";
import { EMAIL_TEMPLATES } from "@/app/lib/email-templates";
import { isNative } from "@/app/lib/capacitor";
import { Toast } from "@capacitor/toast";

const topicIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  tech: Laptop,
  business: Briefcase,
  ai: Bot,
  startups: Rocket,
  finance: TrendingUp,
  crypto: TrendingUp,
  science: FlaskConical,
  politics: Landmark,
};

function PersonalizationTab() {
  const { currentUserId } = useContext(AuthContext);
  const [showOnboard, setShowOnboard] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<any[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      if (currentUserId) {
        Promise.all([
          fetch("/api/topics").then(res => res.json()),
          fetch(`/api/interests?userId=${currentUserId}`).then(res => res.json()),
          fetch(`/api/users/suggested?currentUserId=${currentUserId}`).then(res => res.json()),
          api.getFollowing(currentUserId)
        ]).then(([topics, interests, suggested, following]) => {
          setAvailableTopics(topics);
          setSelectedTopics(new Set(interests));
          setSuggestedUsers(suggested);
          setFollowingIds(new Set(following));
          setLoading(false);
        }).catch(err => {
          console.error("Failed to fetch personalization data:", err);
          setLoading(false);
        });
      }
    };

    fetchData();

    window.addEventListener("albiz-interests-updated", fetchData);
    return () => window.removeEventListener("albiz-interests-updated", fetchData);
  }, [currentUserId]);

  const toggleTopic = async (topicId: string) => {
    if (!currentUserId) return;
    const next = new Set(selectedTopics);
    if (next.has(topicId)) next.delete(topicId);
    else next.add(topicId);
    setSelectedTopics(next);

    try {
      await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, interests: Array.from(next) }),
      });
      window.dispatchEvent(new CustomEvent("albiz-interests-updated"));
    } catch (err) {
      console.error("Failed to save interest:", err);
    }
  };

  const toggleFollow = async (userId: number) => {
    if (!currentUserId) return;
    const isFollowing = followingIds.has(userId);
    setFollowingIds(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(userId);
      else next.add(userId);
      return next;
    });

    try {
      if (isFollowing) {
        await api.unfollow(currentUserId, userId);
      } else {
        await api.follow(currentUserId, userId);
      }
      window.dispatchEvent(new CustomEvent("albiz-interests-updated"));
    } catch (err) {
      console.error("Follow action failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 text-[#F44444] animate-spin" />
        <p className="text-sm text-[#737373]">Loading your preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Onboarding Suggestions */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-gradient-to-r from-[#F44444]/5 to-transparent">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F44444]/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#F44444]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0a0a0a]">Guided Experience</p>
              <p className="text-xs text-[#737373]">Run the onboarding wizard to quickly set up your feed</p>
            </div>
          </div>
          <button
            onClick={() => setShowOnboard(true)}
            className="px-4 py-2 text-sm font-medium text-[#F44444] hover:text-white hover:bg-[#F44444] rounded-full border border-[#F44444] transition-all"
          >
            Start
          </button>
        </div>
      </div>

      {showOnboard && <OnboardModal isOpen={showOnboard} onClose={() => setShowOnboard(false)} />}

      {/* Interests */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Topics you follow</h3>
          <p className="text-xs text-[#737373]">Content from these topics will be prioritized in your feed.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableTopics.map((topic) => {
            const isSelected = selectedTopics.has(topic.id);
            const IconComponent = topicIcons[topic.id];
            return (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "border-[#F44444] bg-[#F44444]/5"
                    : "border-[#e5e5e5] bg-white hover:border-[#d5d5d5] hover:bg-[#fafafa]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-[#F44444]/10" : "bg-[#f5f5f5]"}`}>
                  {IconComponent ? (
                    <IconComponent className={`w-4 h-4 ${isSelected ? "text-[#F44444]" : "text-[#737373]"}`} />
                  ) : (
                    <Sparkles className={`w-4 h-4 ${isSelected ? "text-[#F44444]" : "text-[#737373]"}`} />
                  )}
                </div>
                <span className={`text-xs font-medium ${isSelected ? "text-[#F44444]" : "text-[#0a0a0a]"}`}>{topic.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#F44444] ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suggested Users */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white">
        <div className="px-4 py-3 border-b border-[#e5e5e5] bg-[#fafafa]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Suggested for you</p>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {suggestedUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#737373]">No suggestions at the moment.</div>
          ) : (
            suggestedUsers.map((user) => {
              const isFollowing = followingIds.has(user.id);
              return (
                <div key={user.id} className="flex items-center gap-3 px-4 py-4">
                  <Link href={`/${user.handle}?_customDomain=1`} className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                      <Image src={user.avatar} alt={user.name} width={40} height={40} className="object-cover w-full h-full" />
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/${user.handle}?_customDomain=1`} className="flex items-center gap-1 hover:underline">
                      <span className="text-sm font-semibold text-[#0a0a0a] truncate">{user.name}</span>
                      {user.verified && <VerifiedBadge className="scale-75" />}
                    </Link>
                    <span className="text-xs text-[#737373] truncate block">{user.title}</span>
                  </div>
                  <button
                    onClick={() => toggleFollow(user.id)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                      isFollowing
                        ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                        : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileCircleTab({ userId, currentUser }: { userId: number; currentUser: { name: string; handle: string; title: string; avatar: string } | null }) {
  const [domain, setDomain] = useState("");
  const [domainStatus, setDomainStatus] = useState("PENDING");
  const [domainToken, setDomainToken] = useState<string | null>(null);
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
      setDomainStatus(data.domainStatus || "PENDING");
      setDomainToken(data.domainToken || null);
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
      setDomainStatus(data.domainStatus);
      setDomainToken(data.domainToken || null);
    } catch { setError("Failed to save domain"); }
    finally { setSaving(false); }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError("");
    try {
      const data = await api.verifyDomain(userId);
      if (data.error) { setError(data.error); return; }
      setDomainStatus(data.domainStatus);
    } catch { setError("Verification failed"); }
    finally { setVerifying(false); }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await api.removeDomain(userId);
      setDomain("");
      setDomainStatus("PENDING");
      setDomainToken(null);
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
  const isVerified = domainStatus === "ACTIVE";
  const isPending = domainStatus === "PENDING";
  const verificationToken = domainToken || `albiz-verify=${handle}-${userId}`;

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
          {hasDomain && isVerified && (
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
                  disabled={hasDomain && isVerified}
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
              {hasDomain && !isVerified && (
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
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg ${isVerified ? "bg-[#22c55e]/5 border border-[#22c55e]/20" : "bg-[#f59e0b]/5 border border-[#f59e0b]/20"}`}>
              <div className={`w-2 h-2 rounded-full ${isVerified ? "bg-[#22c55e]" : "bg-[#f59e0b] animate-pulse"}`} />
              <span className={`text-xs font-medium ${isVerified ? "text-[#15803d]" : "text-[#92400e]"}`}>
                {isVerified ? "Domain verified and active" : "Pending DNS verification"}
              </span>
            </div>
          )}

          {/* DNS Instructions — show when domain is set but not verified */}
          {hasDomain && !isVerified && (
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
          {hasDomain && isVerified && (
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
      {hasDomain && isVerified && (
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
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] bg-[#f5f5f5] flex items-center justify-center">
                      {currentUser.avatar ? (
                        <Image src={currentUser.avatar} alt={currentUser.name} width={40} height={40} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-sm font-medium text-[#737373]">{currentUser.name?.charAt(0)?.toUpperCase() || "?"}</span>
                      )}
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

function AccountTab({ accountInfo, setAccountInfo, languageRegion: initialLanguageRegion, signOut, router, currentUser, setCurrentUser, currentUserId, userProfile }: {
  accountInfo: { label: string; value: string }[];
  setAccountInfo: React.Dispatch<React.SetStateAction<{ label: string; value: string }[]>>;
  languageRegion: { label: string; value: string }[];
  signOut: (options?: { callbackUrl?: string }) => void;
  router: any;
  currentUser: { name: string; handle: string; title: string; avatar: string } | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<{ name: string; handle: string; title: string; avatar: string } | null>>;
  currentUserId: number;
  userProfile: any;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [languageDropdown, setLanguageDropdown] = useState(false);
  const [regionDropdown, setRegionDropdown] = useState(false);
  const [timeZoneDropdown, setTimeZoneDropdown] = useState(false);
  const [currencyDropdown, setCurrencyDropdown] = useState(false);
  const [languageRegion, setLanguageRegion] = useState(initialLanguageRegion);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAccountActionModal, setShowAccountActionModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [reactivationDate, setReactivationDate] = useState<string>("");
  const [deactivateStep, setDeactivateStep] = useState(1);
  const [deactivateReason, setDeactivateReason] = useState<string>("");
  const [deactivatePassword, setDeactivatePassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string>("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState<string>("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [deletePassword, setDeletePassword] = useState<string>("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string>("");

  const deactivateReasons = [
    "Just need a break",
    "Too many ads",
    "Want to remove something",
    "Privacy concerns",
    "Created another account",
    "Trouble with getting started",
    "Too busy/too distracting",
    "Concerned about my data",
    "Can't find people to follow",
    "Something else",
  ];

  const deleteReasons = [
    "Privacy concerns",
    "Too many ads",
    "Want to remove something",
    "Created another account",
    "Trouble with getting started",
    "Not using anymore",
    "Concerned about my data",
    "Something else",
  ];

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
  ];

  const regions = [
    { code: "us", name: "United States" },
    { code: "uk", name: "United Kingdom" },
    { code: "in", name: "India" },
    { code: "ca", name: "Canada" },
    { code: "au", name: "Australia" },
    { code: "de", name: "Germany" },
    { code: "fr", name: "France" },
    { code: "jp", name: "Japan" },
  ];

  const timeZones = [
    { code: "UTC", name: "UTC (Coordinated Universal Time)" },
    { code: "EST", name: "EST (Eastern Standard Time)" },
    { code: "PST", name: "PST (Pacific Standard Time)" },
    { code: "IST", name: "IST (Indian Standard Time)" },
    { code: "GMT", name: "GMT (Greenwich Mean Time)" },
    { code: "CET", name: "CET (Central European Time)" },
    { code: "JST", name: "JST (Japan Standard Time)" },
    { code: "AEST", name: "AEST (Australian Eastern Standard Time)" },
  ];

  const currencies = [
    { code: "USD", name: "USD - US Dollar" },
    { code: "EUR", name: "EUR - Euro" },
    { code: "GBP", name: "GBP - British Pound" },
    { code: "INR", name: "INR - Indian Rupee" },
    { code: "JPY", name: "JPY - Japanese Yen" },
    { code: "CAD", name: "CAD - Canadian Dollar" },
    { code: "AUD", name: "AUD - Australian Dollar" },
    { code: "CNY", name: "CNY - Chinese Yuan" },
  ];

  const handleEdit = (label: string, value: string) => {
    setEditingField(label);
    setEditValue(value);
    setError("");
  };

  const handleSave = async () => {
    if (!editingField || !currentUser) return;
    setSaving(true);
    setError("");
    
    try {
      const fieldMap: Record<string, string> = {
        "Username": "handle",
        "Name": "name",
      };
      
      const dbField = fieldMap[editingField];
      if (!dbField) {
        setEditingField(null);
        setSaving(false);
        return;
      }

      // If editing username, check if it already exists before attempting update
      if (dbField === "handle" && editValue !== currentUser.handle) {
        const checkResponse = await fetch(`/api/users/${editValue}`);
        if (checkResponse.ok) {
          setError("This username already exists. Please choose another.");
          setSaving(false);
          return;
        }
      }

      // Get the current user's actual handle from the settings API
      const settingsResponse = await fetch(`/api/settings?userId=${currentUserId}`);
      if (!settingsResponse.ok) {
        setError("Failed to fetch user data. Please refresh the page.");
        setSaving(false);
        return;
      }
      
      const settingsData = await settingsResponse.json();
      const actualHandle = settingsData.user?.handle;
      
      if (!actualHandle) {
        setError("User not found. Please refresh the page.");
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/users/${actualHandle}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [dbField]: editValue, requestingUserId: currentUserId }),
      });
      
      // Check for specific error statuses
      if (response.status === 409) {
        setError("This username already exists. Please choose another.");
        setSaving(false);
        return;
      }
      
      // For other errors, still try to verify if update succeeded
      if (!response.ok) {
        console.warn("Update response not OK, but checking if update succeeded");
      }
      
      // Verify the update by fetching user data again
      const verifyResponse = await fetch(`/api/settings?userId=${currentUserId}`);
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const updatedValue = verifyData.user?.[dbField];
        
        if (updatedValue === editValue) {
          // Update succeeded, update local state
          setAccountInfo(prev => prev.map(item => 
            item.label === editingField ? { ...item, value: editValue } : item
          ));
          
          if (dbField === "handle") {
            setCurrentUser(prev => prev ? { ...prev, handle: editValue } : null);
          } else if (dbField === "name") {
            setCurrentUser(prev => prev ? { ...prev, name: editValue } : null);
          }
          
          setEditingField(null);
          
          // Dispatch event to update userProfile in AuthContext
          window.dispatchEvent(new CustomEvent("albiz-user-updated", { detail: { field: dbField, value: editValue } }));
        } else {
          setError("Update failed. Please try again.");
        }
      } else {
        setError("Failed to verify update. Please refresh the page.");
      }
    } catch (err: any) {
      console.error("Update error:", err);
      setError("Failed to update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
    setError("");
  };

  const handleLanguageSelect = async (lang: { code: string; name: string }) => {
    setLanguageRegion(prev => prev.map(item =>
      item.label === "Language" ? { ...item, value: lang.name } : item
    ));
    setLanguageDropdown(false);
    // Save to backend
    try {
      await fetch("/api/settings/language-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, language: lang.code }),
      });
    } catch (err) {
      console.error("Failed to save language:", err);
    }
  };

  const handleRegionSelect = async (region: { code: string; name: string }) => {
    setLanguageRegion(prev => prev.map(item =>
      item.label === "Region" ? { ...item, value: region.name } : item
    ));
    setRegionDropdown(false);
    // Save to backend
    try {
      await fetch("/api/settings/language-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, region: region.code }),
      });
    } catch (err) {
      console.error("Failed to save region:", err);
    }
  };

  const handleTimeZoneSelect = async (timeZone: { code: string; name: string }) => {
    setLanguageRegion(prev => prev.map(item =>
      item.label === "Time Zone" ? { ...item, value: timeZone.name } : item
    ));
    setTimeZoneDropdown(false);
    // Save to backend
    try {
      await fetch("/api/settings/language-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, timeZone: timeZone.code }),
      });
    } catch (err) {
      console.error("Failed to save time zone:", err);
    }
  };

  const handleCurrencySelect = async (currency: { code: string; name: string }) => {
    setLanguageRegion(prev => prev.map(item =>
      item.label === "Currency" ? { ...item, value: currency.name } : item
    ));
    setCurrencyDropdown(false);
    // Save to backend
    try {
      await fetch("/api/settings/language-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, currency: currency.code }),
      });
    } catch (err) {
      console.error("Failed to save currency:", err);
    }
  };

  const handleDeactivate = async () => {
    setDeactivateError("");
    setDeactivating(true);
    try {
      // Verify password first
      const verifyResponse = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, password: deactivatePassword }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        setDeactivateError(errorData.error || "Incorrect password. Please try again.");
        setDeactivating(false);
        return;
      }

      const response = await fetch("/api/users/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, reactivationDate }),
      });
      const responseData = await response.json();
      console.log("Deactivate response:", responseData);

      if (response.ok) {
        setShowDeactivateModal(false);
        signOut();
        router.push("/");
      } else {
        setDeactivateError(responseData.error || "Failed to deactivate account. Please try again.");
      }
    } catch (err) {
      console.error("Failed to deactivate account:", err);
      setDeactivateError("Failed to deactivate account. Please try again.");
    } finally {
      setDeactivating(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (response.ok) {
        setForgotSent(true);
      } else {
        alert("Failed to send reset link. Please try again.");
      }
    } catch (err) {
      console.error("Failed to send reset link:", err);
      alert("Failed to send reset link. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Get the actual handle from settings API first
      const settingsResponse = await fetch(`/api/settings?userId=${currentUserId}`);
      if (!settingsResponse.ok) {
        alert("Failed to fetch user data. Please try again.");
        setDeleting(false);
        return;
      }

      const settingsData = await settingsResponse.json();
      const actualHandle = settingsData.user?.handle;

      if (!actualHandle) {
        alert("User not found. Please try again.");
        setDeleting(false);
        return;
      }

      const response = await fetch(`/api/users/${actualHandle}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, password: deletePassword }),
      });

      if (response.ok) {
        setShowDeleteModal(false);
        signOut({ callbackUrl: "/" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || errorData?.message || "Failed to delete account. Please try again.";
        if (response.status === 401) {
          setDeleteError(errorMessage);
        } else {
          alert(errorMessage);
        }
      }
    } catch (err) {
      console.error("Failed to delete account:", err);
      alert("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Account Information</p>
        </div>
        {accountInfo.map((item, i) => {
          const isEditing = editingField === item.label;
          const isEditable = item.label === "Username" || item.label === "Name";
          
          return (
            <div key={item.label} className={`px-4 py-3.5 ${i < accountInfo.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
              {isEditing ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#737373]">{item.label}</p>
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#e5e5e5] focus:outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20"
                    autoFocus
                  />
                  {error && <p className="text-xs text-[#F44444]">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#F44444] text-white hover:bg-[#d64d3c] transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#737373]">{item.label}</p>
                    <p className="text-sm text-[#0a0a0a] mt-0.5">{item.value}</p>
                  </div>
                  {isEditable && (
                    <button 
                      onClick={() => handleEdit(item.label, item.value)}
                      className="text-xs text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="px-4 py-3.5">
          <p className="text-xs text-[#737373]">App Version</p>
          <p className="text-sm text-[#0a0a0a] mt-0.5">{process.env.NEXT_PUBLIC_APP_VERSION || 'v0.1.6'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Language & Region</p>
        </div>
        {languageRegion.map((item, i) => {
          const isLanguage = item.label === "Language";
          const isRegion = item.label === "Region";
          const isTimeZone = item.label === "Time Zone";
          const isCurrency = item.label === "Currency";
          const isOpen = isLanguage ? languageDropdown : isRegion ? regionDropdown : isTimeZone ? timeZoneDropdown : isCurrency ? currencyDropdown : false;
          const dropdownItems = isLanguage ? languages : isRegion ? regions : isTimeZone ? timeZones : isCurrency ? currencies : [];

          return (
            <div key={item.label} className={`relative ${i < languageRegion.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
              <div
                className={`flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-[#fafafa] transition-colors ${isLanguage || isRegion || isTimeZone || isCurrency ? "" : ""}`}
                onClick={() => {
                  if (isLanguage) setLanguageDropdown(!languageDropdown);
                  if (isRegion) setRegionDropdown(!regionDropdown);
                  if (isTimeZone) setTimeZoneDropdown(!timeZoneDropdown);
                  if (isCurrency) setCurrencyDropdown(!currencyDropdown);
                }}
              >
                <div>
                  <p className="text-xs text-[#737373]">{item.label}</p>
                  <p className="text-sm text-[#0a0a0a] mt-0.5">{item.value}</p>
                </div>
                {(isLanguage || isRegion || isTimeZone || isCurrency) && <ChevronDown className={`w-4 h-4 text-[#737373] transition-transform ${isOpen ? "rotate-180" : ""}`} />}
              </div>

              {isOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border border-[#e5e5e5] rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {dropdownItems.map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => {
                        if (isLanguage) handleLanguageSelect(opt);
                        if (isRegion) handleRegionSelect(opt);
                        if (isTimeZone) handleTimeZoneSelect(opt);
                        if (isCurrency) handleCurrencySelect(opt);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-[#0a0a0a] hover:bg-[#fafafa] transition-colors"
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Account Management</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-[#737373] mb-3">Want to take a break or leave?</p>
          <button
            onClick={() => setShowAccountActionModal(true)}
            className="px-4 py-2 text-sm text-[#F44444] font-medium bg-[#FFF0F0] hover:bg-[#FFE0E0] rounded-lg transition-colors"
          >
            Deactivate or Delete Account
          </button>
        </div>
      </div>

      {/* Account Action Modal */}
      {showAccountActionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAccountActionModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-semibold text-[#0a0a0a] mb-1">Account Actions</h2>
              <p className="text-sm text-[#737373]">
                Choose what you want to do with your account.
              </p>
            </div>
            <div className="px-6 pb-6 space-y-3">
              <button
                onClick={() => {
                  setShowAccountActionModal(false);
                  setShowDeactivateModal(true);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] hover:border-[#d5d5d5] transition-colors group"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-[#0a0a0a] group-hover:text-[#F44444] transition-colors">Deactivate Account</p>
                  <p className="text-xs text-[#737373] mt-0.5">Temporarily disable your account</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#F44444] transition-colors" />
              </button>
              <button
                onClick={() => {
                  setShowAccountActionModal(false);
                  setShowDeleteModal(true);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] hover:border-[#d5d5d5] transition-colors group"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-[#F44444]">Delete Account</p>
                  <p className="text-xs text-[#737373] mt-0.5">Permanently delete your account and data</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#F44444] transition-colors" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Account Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeactivateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Step 1: Reason Selection */}
            {deactivateStep === 1 && (
              <>
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Deactivating your account</h2>
                  <p className="text-sm text-[#737373] mb-4">
                    Deactivating your account is temporary, and it means that your profile will be hidden until you reactivate it by logging in to your account.
                  </p>
                  <p className="text-sm font-medium text-[#0a0a0a] mb-3">Why are you deactivating?</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {deactivateReasons.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setDeactivateReason(reason)}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left ${
                          deactivateReason === reason
                            ? "border-[#F44444] bg-[#FFF0F0] text-[#F44444]"
                            : "border-[#e5e5e5] text-[#0a0a0a] hover:bg-[#fafafa]"
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-6 py-4 bg-[#fafafa] flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeactivateModal(false);
                      setDeactivateStep(1);
                      setDeactivateReason("");
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeactivateStep(2)}
                    disabled={!deactivateReason}
                    className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Reactivation Date */}
            {deactivateStep === 2 && (
              <>
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Deactivate Account</h2>
                  <p className="text-sm text-[#737373] mb-4">
                    Deactivating your account will hide your profile and posts. You can reactivate it anytime by signing back in.
                  </p>
                  <p className="text-sm font-medium text-[#0a0a0a] mb-3">When do you want to reactivate your account?</p>
                  <input
                    type="date"
                    value={reactivationDate}
                    onChange={(e) => setReactivationDate(e.target.value)}
                    min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] focus:outline-none focus:border-[#F44444] transition-colors"
                  />
                  {reactivationDate && (
                    <div className="mt-4 p-3 bg-[#f5f5f5] rounded-lg">
                      <p className="text-xs text-[#737373]">
                        You can reactivate your account on{" "}
                        <span className="font-medium text-[#0a0a0a]">
                          {new Date(reactivationDate).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 bg-[#fafafa] flex gap-3">
                  <button
                    onClick={() => setDeactivateStep(1)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setDeactivateStep(3)}
                    disabled={!reactivationDate}
                    className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Password Confirmation */}
            {deactivateStep === 3 && (
              <>
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Deactivate Account</h2>
                  <p className="text-sm text-[#737373] mb-4">
                    To confirm deactivation, please enter your password.
                  </p>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={deactivatePassword}
                      onChange={(e) => {
                        setDeactivatePassword(e.target.value);
                        setDeactivateError("");
                      }}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] focus:outline-none focus:border-[#F44444] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#0a0a0a] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {deactivateError && (
                    <p className="mt-2 text-xs text-[#F44444]">{deactivateError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(userProfile?.email || "");
                      setShowForgotPassword(true);
                    }}
                    className="mt-3 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="px-6 py-4 bg-[#fafafa] flex gap-3">
                  <button
                    onClick={() => setDeactivateStep(2)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDeactivate}
                    disabled={deactivating || !deactivatePassword}
                    className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deactivating ? "Deactivating..." : "Deactivate"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForgotPassword(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {!forgotSent ? (
              <>
                <div className="px-8 pt-8 pb-8">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#0a0a0a] mb-6 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Forgot your password?</h2>
                  <p className="text-sm text-[#737373] text-center mb-6">Enter your email and we'll send you a reset link.</p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmail.trim()}
                      className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Send reset link
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="px-8 pt-8 pb-8 text-center">
                <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Check your email</h2>
                <p className="text-sm text-[#737373] mb-6">
                  If an account exists for <span className="text-[#0a0a0a] font-medium">{forgotEmail}</span>, you'll receive a password reset link shortly.
                </p>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotSent(false);
                    setForgotEmail("");
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0a0a0a] text-white font-medium hover:bg-[#262626] transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Step 1: Reason Selection */}
            {deleteStep === 1 && (
              <>
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-xl font-bold text-[#F44444] mb-2">Deleting your account</h2>
                  <p className="text-sm text-[#737373] mb-4">
                    Deleting your account is permanent. All your data including posts, connections, and profile information will be permanently deleted.
                  </p>
                  <p className="text-sm font-medium text-[#0a0a0a] mb-3">Why are you deleting your account?</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {deleteReasons.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setDeleteReason(reason)}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left ${
                          deleteReason === reason
                            ? "border-[#F44444] bg-[#FFF0F0] text-[#F44444]"
                            : "border-[#e5e5e5] text-[#0a0a0a] hover:bg-[#fafafa]"
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-6 py-4 bg-[#fafafa] flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteStep(1);
                      setDeleteReason("");
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    disabled={!deleteReason}
                    className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Password Confirmation */}
            {deleteStep === 2 && (
              <>
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-xl font-bold text-[#F44444] mb-2">Delete Account</h2>
                  <p className="text-sm text-[#737373] mb-4">
                    This action cannot be undone. All your data including posts, connections, and profile information will be permanently deleted.
                  </p>
                  <div className="bg-[#FFF0F0] px-4 py-3 rounded-lg mb-4">
                    <p className="text-sm text-[#F44444] font-medium">Warning: This action is irreversible.</p>
                  </div>
                  <p className="text-sm font-medium text-[#0a0a0a] mb-3">To confirm deletion, please enter your password.</p>
                  <div className="relative">
                    <input
                      type={showDeletePassword ? "text" : "password"}
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError("");
                      }}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] focus:outline-none focus:border-[#F44444] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#0a0a0a] transition-colors"
                    >
                      {showDeletePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {deleteError && (
                    <p className="mt-2 text-xs text-[#F44444]">{deleteError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(userProfile?.email || "");
                      setShowForgotPassword(true);
                    }}
                    className="mt-3 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="px-6 py-4 bg-[#fafafa] flex gap-3">
                  <button
                    onClick={() => setDeleteStep(1)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || !deletePassword}
                    className="flex-1 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => { signOut({ callbackUrl: "/" }); }}
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

function NotificationsTab({ userId }: { userId: number }) {
  const [notifications, setNotifications] = useState({
    push: {
      posts: true,
      stories: true,
      comments: true,
      likes: true,
      follows: true,
      mentions: true,
      messages: true,
      circlePosts: true,
    },
    email: {
      posts: false,
      stories: false,
      comments: false,
      likes: false,
      follows: true,
      mentions: false,
      circleUpdates: true,
    },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/settings/notifications?userId=${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.notifications) {
          setNotifications(data.notifications);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleToggle = (type: "push" | "email", category: string) => {
    setNotifications(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [category]: !(prev[type] as Record<string, boolean>)[category],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, notifications }),
      });
      if (isNative) {
        await Toast.show({ text: "Notification preferences updated." });
      }
    } catch (err) {
      console.error("Failed to save notification settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    { key: "posts", label: "Posts", description: "When people you follow post" },
    { key: "stories", label: "Stories", description: "When people you follow share stories" },
    { key: "comments", label: "Comments", description: "When someone comments on your posts" },
    { key: "likes", label: "Likes", description: "When someone likes your posts" },
    { key: "follows", label: "Follows", description: "When someone follows you" },
    { key: "mentions", label: "Mentions", description: "When someone mentions you" },
    { key: "messages", label: "Messages", description: "When you receive new messages" },
    { key: "circlePosts", label: "Circle Posts", description: "Posts from Circle members" },
    { key: "circleUpdates", label: "Circle Updates", description: "Important Circle announcements" },
  ];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Push Notifications</p>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {categories.filter(c => c.key !== "circleUpdates").map((cat) => (
                <div key={cat.key} className="px-4 py-4 flex items-center justify-between hover:bg-[#fafafa] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0a0a0a]">{cat.label}</p>
                    <p className="text-xs text-[#737373] mt-0.5">{cat.description}</p>
                  </div>
                  <button
                    onClick={() => handleToggle("push", cat.key)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      notifications.push[cat.key as keyof typeof notifications.push] ? "bg-[#F44444]" : "bg-[#e5e5e5]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        notifications.push[cat.key as keyof typeof notifications.push] ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">Email Notifications</p>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {categories.filter(c => c.key !== "messages" && c.key !== "circlePosts").map((cat) => (
                <div key={cat.key} className="px-4 py-4 flex items-center justify-between hover:bg-[#fafafa] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0a0a0a]">{cat.label}</p>
                    <p className="text-xs text-[#737373] mt-0.5">{cat.description}</p>
                  </div>
                  <button
                    onClick={() => handleToggle("email", cat.key)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      notifications.email[cat.key as keyof typeof notifications.email] ? "bg-[#F44444]" : "bg-[#e5e5e5]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        notifications.email[cat.key as keyof typeof notifications.email] ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-3 text-sm font-medium rounded-xl bg-[#F44444] text-white hover:bg-[#d64d3c] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </>
      )}
    </div>
  );
}

function ConnectedAccountsTab({ userId }: { userId: number }) {
  // ... rest of the code remains the same ...
  const [connections, setConnections] = useState<{ id: number; platform: string; platformHandle: string; platformAvatarUrl: string | null; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Pre-connect modal state
  const [connectModal, setConnectModal] = useState<string | null>(null); // platform key
  const [handle, setHandle] = useState("");
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
  const searchParams = useSearchParams();
  const initialTab = parseInt(searchParams.get("tab") || "0", 10);
  const [activeTab, setActiveTab] = useState(initialTab);
  const { signOut, currentUserId, userProfile, userRole } = useContext(AuthContext);
  const router = useRouter();
  const [accountInfo, setAccountInfo] = useState<{ label: string; value: string }[]>([]);
  const [languageRegion, setLanguageRegion] = useState(fallbackLang);
  const [currentUser, setCurrentUser] = useState<{ name: string; handle: string; title: string; avatar: string } | null>(null);

  // Filter settings tabs based on user role
  const getFilteredTabs = () => {
    if (userRole === "NORMAL") {
      // For normal signed users, only show Account, Personalization, and Notifications
      return settingsTabs.filter(tab => 
        tab === "Account" || 
        tab === "Personalization" || 
        tab === "Notifications"
      );
    }
    // For other roles (CIRCLE, ADMIN, AUTHOR), show all tabs
    return settingsTabs;
  };

  const filteredTabs = getFilteredTabs();

  useEffect(() => {
    api.getSettings(currentUserId)
      .then(data => {
        if (data.account?.length) setAccountInfo(data.account);
        if (data.language?.length) setLanguageRegion(data.language);
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, [currentUserId]);

  const tabName = filteredTabs[activeTab];

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
            {filteredTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(i);
                  window.history.replaceState(null, '', `?tab=${i}`);
                }}
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
            <AccountTab accountInfo={accountInfo} setAccountInfo={setAccountInfo} languageRegion={languageRegion} signOut={signOut} router={router} currentUser={currentUser} setCurrentUser={setCurrentUser} currentUserId={currentUserId} userProfile={userProfile} />
          )}
          {tabName === "Personalization" && <PersonalizationTab />}
          {tabName === "Profile & Circle" && <ProfileCircleTab userId={currentUserId} currentUser={currentUser} />}
          {tabName === "Privacy & Safety" && <PrivacySafetyTab userId={currentUserId} />}
          {tabName === "Connected Accounts" && <ConnectedAccountsTab userId={currentUserId} />}
          {tabName === "Notifications" && <NotificationsTab userId={currentUserId} />}
          {tabName !== "Account" && tabName !== "Personalization" && tabName !== "Profile & Circle" && tabName !== "Privacy & Safety" && tabName !== "Connected Accounts" && tabName !== "Notifications" && (
            <div className="text-center py-16">
              <p className="text-[#737373] text-sm">{tabName} settings coming soon.</p>
            </div>
          )}
        </div>
      </main>

      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 overflow-y-auto flex-shrink-0 px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
        <RecentStories />
        <SuggestedProfiles />
        <div className="flex-1 flex flex-col min-h-0">
          <AdCard />
        </div>
      </aside>
    </>
  );
}
