"use client";

import Image from "next/image";
import { useState, useRef, useContext, useEffect } from "react";
import { Search, X, Play, Heart, MessageCircle, Share2, Bookmark, Eye, ChevronDown, ChevronLeft, ChevronRight, Volume2, VolumeX, MapPin } from "lucide-react";
import { AuthContext, type InteractionContext } from "@/app/lib/contexts";
import { VerifiedBadge } from "@/app/lib/shared-components";

// ─── Categories ───
const categories = [
  { id: "all", label: "All" },
  { id: "tech", label: "Tech" },
  { id: "business", label: "Business" },
  { id: "startups", label: "Startups" },
  { id: "finance", label: "Finance" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "education", label: "Education" },
  { id: "entertainment", label: "Entertainment" },
  { id: "news", label: "News" },
  { id: "travel", label: "Travel" },
];

// ─── Countries ───
const countries = [
  { code: "all", name: "All Countries" },
  { code: "us", name: "United States" },
  { code: "in", name: "India" },
  { code: "gb", name: "United Kingdom" },
  { code: "ae", name: "UAE" },
  { code: "sg", name: "Singapore" },
  { code: "de", name: "Germany" },
  { code: "jp", name: "Japan" },
  { code: "br", name: "Brazil" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
];

// ─── Helpers ───
function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function formatTimeAgo(date: string | null): string {
  if (!date) return "recently";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function mapShort(s: any) {
  return {
    id: s.id,
    title: s.title,
    thumbnail: s.thumbnailUrl || s.videoUrl || "",
    duration: null as string | null,
    views: formatCount(s.views ?? 0),
    likes: formatCount(s.likes ?? 0),
    comments: formatCount(s.shares ?? 0),
    timeAgo: formatTimeAgo(s.publishedAt ?? null),
    category: null as string | null,
    country: (s.user?.country ?? "").toLowerCase(),
    creator: {
      name: s.user?.name ?? "Unknown",
      avatar: s.user?.avatar ?? "",
      verified: s.user?.verified ?? false,
    },
  };
}

// ─── Short Video Card ───
function ShortCard({ short, onClick }: { short: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-xl overflow-hidden cursor-pointer group aspect-[9/16] bg-[#1a1a1a]"
    >
      {short.thumbnail ? (
        <Image
          src={short.thumbnail}
          alt={short.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="absolute inset-0 bg-[#262626]" />
      )}

      {/* Play overlay */}
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
        </div>
      </div>

      {/* Duration badge */}
      {short.duration && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
          {short.duration}
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <p className="text-white text-xs font-medium line-clamp-2 mb-2 leading-snug">{short.title}</p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-white/30 flex-shrink-0">
            {short.creator.avatar ? (
              <Image src={short.creator.avatar} alt={short.creator.name} width={20} height={20} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full bg-[#404040] flex items-center justify-center">
                <span className="text-white text-[8px] font-medium">{short.creator.name.charAt(0)}</span>
              </div>
            )}
          </div>
          <span className="text-white/80 text-[10px] truncate">{short.creator.name}</span>
          {short.creator.verified && <VerifiedBadge className="scale-[0.6]" />}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-white/60 text-[10px]">
          <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {short.views}</span>
          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {short.likes}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Full Screen Short Viewer ───
function ShortViewer({ short, shorts: allShorts, onClose, onNavigate }: { short: any; shorts: any[]; onClose: () => void; onNavigate: (id: number) => void }) {
  const { requireGuestAuth } = useContext(AuthContext);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const currentIndex = allShorts.findIndex((s: any) => s.id === short.id);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          // Auto-advance to next
          if (currentIndex < allShorts.length - 1) {
            onNavigate(allShorts[currentIndex + 1].id);
            return 0;
          }
          return 100;
        }
        return prev + 0.5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [paused, currentIndex, allShorts, onNavigate]);

  // Reset progress when short changes
  useEffect(() => {
    setProgress(0);
    setLiked(false);
    setSaved(false);
  }, [short.id]);

  const handleInteraction = (action: () => void, context: InteractionContext = "default") => {
    requireGuestAuth(context, action);
  };

  const goNext = () => {
    if (currentIndex < allShorts.length - 1) onNavigate(allShorts[currentIndex + 1].id);
  };

  const goPrev = () => {
    if (currentIndex > 0) onNavigate(allShorts[currentIndex - 1].id);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
      if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center">
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 hover:bg-white/10 rounded-full transition-colors">
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Navigation buttons */}
      <button
        onClick={goPrev}
        disabled={currentIndex === 0}
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          currentIndex === 0 ? "opacity-0 pointer-events-none" : "bg-white/15 hover:bg-white/25 backdrop-blur-sm"
        }`}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={goNext}
        disabled={currentIndex === allShorts.length - 1}
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          currentIndex === allShorts.length - 1 ? "opacity-0 pointer-events-none" : "bg-white/15 hover:bg-white/25 backdrop-blur-sm"
        }`}
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Video container */}
      <div className="relative w-full max-w-sm aspect-[9/16] rounded-xl overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-white/20">
          <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        {/* Thumbnail as "video" */}
        {short.thumbnail ? (
          <Image src={short.thumbnail} alt={short.title} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}

        {/* Tap to pause/play */}
        <button
          onClick={() => setPaused(p => !p)}
          className="absolute inset-0 z-10"
        >
          {paused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-7 h-7 text-white ml-1" fill="white" />
              </div>
            </div>
          )}
        </button>

        {/* Top controls */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/50">
              {short.creator.avatar ? (
                <Image src={short.creator.avatar} alt={short.creator.name} width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-[#404040] flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{short.creator.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-white text-sm font-semibold">{short.creator.name}</span>
                {short.creator.verified && <VerifiedBadge className="scale-75" />}
              </div>
              <span className="text-white/50 text-[10px]">{short.timeAgo}</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
            className="p-2 hover:bg-white/10 rounded-full transition-colors z-20"
          >
            {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
        </div>

        {/* Right side actions */}
        <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-5">
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => setLiked(!liked), "like"); }}
            className="flex flex-col items-center gap-1"
          >
            <Heart className={`w-7 h-7 ${liked ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
            <span className="text-white text-[10px]">{short.likes}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => {}, "comment"); }}
            className="flex flex-col items-center gap-1"
          >
            <MessageCircle className="w-7 h-7 text-white" />
            <span className="text-white text-[10px]">{short.comments}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => {}); }}
            className="flex flex-col items-center gap-1"
          >
            <Share2 className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => setSaved(!saved), "save"); }}
            className="flex flex-col items-center gap-1"
          >
            <Bookmark className={`w-6 h-6 ${saved ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
          </button>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-14 z-20 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-20">
          <p className="text-white text-sm font-medium leading-snug mb-2">{short.title}</p>
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {short.views} views</span>
            <span>&middot;</span>
            <span>{short.timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function ShortsPage() {
  const [shortsData, setShortsData] = useState<any[] | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeCountry, setActiveCountry] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [viewingShort, setViewingShort] = useState<number | null>(null);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/shorts/feed")
      .then(r => r.json())
      .then(d => setShortsData((d.shorts ?? []).map(mapShort)))
      .catch(() => setShortsData([]));
  }, []);

  // Close country dropdown on outside click
  useEffect(() => {
    if (!showCountryDropdown) return;
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setShowCountryDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCountryDropdown]);

  const allShorts = shortsData ?? [];

  // Filter shorts
  const filtered = allShorts.filter(s => {
    if (activeCategory !== "all" && s.category !== activeCategory) return false;
    if (activeCountry !== "all" && s.country !== activeCountry) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.title.toLowerCase().includes(q) && !s.creator.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeShort = viewingShort ? filtered.find(s => s.id === viewingShort) || allShorts.find(s => s.id === viewingShort) : null;
  const activeCountryName = countries.find(c => c.code === activeCountry)?.name || "All Countries";
  const hasActiveFilters = activeCategory !== "all" || activeCountry !== "all" || !!searchQuery;

  return (
    <>
      <main className="flex-1 min-w-0 bg-white overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-30 pt-1 pb-3 md:py-4 px-4 sm:px-6 border-b border-[#e5e5e5]">
          <div className="flex items-center justify-between mb-3">
            {showSearch ? (
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search shorts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                  />
                </div>
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                  <X className="w-5 h-5 text-[#737373]" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-[#0a0a0a]">Shorts</h1>
                <div className="flex items-center gap-2">
                  {/* Country filter */}
                  <div className="relative" ref={countryRef}>
                    <button
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        activeCountry !== "all"
                          ? "bg-[#F44444]/10 text-[#F44444] border border-[#F44444]/20"
                          : "bg-[#f5f5f5] text-[#525252] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{activeCountry === "all" ? "Country" : activeCountryName}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showCountryDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1 z-40 max-h-72 overflow-y-auto">
                        {countries.map(c => (
                          <button
                            key={c.code}
                            onClick={() => { setActiveCountry(c.code); setShowCountryDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                              activeCountry === c.code ? "bg-[#FFF0F0] text-[#F44444]" : "hover:bg-[#f5f5f5] text-[#0a0a0a]"
                            }`}
                          >
                            {c.name}
                            {activeCountry === c.code && (
                              <div className="w-4 h-4 rounded-full bg-[#F44444] flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowSearch(true)} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                    <Search className="w-5 h-5 text-[#737373]" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  cat.id === activeCategory
                    ? "bg-[#F44444] text-white"
                    : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active filter indicators */}
        {(activeCountry !== "all" || searchQuery) && (
          <div className="px-4 sm:px-6 pt-3 flex items-center gap-2 flex-wrap">
            {activeCountry !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f5f5f5] text-xs text-[#525252]">
                <MapPin className="w-3 h-3" />
                {activeCountryName}
                <button onClick={() => setActiveCountry("all")} className="ml-0.5 hover:text-[#0a0a0a]"><X className="w-3 h-3" /></button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f5f5f5] text-xs text-[#525252]">
                <Search className="w-3 h-3" />
                &ldquo;{searchQuery}&rdquo;
                <button onClick={() => setSearchQuery("")} className="ml-0.5 hover:text-[#0a0a0a]"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}

        {/* Video grid */}
        <div className="p-4 sm:p-6">
          {shortsData === null ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="aspect-[9/16] rounded-xl bg-[#f5f5f5] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Play className="w-12 h-12 text-[#d5d5d5] mx-auto mb-3" />
              {hasActiveFilters ? (
                <>
                  <p className="text-[#737373] text-sm">No shorts found matching your filters.</p>
                  <button
                    onClick={() => { setActiveCategory("all"); setActiveCountry("all"); setSearchQuery(""); }}
                    className="mt-3 text-sm text-[#F44444] font-medium hover:underline"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <p className="text-[#737373] text-sm">No shorts right now.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(short => (
                <ShortCard key={short.id} short={short} onClick={() => setViewingShort(short.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Full screen viewer */}
      {activeShort && (
        <ShortViewer
          short={activeShort}
          shorts={filtered}
          onClose={() => setViewingShort(null)}
          onNavigate={(id) => setViewingShort(id)}
        />
      )}
    </>
  );
}
