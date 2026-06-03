"use client";

import Image from "next/image";
import { useState, useRef, useContext, useEffect } from "react";
import { Search, X, Play, Heart, MessageCircle, Share2, Bookmark, Eye, ChevronDown, ChevronLeft, ChevronRight, Volume2, VolumeX, Pause, MapPin, User } from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { VerifiedBadge, isValidSrc } from "@/app/lib/shared-components";
import { Share } from "@capacitor/share";
import ShortsLoading from "./loading";

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

// ─── Programmatic Short Videos ───
const creators = [
  { id: 1, name: "Jessin Sam S", handle: "jessinsam", avatar: "/Jess-profile.jpg", verified: true, country: "in" },
  { id: 2, name: "Open AI", handle: "openai", avatar: "https://picsum.photos/seed/openai/200", verified: true, country: "us" },
  { id: 3, name: "Nikhil Kamath", handle: "nikhilkamath", avatar: "https://picsum.photos/seed/nikhil/200", verified: true, country: "in" },
  { id: 4, name: "Elon Musk", handle: "elonmusk", avatar: "https://picsum.photos/seed/elon/200", verified: true, country: "us" },
  { id: 5, name: "Y Combinator", handle: "ycombinator", avatar: "https://picsum.photos/seed/yc/200", verified: true, country: "us" },
  { id: 6, name: "Satya Nadella", handle: "satyanadella", avatar: "https://picsum.photos/seed/satya/200", verified: true, country: "us" },
  { id: 7, name: "Aadit Palicha", handle: "aaditpalicha", avatar: "https://picsum.photos/seed/aadit/200", verified: true, country: "in" },
  { id: 8, name: "Sarah Mitchell", handle: "sarahmitchell", avatar: "https://picsum.photos/seed/author-sarah/200", verified: true, country: "us" },
  { id: 9, name: "Arun Mehta", handle: "arunmehta", avatar: "https://picsum.photos/seed/author-arun/200", verified: true, country: "in" },
  { id: 10, name: "Emily Zhang", handle: "emilyzhang", avatar: "https://picsum.photos/seed/author-emily/200", verified: true, country: "us" },
  { id: 11, name: "James O'Brien", handle: "jamesobrien", avatar: "https://picsum.photos/seed/author-james/200", verified: true, country: "gb" },
  { id: 12, name: "Lena Kowalski", handle: "lenakowalski", avatar: "https://picsum.photos/seed/lena-k/200", verified: false, country: "de" },
  { id: 13, name: "Takeshi Honda", handle: "takeshihonda", avatar: "https://picsum.photos/seed/takeshi-h/200", verified: false, country: "jp" },
  { id: 14, name: "Priya Sharma", handle: "priyasharma", avatar: "https://picsum.photos/seed/priya-s/200", verified: false, country: "in" },
  { id: 15, name: "Marco Silva", handle: "marcosilva", avatar: "https://picsum.photos/seed/marco-s/200", verified: false, country: "br" },
  { id: 16, name: "Ahmed Al-Rashid", handle: "ahmedalrashid", avatar: "https://picsum.photos/seed/ahmed-r/200", verified: true, country: "ae" },
  { id: 17, name: "Rachel Chen", handle: "rachelchen", avatar: "https://picsum.photos/seed/rachel-c/200", verified: false, country: "sg" },
  { id: 18, name: "David Thompson", handle: "davidthompson", avatar: "https://picsum.photos/seed/david-t/200", verified: false, country: "ca" },
  { id: 19, name: "Sophie Williams", handle: "sophiewilliams", avatar: "https://picsum.photos/seed/sophie-w/200", verified: false, country: "au" },
  { id: 20, name: "Raj Patel", handle: "rajpatel", avatar: "https://picsum.photos/seed/raj-p/200", verified: false, country: "in" },
];

const shortTitles: Record<string, string[]> = {
  tech: [
    "This AI tool writes code faster than you think",
    "Why every developer needs to learn Rust in 2026",
    "The future of computing is quantum — here's why",
    "I built a SaaS in 48 hours. Here's how.",
    "5 VS Code extensions you're missing",
    "WebAssembly will replace JavaScript. Fight me.",
    "The chip shortage is over. What comes next?",
    "How Apple's Vision Pro changed my workflow",
  ],
  business: [
    "How I closed a $5M deal in 30 minutes",
    "The one metric every CEO ignores",
    "Why your startup will fail without this",
    "3 negotiation tactics that actually work",
    "The future of remote work isn't what you think",
    "Building a billion-dollar company from scratch",
    "The hidden cost of scaling too fast",
    "Why culture eats strategy for breakfast",
  ],
  startups: [
    "We raised $10M and almost went bankrupt",
    "YC application tips that got us in",
    "Why I left FAANG to start a company",
    "The pivot that saved our startup",
    "How to find product-market fit in 90 days",
    "Fundraising mistakes first-time founders make",
    "Building in public: lessons from 1 year",
    "From 0 to 100k users with zero marketing",
  ],
  finance: [
    "The index fund strategy that beats 90% of traders",
    "Crypto is dead. Long live crypto.",
    "How to read a balance sheet in 60 seconds",
    "The biggest financial bubble of 2026",
    "Why the rich don't save — they invest",
    "Stock picks that outperformed the market",
    "The truth about passive income",
    "How compound interest made me a millionaire",
  ],
  lifestyle: [
    "My morning routine as a tech CEO",
    "Why I wake up at 4:30 AM every day",
    "The productivity hack nobody talks about",
    "How to network without being awkward",
    "Building a personal brand from zero",
    "Work-life balance is a myth. Here's what works.",
    "The minimalist desk setup that boosted my focus",
    "How to read 50 books a year",
  ],
  education: [
    "Learn Python in 10 minutes — seriously",
    "The best free courses on the internet",
    "Why college degrees are losing value",
    "How to learn anything 10x faster",
    "The skill gap nobody is talking about",
    "Online degrees vs bootcamps: honest comparison",
    "Machine learning explained in 60 seconds",
    "The future of education is AI-powered",
  ],
  entertainment: [
    "Behind the scenes at a tech conference",
    "The most viral startup pitch ever",
    "When your deploy goes wrong — live",
    "CEO vs intern: who knows more?",
    "Rating tech company offices in SF",
    "Day in the life at a YC startup",
    "The worst product launches of all time",
    "Reacting to terrible business advice",
  ],
  news: [
    "Breaking: New AI regulations announced",
    "This startup just raised $100M in stealth",
    "The merger that will reshape fintech",
    "Global markets react to tech earnings",
    "New semiconductor facility opens in India",
    "Europe's digital markets act takes effect",
    "The IPO everyone's watching this quarter",
    "Climate tech funding hits record high",
  ],
  travel: [
    "The best co-working spaces in Bali",
    "Startup hubs you've never heard of",
    "Digital nomad guide: Lisbon edition",
    "Why Dubai is the next Silicon Valley",
    "Working remotely from Tokyo for a month",
    "The cheapest cities for tech workers",
    "Startup ecosystem tour: Bangalore",
    "Best airports for getting work done",
  ],
};

// Seeded PRNG to avoid hydration mismatches (server vs client)
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const generateShorts = () => {
  const rng = seededRandom(42);
  const allShorts: any[] = [];
  let id = 1;

  const categoryKeys = Object.keys(shortTitles);

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  categoryKeys.forEach(cat => {
    shortTitles[cat].forEach((title, idx) => {
      const creator = creators[id % creators.length];
      const viewCount = Math.floor(rng() * 500 + 10) * (rng() > 0.5 ? 100 : 10);
      const likeCount = Math.floor(viewCount * (0.02 + rng() * 0.15));
      const commentCount = Math.floor(likeCount * (0.05 + rng() * 0.3));

      allShorts.push({
        id,
        creatorId: creator.id,
        creator,
        category: cat,
        country: creator.country,
        title,
        thumbnail: `https://picsum.photos/seed/short-${id}/400/700`,
        duration: `0:${String(Math.floor(rng() * 50 + 10)).padStart(2, "0")}`,
        views: formatCount(viewCount),
        likes: formatCount(likeCount),
        comments: formatCount(commentCount),
        timeAgo: idx < 2 ? `${idx + 1}h ago` : idx < 4 ? `${idx}d ago` : `${idx + 1}d ago`,
      });
      id++;
    });
  });

  // Deterministic shuffle
  for (let i = allShorts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allShorts[i], allShorts[j]] = [allShorts[j], allShorts[i]];
  }

  return allShorts;
};

const shorts = generateShorts();

// ─── Short Video Card ───
function ShortCard({ short, onClick }: { short: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-xl overflow-hidden cursor-pointer group aspect-[9/16] bg-[#1a1a1a]"
    >
      <Image
        src={short.thumbnail}
        alt={short.title}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-300"
      />

      {/* Play overlay */}
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
        </div>
      </div>

      {/* Duration badge */}
      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
        {short.duration}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <p className="text-white text-xs font-medium line-clamp-2 mb-2 leading-snug">{short.title}</p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-white/30 flex-shrink-0 bg-white/10 flex items-center justify-center">
            {short.creator.avatar && isValidSrc(short.creator.avatar) ? (
              <Image src={short.creator.avatar} alt={short.creator.name} width={20} height={20} className="object-cover w-full h-full" />
            ) : (
              <User className="w-3 h-3 text-white/60" />
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
  const { isSignedIn, openAuthModal } = useContext(AuthContext);
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

  const handleInteraction = (action: () => void) => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    action();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: short.title,
        text: `Check out this short by ${short.creator.name} on Albiz!`,
        url: `${window.location.origin}/shorts?id=${short.id}`,
        dialogTitle: 'Share Short',
      });
    } catch (e) {
      console.error("Error sharing", e);
      // Fallback for browsers that don't support Web Share API
      if (navigator.clipboard) {
        navigator.clipboard.writeText(`${window.location.origin}/shorts?id=${short.id}`);
        // Optionally show a toast here if you have one
      }
    }
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

        {isValidSrc(short.thumbnail) && (
          <Image src={short.thumbnail} alt={short.title} fill className="object-cover" />
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
              {short.creator.avatar && isValidSrc(short.creator.avatar) ? (
              <Image src={short.creator.avatar} alt={short.creator.name} width={32} height={32} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                <User className="w-4 h-4 text-white/60" />
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
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => setLiked(!liked)); }}
            className="flex flex-col items-center gap-1"
          >
            <Heart className={`w-7 h-7 ${liked ? "text-[#F44444] fill-[#F44444]" : "text-white"}`} />
            <span className="text-white text-[10px]">{short.likes}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => {}); }}
            className="flex flex-col items-center gap-1"
          >
            <MessageCircle className="w-7 h-7 text-white" />
            <span className="text-white text-[10px]">{short.comments}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
            className="flex flex-col items-center gap-1"
          >
            <Share2 className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleInteraction(() => setSaved(!saved)); }}
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
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeCountry, setActiveCountry] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [viewingShort, setViewingShort] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate loading for shorts since data is programmatic
    const timer = setTimeout(() => {
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
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

  // Filter shorts
  const filtered = shorts.filter(s => {
    if (activeCategory !== "all" && s.category !== activeCategory) return false;
    if (activeCountry !== "all" && s.country !== activeCountry) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.title.toLowerCase().includes(q) && !s.creator.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeShort = viewingShort ? filtered.find(s => s.id === viewingShort) || shorts.find(s => s.id === viewingShort) : null;
  const activeCountryName = countries.find(c => c.code === activeCountry)?.name || "All Countries";

  if (loading) {
    return <ShortsLoading />;
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-white overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-30 py-4 px-4 sm:px-6 border-b border-[#e5e5e5]">
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
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Play className="w-12 h-12 text-[#d5d5d5] mx-auto mb-3" />
              <p className="text-[#737373] text-sm">No shorts found matching your filters.</p>
              <button
                onClick={() => { setActiveCategory("all"); setActiveCountry("all"); setSearchQuery(""); }}
                className="mt-3 text-sm text-[#F44444] font-medium hover:underline"
              >
                Clear filters
              </button>
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
