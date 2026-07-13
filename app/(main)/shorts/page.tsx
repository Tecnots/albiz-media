"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Play, ChevronDown, MapPin } from "lucide-react";
import { ShortCard, ShortViewer, mapShort } from "@/app/lib/shorts-viewer";

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

  const handleLikeChange = (id: number, liked: boolean) => {
    setShortsData(prev => prev ? prev.map(s => s.id === id ? { ...s, liked, likes: Math.max(0, s.likes + (liked ? 1 : -1)) } : s) : prev);
  };
  const handleSaveChange = (id: number, saved: boolean) => {
    setShortsData(prev => prev ? prev.map(s => s.id === id ? { ...s, saved } : s) : prev);
  };
  const handleViewed = (id: number) => {
    setShortsData(prev => prev ? prev.map(s => s.id === id ? { ...s, views: s.views + 1 } : s) : prev);
  };
  const handleCommentCountChange = (id: number, count: number) => {
    setShortsData(prev => prev ? prev.map(s => s.id === id ? { ...s, comments: count } : s) : prev);
  };

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
          onLikeChange={handleLikeChange}
          onSaveChange={handleSaveChange}
          onViewed={handleViewed}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
    </>
  );
}
