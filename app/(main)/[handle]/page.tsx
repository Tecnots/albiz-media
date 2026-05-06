"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useContext, useEffect, useRef } from "react";
import {
  ArrowLeft,
  MapPin,
  Globe,
  Calendar,
  Eye,
  EyeOff,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  MoreVertical,
  Bookmark,
  Users,
  User,
  Briefcase,
  GraduationCap,
  Shield,
  Crown,
  Award,
  Trophy,
  Flame,
  Target,
  Medal,
  Zap,
  TrendingUp,
  DollarSign,
  BarChart3,
  Building2,
  ExternalLink,
  Circle,
  Check,
  Mail,
  X,
  Loader2,
  AtSign,
  Pencil,
  Plus,
  Trash2,
  Camera,
  ChevronRight,
  ChevronLeft,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ImagePlus,
  Smile,
  Hash,
  ArrowUp,
} from "lucide-react";
import { FollowingContext, AuthContext, StoryContext } from "@/app/lib/contexts";
import { users, posts } from "@/app/lib/data";
import { RightSidebar, AlbizLogo, SaveBookmarkButton, SuggestedProfiles } from "@/app/lib/shared-components";

import { api } from "@/app/lib/api";
import { CircleUpgradeFormData } from "@/types/circle-upgrade";
import CircleUpgradeForm from "@/components/CircleUpgradeForm";

// ─── Seeded random for deterministic data ───

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rand: () => number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

// ─── Profile Data Generator ───

function generateProfileData(userId: number) {
  const rand = seededRandom(userId * 7919);

  const companies = [
    "Google", "Meta", "Apple", "Microsoft", "Amazon", "Tesla", "SpaceX",
    "Stripe", "Airbnb", "Shopify", "Coinbase", "Databricks", "Figma",
    "Notion", "Discord", "Canva", "Zerodha", "Zepto", "CRED", "Razorpay",
    "Flipkart", "Ola", "Swiggy", "Byju's", "OpenAI", "Anthropic",
    "NVIDIA", "Netflix", "Spotify", "Uber", "Palantir", "Snowflake",
  ];

  const roles = [
    "CEO", "CTO", "Co-founder", "VP of Engineering", "Head of Product",
    "Principal Engineer", "Director of AI", "Chief Scientist",
    "Managing Partner", "General Partner", "Senior Advisor",
    "Head of Strategy", "President", "COO",
  ];

  const schools = [
    "Stanford University", "MIT", "Harvard Business School", "IIT Bombay",
    "IIT Delhi", "IIT Madras", "Wharton School", "Cambridge University",
    "Oxford University", "UC Berkeley", "Carnegie Mellon", "Georgia Tech",
    "Yale University", "Princeton University", "Columbia University",
    "NUS Singapore", "INSEAD", "London Business School",
  ];

  const degrees = [
    "B.Tech Computer Science", "M.S. Computer Science", "MBA",
    "B.S. Electrical Engineering", "Ph.D. Machine Learning",
    "M.S. Data Science", "B.A. Economics", "M.S. Finance",
    "B.Tech Mechanical Engineering", "M.A. Public Policy",
  ];

  const allSkills = [
    "Leadership", "Product Strategy", "Machine Learning", "Cloud Architecture",
    "Fundraising", "Team Building", "Public Speaking", "AI Infrastructure",
    "Go-to-Market", "Full-Stack Development", "Data Engineering", "DevOps",
    "Blockchain", "Venture Capital", "M&A Strategy", "Growth Hacking",
    "System Design", "React / Next.js", "Python", "Rust", "TypeScript",
    "Kubernetes", "Business Development", "Financial Modeling",
  ];

  const allInterests = [
    "Artificial Intelligence", "Startups", "Venture Capital", "Space Technology",
    "Climate Tech", "Web3", "Open Source", "Mentorship", "Podcasting",
    "Angel Investing", "DeFi", "Quantum Computing", "Robotics",
    "Biotech", "EdTech", "HealthTech", "Gaming", "Photography",
  ];

  const locations = [
    "San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA",
    "Bangalore, India", "Mumbai, India", "London, UK", "Singapore",
    "Dubai, UAE", "Berlin, Germany", "Toronto, Canada", "Palo Alto, CA",
    "Mountain View, CA", "Boston, MA", "Los Angeles, CA",
  ];

  const bios = [
    "Building the future one product at a time. Deeply passionate about technology and its potential to transform industries. Believer in first-principles thinking and long-term compounding.",
    "Serial builder. Obsessed with solving hard problems at scale. Previously built and scaled products used by millions. Now focused on what's next.",
    "Technology leader with a track record of turning ambitious ideas into reality. Passionate about empowering teams and creating lasting impact through innovation.",
    "Entrepreneur at heart, engineer by training. Spent the last decade at the intersection of technology and business. Always looking for the next big challenge.",
    "Dedicated to pushing the boundaries of what's possible. Combining deep technical expertise with business acumen to build category-defining companies.",
    "Passionate about connecting people, ideas, and capital. Helping founders navigate the journey from zero to one and beyond.",
    "Driven by curiosity and a desire to make meaningful contributions. Focused on leveraging technology to solve real-world problems at scale.",
    "Leader, builder, and lifelong learner. Committed to excellence in everything — from product development to team culture.",
  ];

  const location = pick(locations, rand);
  const bio = pick(bios, rand);
  const joinMonth = pick(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], rand);
  const joinYear = 2022 + Math.floor(rand() * 3);

  const expCount = 2 + Math.floor(rand() * 3);
  const experience = Array.from({ length: expCount }, (_, i) => {
    const startYear = 2025 - i * 2 - Math.floor(rand() * 2);
    const endYear = i === 0 ? "Present" : String(startYear + 1 + Math.floor(rand() * 2));
    return {
      id: i + 1,
      role: pick(roles, rand),
      company: pick(companies, rand),
      logo: `https://picsum.photos/seed/co-${userId}-${i}/100`,
      period: `${startYear} – ${endYear}`,
      description: pick([
        "Led cross-functional teams to deliver breakthrough products.",
        "Scaled the engineering team from seed stage to Series B.",
        "Drove strategic initiatives resulting in 3x revenue growth.",
        "Built and shipped core platform used by millions of users.",
        "Managed $50M+ P&L and expanded into new markets.",
        "Architected and deployed ML systems processing 10M+ requests daily.",
        "Established partnerships with Fortune 500 companies.",
        "Led the acquisition and integration of two startups.",
      ], rand),
    };
  });

  const eduCount = 1 + Math.floor(rand() * 2);
  const education = Array.from({ length: eduCount }, (_, i) => ({
    id: i + 1,
    school: pick(schools, rand),
    degree: pick(degrees, rand),
    period: `${2010 + Math.floor(rand() * 8)} – ${2014 + Math.floor(rand() * 4)}`,
    logo: `https://picsum.photos/seed/edu-${userId}-${i}/100`,
  }));

  const skills = pickN(allSkills, 6 + Math.floor(rand() * 5), rand);
  const interests = pickN(allInterests, 4 + Math.floor(rand() * 4), rand);

  const followersNum = 1000 + Math.floor(rand() * 5000000);
  const followingNum = 200 + Math.floor(rand() * 2000);
  const postsNum = 50 + Math.floor(rand() * 2000);

  const netWorthValues = ["$500K", "$1.2M", "$2.8M", "$5M", "$12M", "$25M", "$50M", "$100M", "$500M", "$1B", "$5B", "$10B"];
  const netWorth = pick(netWorthValues, rand);

  const globalRank = 10 + Math.floor(rand() * 5000);
  const sectorRank = 5 + Math.floor(rand() * 200);
  const categoryRank = 1 + Math.floor(rand() * 50);

  const profileViews = formatNumber(5000 + Math.floor(rand() * 100000));
  const searchAppearances = formatNumber(1000 + Math.floor(rand() * 50000));

  const userPosts = Array.from({ length: 3 }, (_, i) => {
    const postTexts = [
      "Excited to share some incredible progress we've been making. The team has been firing on all cylinders and the results speak for themselves.",
      "Just had an amazing conversation about the future of technology. The pace of innovation is truly unprecedented. Here are my key takeaways from the discussion.",
      "Reflecting on the journey so far. Building something meaningful takes time, patience, and an incredible team. Grateful for everyone who believed in the vision.",
      "The best opportunities often come disguised as impossible challenges. Embrace the difficulty — that's where the real growth happens.",
      "Incredible turnout at the conference today. The energy in the room was palpable. Met so many brilliant minds working on fascinating problems.",
      "Sharing some thoughts on where our industry is headed. The next 5 years will see more change than the last 20. Are you ready?",
    ];
    return {
      id: i + 1,
      content: postTexts[(userId * 3 + i) % postTexts.length],
      date: `${pick(["Jan", "Feb", "Mar", "Nov", "Dec"], rand)} ${1 + Math.floor(rand() * 28)}th 2025`,
      time: `${1 + Math.floor(rand() * 12)}:${String(Math.floor(rand() * 60)).padStart(2, "0")} ${rand() > 0.5 ? "PM" : "AM"}`,
      image: i === 0 || i === 2 ? `https://picsum.photos/seed/upost-${userId}-${i}/800/500` : undefined,
      stats: {
        views: formatNumber(500 + Math.floor(rand() * 50000)),
        likes: formatNumber(100 + Math.floor(rand() * 10000)),
        comments: formatNumber(10 + Math.floor(rand() * 2000)),
        shares: formatNumber(5 + Math.floor(rand() * 1000)),
      },
    };
  });

  const communities = [
    { id: 1, name: "YC Founders Network", members: "2.4k", avatar: "https://picsum.photos/seed/comm-yc/200" },
    { id: 2, name: "AI Builders Collective", members: "8.1k", avatar: "https://picsum.photos/seed/comm-ai/200" },
    { id: 3, name: "Startup Founders India", members: "12k", avatar: "https://picsum.photos/seed/comm-india/200" },
    { id: 4, name: "Climate Tech Alliance", members: "3.2k", avatar: "https://picsum.photos/seed/comm-climate/200" },
    { id: 5, name: "Product Leaders", members: "5.6k", avatar: "https://picsum.photos/seed/comm-product/200" },
    { id: 6, name: "Web3 Builders", members: "4.2k", avatar: "https://picsum.photos/seed/comm-web3/200" },
  ];

  const selectedCommunities = pickN(communities, 2 + Math.floor(rand() * 2), rand).map((c, i) => ({
    ...c,
    id: i + 1,
    role: pick(["Member", "Moderator", "Admin", "Member"], rand),
  }));

  const badges = pickN([
    { label: "Early Adopter", color: "#F44444" },
    { label: "Top Creator", color: "#8B5CF6" },
    { label: "Circle Pioneer", color: "#F97316" },
    { label: "Verified Pro", color: "#10B981" },
    { label: "Thought Leader", color: "#3B82F6" },
    { label: "Community Builder", color: "#EC4899" },
    { label: "Power User", color: "#6366F1" },
    { label: "Trendsetter", color: "#14B8A6" },
  ], 3 + Math.floor(rand() * 3), rand).map((b, i) => ({ ...b, id: i + 1 }));

  const awardsList = [
    { title: "Forbes 30 Under 30", category: "Technology" },
    { title: "TechCrunch Disrupt Finalist", category: "Startup Battlefield" },
    { title: "Inc. 5000 Fastest Growing", category: "Business Growth" },
    { title: "TIME 100 Next", category: "Emerging Leaders" },
    { title: "Bloomberg 50", category: "Business" },
    { title: "Wired Innovation Fellow", category: "Technology" },
  ];
  const selectedAwards = pickN(awardsList, 2 + Math.floor(rand() * 2), rand).map((a, i) => ({
    ...a,
    id: i + 1,
    year: String(2022 + Math.floor(rand() * 3)),
    description: pick([
      "Recognized for exceptional leadership and innovation in the technology sector.",
      "Selected among thousands of nominees for outstanding contributions to the industry.",
      "Honored for building products that positively impact millions of people worldwide.",
    ], rand),
  }));

  const milestones = Array.from({ length: 3 + Math.floor(rand() * 2) }, (_, i) => ({
    id: i + 1,
    title: pick([
      `${formatNumber(followersNum)} followers on Albiz`,
      "Featured in major publication",
      "Launched new product",
      "Closed funding round",
      "Reached 1M users",
      "Expanded to new market",
      "Hit profitability",
      "Joined advisory board",
    ], rand),
    date: pick(["Jan", "Mar", "Jun", "Aug", "Oct", "Dec"], rand) + ` ${2024 + Math.floor(rand() * 2)}`,
    description: pick([
      "A significant milestone in the journey.",
      "Marking a new chapter of growth and impact.",
      "The result of years of focused effort and collaboration.",
    ], rand),
  }));

  // Mutual connections: pick other users (not self)
  const otherUsers = users.filter(u => u.id !== userId);
  const mutualConnections = pickN(otherUsers, Math.min(4, otherUsers.length), rand).map(u => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    avatar: u.avatar,
    title: u.title,
    mutualCount: 5 + Math.floor(rand() * 40),
  }));

  // Story highlights
  const highlightNames = [
    "Travel", "Work", "Team", "Launch", "Keynote", "Press",
    "Podcast", "Events", "Behind the scenes", "Wins", "Office",
    "Products", "Culture", "Mentorship", "Investing", "Q&A",
  ];
  const highlightCount = 3 + Math.floor(rand() * 5);
  const highlights = pickN(highlightNames, highlightCount, rand).map((name, i) => {
    const imgCount = 2 + Math.floor(rand() * 8);
    const images = Array.from({ length: imgCount }, (_, j) => `https://picsum.photos/seed/hlimg-${userId}-${i}-${j}/400/700`);
    return {
      id: i + 1,
      name,
      cover: `https://picsum.photos/seed/hl-${userId}-${i}/200/200`,
      storyCount: imgCount,
      images,
    };
  });

  return {
    bio,
    location,
    website: pick(["", "example.com", "techventures.io", ""], rand),
    joinedDate: `${joinMonth} ${joinYear}`,
    followers: formatNumber(followersNum),
    following: formatNumber(followingNum),
    postsCount: formatNumber(postsNum),
    netWorth,
    globalRank: `#${globalRank}`,
    sectorRank: `#${sectorRank}`,
    categoryRank: `#${categoryRank}`,
    profileViews,
    searchAppearances,
    experience,
    education,
    skills,
    interests,
    userPosts,
    communities: selectedCommunities,
    badges,
    awards: selectedAwards,
    milestones,
    mutualConnections,
    highlights,
  };
}

// ─── Components ───

function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Circle className="w-3.5 h-3.5 fill-[#F44444] text-[#F44444]" />
      <Check className="w-2 h-2 text-white absolute" strokeWidth={3} />
    </span>
  );
}

function ProfileHeader({
  user,
  profile,
  isEditing,
  editState,
  setEditState,
  displayAvatar,
  displayCover,
  hasActiveStory = false,
  onAvatarClick,
}: {
  user: typeof users[0];
  profile: ReturnType<typeof generateProfileData>;
  isEditing?: boolean;
  editState?: EditState;
  setEditState?: (s: EditState) => void;
  displayAvatar?: string;
  displayCover?: string;
  hasActiveStory?: boolean;
  onAvatarClick?: () => void;
}) {
  const coverRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const coverSrc = displayCover || `https://picsum.photos/seed/cover-${user.handle}/1200/400`;
  const avatarSrc = displayAvatar || user.avatar || null;

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editState && setEditState) {
      // Show instant preview, then upload to Azure
      const preview = URL.createObjectURL(file);
      setEditState({ ...editState, coverPhoto: preview });
      try {
        const result = await api.uploadFile(file, user.id, "cover");
        setEditState({ ...editState, coverPhoto: result.url });
      } catch {}
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editState && setEditState) {
      const preview = URL.createObjectURL(file);
      setEditState({ ...editState, avatar: preview });
      try {
        const result = await api.uploadFile(file, user.id, "avatar");
        setEditState({ ...editState, avatar: result.url });
      } catch {}
    }
  };

  return (
    <div className="relative px-4 md:px-8 pt-4">
      <div className="h-48 md:h-64 lg:h-72 w-full overflow-hidden rounded-2xl relative group">
        <Image src={isEditing && editState?.coverPhoto ? editState.coverPhoto : coverSrc} alt="" width={1200} height={400} className="object-cover w-full h-full" priority />
        {isEditing && (
          <>
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverFile} className="hidden" />
            <button
              onClick={() => coverRef.current?.click()}
              className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-lg text-sm font-medium text-[#0a0a0a]">
                <Camera className="w-4 h-4" />
                Change Cover
              </div>
            </button>
          </>
        )}
      </div>
      <div className="absolute -bottom-16 left-4 md:left-8">
        <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full p-[3px] ${hasActiveStory && !isEditing ? "bg-gradient-to-br from-[#F44444] to-[#F44444]/40" : "bg-white"}`}>
        <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-white bg-white relative group cursor-pointer" onClick={hasActiveStory && !isEditing ? onAvatarClick : undefined}>
          {isEditing && editState?.avatar ? (
            <Image src={editState.avatar} alt={user.name} width={128} height={128} className="object-cover w-full h-full" />
          ) : avatarSrc ? (
            <Image src={avatarSrc} alt={user.name} width={128} height={128} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
          )}
          {isEditing && (
            <>
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
              <button
                onClick={(e) => { e.stopPropagation(); avatarRef.current?.click(); }}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit State Type ───

type ExperienceItem = { id: number; role: string; company: string; logo: string; period: string; description: string };
type EducationItem = { id: number; school: string; degree: string; period: string; logo: string };
type CustomTab = { id: number; title: string; content: string };
type HighlightItem = { id: number; name: string; cover: string; storyCount: number; images: string[] };

type EditState = {
  name: string;
  handle: string;
  title: string;
  bio: string;
  location: string;
  website: string;
  avatar: string;
  coverPhoto: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  interests: string[];
  customTabs: CustomTab[];
  highlights: HighlightItem[];
};

// ─── Handle Availability Check ───

function useHandleCheck(handle: string, originalHandle: string) {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (handle === originalHandle) { setStatus("idle"); return; }
    if (!handle || handle.length < 3) { setStatus("invalid"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) { setStatus("invalid"); return; }

    setStatus("checking");
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      api.checkHandle(handle, originalHandle)
        .then(res => setStatus(res.available ? "available" : "taken"))
        .catch(() => {
          const taken = users.some(u => u.handle.toLowerCase() === handle.toLowerCase() && u.handle !== originalHandle);
          setStatus(taken ? "taken" : "available");
        });
    }, 600);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [handle, originalHandle]);

  return status;
}

// ─── Highlights Editor ───

// Generate archived stories for the picker (mock data simulating past stories)
function generateArchivedStories(userId: number) {
  const dates = ["Feb 28", "Feb 25", "Feb 20", "Feb 15", "Feb 10", "Feb 5", "Jan 30", "Jan 25", "Jan 20", "Jan 15", "Jan 10", "Jan 5", "Dec 28", "Dec 20", "Dec 15", "Dec 10"];
  return dates.map((date, i) => ({
    id: `archive-${userId}-${i}`,
    image: `https://picsum.photos/seed/archive-${userId}-${i}/400/700`,
    date,
  }));
}

function HighlightsEditor({ editState, setEditState, inputClass, userId }: { editState: EditState; setEditState: (s: EditState) => void; inputClass: string; userId: number }) {
  const coverRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const storyUploadRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showArchive, setShowArchive] = useState<number | null>(null);

  const archivedStories = generateArchivedStories(userId);

  const addHighlight = () => {
    const id = Date.now();
    setEditState({
      ...editState,
      highlights: [...editState.highlights, { id, name: "", cover: "", storyCount: 0, images: [] }],
    });
    setExpandedId(id);
  };

  const removeHighlight = (id: number) => {
    setEditState({
      ...editState,
      highlights: editState.highlights.filter(h => h.id !== id),
    });
    if (expandedId === id) setExpandedId(null);
  };

  const updateHighlight = (id: number, updates: Partial<HighlightItem>) => {
    setEditState({
      ...editState,
      highlights: editState.highlights.map(h => h.id === id ? { ...h, ...updates } : h),
    });
  };

  const handleCoverFile = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) updateHighlight(id, { cover: URL.createObjectURL(file) });
  };

  const handleStoryUpload = (hlId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const hl = editState.highlights.find(h => h.id === hlId);
    if (!hl) return;
    const newImages = Array.from(files).map(f => URL.createObjectURL(f));
    const updatedImages = [...hl.images, ...newImages];
    updateHighlight(hlId, { images: updatedImages, storyCount: updatedImages.length, cover: hl.cover || updatedImages[0] });
  };

  const addFromArchive = (hlId: number, archiveImage: string) => {
    const hl = editState.highlights.find(h => h.id === hlId);
    if (!hl) return;
    if (hl.images.includes(archiveImage)) return; // already added
    const updatedImages = [...hl.images, archiveImage];
    updateHighlight(hlId, { images: updatedImages, storyCount: updatedImages.length, cover: hl.cover || updatedImages[0] });
  };

  const removeStoryImage = (hlId: number, imgIndex: number) => {
    const hl = editState.highlights.find(h => h.id === hlId);
    if (!hl) return;
    const updatedImages = hl.images.filter((_, i) => i !== imgIndex);
    const newCover = hl.cover === hl.images[imgIndex] ? (updatedImages[0] || "") : hl.cover;
    updateHighlight(hlId, { images: updatedImages, storyCount: updatedImages.length, cover: newCover });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Story Highlights</span>
        </div>
        <button onClick={addHighlight} className="flex items-center gap-1 text-xs text-[#F44444] font-medium hover:underline">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <p className="text-xs text-[#a3a3a3] mb-4">Highlights appear on your profile below your bio. Add archived stories or upload new images.</p>

      {editState.highlights.length > 0 ? (
        <div className="space-y-3">
          {editState.highlights.map((hl) => {
            const isExpanded = expandedId === hl.id;
            const isArchiveOpen = showArchive === hl.id;
            return (
              <div key={hl.id} className="rounded-xl bg-[#fafafa] border border-[#e5e5e5] overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-3">
                  <input ref={el => { coverRefs.current[hl.id] = el; }} type="file" accept="image/*" onChange={e => handleCoverFile(hl.id, e)} className="hidden" />
                  <button onClick={() => coverRefs.current[hl.id]?.click()} className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-[#e5e5e5] relative group flex-shrink-0">
                    {hl.cover ? (
                      <Image src={hl.cover} alt={hl.name || "Highlight"} width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><Plus className="w-4 h-4 text-[#a3a3a3]" /></div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      <Camera className="w-3.5 h-3.5 text-white" />
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <input value={hl.name} onChange={e => updateHighlight(hl.id, { name: e.target.value })} className={inputClass} placeholder="Highlight name" />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : hl.id)} className="p-1.5 hover:bg-white rounded-lg transition-colors" title="Manage stories">
                      <ChevronRight className={`w-4 h-4 text-[#a3a3a3] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    <button onClick={() => removeHighlight(hl.id)} className="p-1.5 hover:bg-white rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-[#a3a3a3] hover:text-[#F44444]" />
                    </button>
                  </div>
                </div>

                {/* Expanded: story images + actions */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[#e5e5e5]">
                    <div className="flex items-center justify-between pt-3 mb-2">
                      <span className="text-[10px] text-[#a3a3a3] uppercase tracking-wider">{hl.images.length} {hl.images.length === 1 ? "story" : "stories"}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowArchive(isArchiveOpen ? null : hl.id)}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${isArchiveOpen ? "bg-[#F44444] text-white" : "bg-white border border-[#e5e5e5] text-[#525252] hover:bg-[#f0f0f0]"}`}
                        >
                          From archive
                        </button>
                        <input ref={el => { storyUploadRefs.current[hl.id] = el; }} type="file" accept="image/*" multiple onChange={e => handleStoryUpload(hl.id, e)} className="hidden" />
                        <button
                          onClick={() => storyUploadRefs.current[hl.id]?.click()}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-[#e5e5e5] text-[#525252] hover:bg-[#f0f0f0] transition-colors"
                        >
                          Upload
                        </button>
                      </div>
                    </div>

                    {/* Current stories grid */}
                    {hl.images.length > 0 && (
                      <div className="grid grid-cols-5 gap-1.5 mb-2">
                        {hl.images.map((img, i) => (
                          <div key={i} className="relative aspect-[9/16] rounded-lg overflow-hidden group">
                            <Image src={img} alt="" width={80} height={142} className="object-cover w-full h-full" />
                            <button
                              onClick={() => removeStoryImage(hl.id, i)}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {hl.images.length === 0 && !isArchiveOpen && (
                      <p className="text-xs text-[#a3a3a3] text-center py-3">No stories yet. Add from archive or upload images.</p>
                    )}

                    {/* Archive picker */}
                    {isArchiveOpen && (
                      <div className="rounded-lg border border-[#e5e5e5] bg-white p-2 mt-1">
                        <p className="text-[10px] text-[#737373] mb-2">Select from your archived stories</p>
                        <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
                          {archivedStories.map(story => {
                            const isAdded = hl.images.includes(story.image);
                            return (
                              <button
                                key={story.id}
                                onClick={() => !isAdded && addFromArchive(hl.id, story.image)}
                                className={`relative aspect-[9/16] rounded-lg overflow-hidden ${isAdded ? "opacity-40 cursor-not-allowed" : "hover:ring-2 hover:ring-[#F44444] cursor-pointer"}`}
                              >
                                <Image src={story.image} alt="" width={80} height={142} className="object-cover w-full h-full" />
                                {isAdded && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                )}
                                <span className="absolute bottom-0.5 left-0.5 text-[8px] text-white bg-black/40 px-1 rounded">{story.date}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[#a3a3a3] text-center py-4">No highlights yet</p>
      )}
    </div>
  );
}

// ─── Inline Edit Section ───

function EditProfileInline({
  user,
  profile,
  editState,
  setEditState,
  onSave,
  onCancel,
}: {
  user: typeof users[0];
  profile: ReturnType<typeof generateProfileData>;
  editState: EditState;
  setEditState: (s: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const handleStatus = useHandleCheck(editState.handle, user.handle);
  const canSave = handleStatus !== "taken" && handleStatus !== "invalid" && handleStatus !== "checking";
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");

  const inputClass = "w-full px-3 py-2 bg-[#fafafa] rounded-lg text-sm outline-none border border-[#e5e5e5] focus:border-[#F44444]/40 focus:bg-white transition-colors text-[#0a0a0a] placeholder:text-[#a3a3a3]";

  const updateExp = (index: number, field: string, value: string) => {
    const updated = [...editState.experience];
    updated[index] = { ...updated[index], [field]: value };
    setEditState({ ...editState, experience: updated });
  };

  const updateEdu = (index: number, field: string, value: string) => {
    const updated = [...editState.education];
    updated[index] = { ...updated[index], [field]: value };
    setEditState({ ...editState, education: updated });
  };

  const addSkill = () => {
    const v = newSkill.trim();
    if (v && !editState.skills.includes(v)) {
      setEditState({ ...editState, skills: [...editState.skills, v] });
      setNewSkill("");
    }
  };

  const addInterest = () => {
    const v = newInterest.trim();
    if (v && !editState.interests.includes(v)) {
      setEditState({ ...editState, interests: [...editState.interests, v] });
      setNewInterest("");
    }
  };

  const updateCustomTab = (id: number, field: "title" | "content", value: string) => {
    setEditState({
      ...editState,
      customTabs: editState.customTabs.map(t => t.id === id ? { ...t, [field]: value } : t),
    });
  };

  return (
    <div className="px-4 md:px-8 pt-20 pb-6">
      {/* ── Header Fields ── */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#737373] mb-1.5 block">Name</label>
            <input
              value={editState.name}
              onChange={e => setEditState({ ...editState, name: e.target.value })}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-xs text-[#737373] mb-1.5 block">Username</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]">
                <AtSign className="w-3.5 h-3.5" />
              </div>
              <input
                value={editState.handle}
                onChange={e => setEditState({ ...editState, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                className={`${inputClass} pl-8 pr-9 ${
                  handleStatus === "taken" || handleStatus === "invalid" ? "border-[#F44444]/50 bg-[#F44444]/5" :
                  handleStatus === "available" ? "border-green-400/50 bg-green-50/30" : ""
                }`}
                placeholder="username"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {handleStatus === "checking" && <Loader2 className="w-3.5 h-3.5 text-[#a3a3a3] animate-spin" />}
                {handleStatus === "available" && <Check className="w-3.5 h-3.5 text-green-500" />}
                {(handleStatus === "taken" || handleStatus === "invalid") && <X className="w-3.5 h-3.5 text-[#F44444]" />}
              </div>
            </div>
            {handleStatus === "taken" && <p className="text-[10px] text-[#F44444] mt-1">This username is already taken</p>}
            {handleStatus === "invalid" && editState.handle.length > 0 && <p className="text-[10px] text-[#F44444] mt-1">Min 3 characters, letters, numbers, underscores only</p>}
            {handleStatus === "available" && <p className="text-[10px] text-green-600 mt-1">Username available</p>}
          </div>
        </div>

        <div>
          <label className="text-xs text-[#737373] mb-1.5 block">Title</label>
          <input value={editState.title} onChange={e => setEditState({ ...editState, title: e.target.value })} className={inputClass} placeholder="What you do" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#737373] mb-1.5 block">Location</label>
            <input value={editState.location} onChange={e => setEditState({ ...editState, location: e.target.value })} className={inputClass} placeholder="City, Country" />
          </div>
          <div>
            <label className="text-xs text-[#737373] mb-1.5 block">Website</label>
            <input value={editState.website} onChange={e => setEditState({ ...editState, website: e.target.value })} className={inputClass} placeholder="yoursite.com" />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 md:gap-6 mt-6 mb-6">
        <div className="text-center">
          <span className="text-lg md:text-xl font-bold text-[#0a0a0a]">{profile.followers}</span>
          <p className="text-xs md:text-sm text-[#737373]">Followers</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-lg md:text-xl font-bold text-[#0a0a0a]">{profile.following}</span>
          <p className="text-xs md:text-sm text-[#737373]">Following</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-lg md:text-xl font-bold text-[#0a0a0a]">{profile.postsCount}</span>
          <p className="text-xs md:text-sm text-[#737373]">Posts</p>
        </div>
      </div>

      <div className="h-px bg-[#e5e5e5] mb-6" />

      {/* ── About / Bio ── */}
      <div className="space-y-6">
        <div>
          <label className="text-xs text-[#737373] mb-1.5 block">About</label>
          <textarea
            value={editState.bio}
            onChange={e => setEditState({ ...editState, bio: e.target.value })}
            rows={4}
            className={`${inputClass} resize-none`}
            placeholder="Tell people about yourself"
          />
        </div>

        {/* ── Story Highlights ── */}
        <HighlightsEditor editState={editState} setEditState={setEditState} inputClass={inputClass} userId={user.id} />

        {/* ── Experience ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#737373]" />
              <span className="text-sm font-semibold text-[#0a0a0a]">Experience</span>
            </div>
            <button
              onClick={() => setEditState({
                ...editState,
                experience: [...editState.experience, { id: Date.now(), role: "", company: "", logo: `https://picsum.photos/seed/co-new-${Date.now()}/100`, period: "", description: "" }],
              })}
              className="flex items-center gap-1 text-xs text-[#F44444] font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <div className="space-y-3">
            {editState.experience.map((exp, i) => (
              <div key={exp.id} className="p-4 rounded-xl bg-[#fafafa] border border-[#e5e5e5] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#a3a3a3] uppercase tracking-wider">Position {i + 1}</span>
                  <button onClick={() => setEditState({ ...editState, experience: editState.experience.filter((_, j) => j !== i) })} className="p-1 hover:bg-white rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-[#a3a3a3] hover:text-[#F44444]" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#737373] mb-1 block">Role</label>
                    <input value={exp.role} onChange={e => updateExp(i, "role", e.target.value)} className={inputClass} placeholder="e.g. Software Engineer" />
                  </div>
                  <div>
                    <label className="text-xs text-[#737373] mb-1 block">Company</label>
                    <input value={exp.company} onChange={e => updateExp(i, "company", e.target.value)} className={inputClass} placeholder="e.g. Google" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1 block">Period</label>
                  <input value={exp.period} onChange={e => updateExp(i, "period", e.target.value)} className={inputClass} placeholder="e.g. 2021 – Present" />
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1 block">Description</label>
                  <textarea value={exp.description} onChange={e => updateExp(i, "description", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="What did you do?" />
                </div>
              </div>
            ))}
            {editState.experience.length === 0 && <p className="text-xs text-[#a3a3a3] text-center py-4">No experience added yet</p>}
          </div>
        </div>

        {/* ── Education ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#737373]" />
              <span className="text-sm font-semibold text-[#0a0a0a]">Education</span>
            </div>
            <button
              onClick={() => setEditState({
                ...editState,
                education: [...editState.education, { id: Date.now(), school: "", degree: "", period: "", logo: `https://picsum.photos/seed/edu-new-${Date.now()}/100` }],
              })}
              className="flex items-center gap-1 text-xs text-[#F44444] font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <div className="space-y-3">
            {editState.education.map((edu, i) => (
              <div key={edu.id} className="p-4 rounded-xl bg-[#fafafa] border border-[#e5e5e5] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#a3a3a3] uppercase tracking-wider">Education {i + 1}</span>
                  <button onClick={() => setEditState({ ...editState, education: editState.education.filter((_, j) => j !== i) })} className="p-1 hover:bg-white rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-[#a3a3a3] hover:text-[#F44444]" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#737373] mb-1 block">School</label>
                    <input value={edu.school} onChange={e => updateEdu(i, "school", e.target.value)} className={inputClass} placeholder="e.g. Stanford University" />
                  </div>
                  <div>
                    <label className="text-xs text-[#737373] mb-1 block">Degree</label>
                    <input value={edu.degree} onChange={e => updateEdu(i, "degree", e.target.value)} className={inputClass} placeholder="e.g. M.S. Computer Science" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1 block">Period</label>
                  <input value={edu.period} onChange={e => updateEdu(i, "period", e.target.value)} className={inputClass} placeholder="e.g. 2015 – 2017" />
                </div>
              </div>
            ))}
            {editState.education.length === 0 && <p className="text-xs text-[#a3a3a3] text-center py-4">No education added yet</p>}
          </div>
        </div>

        {/* ── Skills ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#737373]" />
            <span className="text-sm font-semibold text-[#0a0a0a]">Skills</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {editState.skills.map(skill => (
              <span key={skill} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f5f5] text-xs text-[#525252] border border-[#e5e5e5]">
                {skill}
                <button onClick={() => setEditState({ ...editState, skills: editState.skills.filter(s => s !== skill) })} className="text-[#a3a3a3] hover:text-[#F44444] transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="Add a skill..."
              className={`${inputClass} flex-1`}
            />
            <button onClick={addSkill} className="px-3.5 py-2 bg-[#f5f5f5] text-[#525252] text-xs font-medium rounded-lg border border-[#e5e5e5] hover:bg-[#ebebeb] transition-colors flex-shrink-0">Add</button>
          </div>
        </div>

        {/* ── Interests ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-[#737373]" />
            <span className="text-sm font-semibold text-[#0a0a0a]">Interests</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {editState.interests.map(interest => (
              <span key={interest} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#F44444] bg-[#F44444]/5 border border-[#F44444]/15">
                {interest}
                <button onClick={() => setEditState({ ...editState, interests: editState.interests.filter(i => i !== interest) })} className="text-[#F44444]/50 hover:text-[#F44444] transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newInterest}
              onChange={e => setNewInterest(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInterest(); } }}
              placeholder="Add an interest..."
              className={`${inputClass} flex-1`}
            />
            <button onClick={addInterest} className="px-3.5 py-2 bg-[#f5f5f5] text-[#525252] text-xs font-medium rounded-lg border border-[#e5e5e5] hover:bg-[#ebebeb] transition-colors flex-shrink-0">Add</button>
          </div>
        </div>

        <div className="h-px bg-[#e5e5e5]" />

        {/* ── Custom Tabs ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#0a0a0a]">Custom Profile Sections</span>
            <button
              onClick={() => setEditState({
                ...editState,
                customTabs: [...editState.customTabs, { id: Date.now(), title: "", content: "" }],
              })}
              className="flex items-center gap-1 text-xs text-[#F44444] font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add Section
            </button>
          </div>
          <p className="text-xs text-[#a3a3a3] mb-4">Add custom tabs to your profile. Each section becomes a new tab visible to visitors.</p>
          <div className="space-y-3">
            {editState.customTabs.map(tab => (
              <div key={tab.id} className="p-4 rounded-xl bg-[#fafafa] border border-[#e5e5e5] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#a3a3a3] uppercase tracking-wider">Tab Section</span>
                  <button onClick={() => setEditState({ ...editState, customTabs: editState.customTabs.filter(t => t.id !== tab.id) })} className="p-1 hover:bg-white rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-[#a3a3a3] hover:text-[#F44444]" />
                  </button>
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1 block">Tab Name</label>
                  <input
                    value={tab.title}
                    onChange={e => updateCustomTab(tab.id, "title", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Projects, Portfolio, Investments"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1 block">Content</label>
                  <textarea
                    value={tab.content}
                    onChange={e => updateCustomTab(tab.id, "content", e.target.value)}
                    rows={5}
                    className={`${inputClass} resize-none`}
                    placeholder="Write the content for this section..."
                  />
                </div>
              </div>
            ))}
            {editState.customTabs.length === 0 && <p className="text-xs text-[#a3a3a3] text-center py-4">No custom sections yet</p>}
          </div>
        </div>
      </div>

      {/* ── Save / Cancel ── */}
      <div className="flex items-center gap-2 pt-6 sticky bottom-0 bg-white pb-4 border-t border-[#e5e5e5] mt-6 -mx-4 md:-mx-8 px-4 md:px-8">
        <button
          onClick={onSave}
          disabled={!canSave}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${
            canSave
              ? "bg-[#F44444] text-white hover:bg-[#d63c3c] active:scale-95"
              : "bg-[#e5e5e5] text-[#a3a3a3] cursor-not-allowed"
          }`}
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 text-sm font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Followers/Following Modal ───

function FollowersModal({ userId, type, onClose }: { userId: number; type: "followers" | "following"; onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { currentUserId, userRole } = useContext(AuthContext);
  const isCircleViewer = userRole === "CIRCLE" || userRole === "ADMIN";

  useEffect(() => {
    setLoading(true);
    api.getFollowerList(userId, type)
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, type]);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  // Separate circle and non-circle users
  const circleUsers = list.filter(p => p.role === "CIRCLE" || p.role === "ADMIN" || p.role === "AUTHOR");
  const nonCircleUsers = list.filter(p => p.role === "NORMAL");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <div>
            <span className="text-base font-semibold text-[#0a0a0a] capitalize">{type}</span>
            {!loading && <span className="text-xs text-[#a3a3a3] ml-2">{list.length}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
        </div>
        <div className="overflow-y-auto max-h-[65vh]">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#a3a3a3]" /></div>
          ) : list.length === 0 ? (
            <div className="text-center py-12"><p className="text-sm text-[#737373]">No {type} yet</p></div>
          ) : (
            <>
              {/* Circle users — shown with full profiles */}
              {circleUsers.map(person => {
                const isFollowingPerson = following.has(person.id);
                const isSelf = person.id === currentUserId;
                return (
                  <div key={person.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors">
                    <Link href={`/${person.handle}`} onClick={onClose} className="flex-shrink-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
                        {person.avatar ? (
                          <Image src={person.avatar} alt={person.name} width={44} height={44} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                            <span className="text-sm font-medium text-[#737373]">{person.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                    <Link href={`/${person.handle}`} onClick={onClose} className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-[#0a0a0a] truncate">{person.name}</span>
                        {person.verified && <VerifiedBadge className="scale-75" />}
                        <span className="px-1.5 py-0.5 bg-[#F44444]/10 text-[#F44444] text-[9px] font-semibold rounded flex-shrink-0">Circle</span>
                      </div>
                      <span className="text-xs text-[#737373] truncate block">{person.title}</span>
                    </Link>
                    {!isSelf && (
                      <button
                        onClick={() => toggleFollow(person.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full flex-shrink-0 transition-all ${
                          isFollowingPerson
                            ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                            : "bg-[#F44444] text-white hover:bg-[#d63c3c]"
                        }`}
                      >
                        {isFollowingPerson ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Non-circle users — shown as aggregate count */}
              {nonCircleUsers.length > 0 && (
                <div className="flex items-center gap-3 px-5 py-3 border-t border-[#f0f0f0]">
                  <div className="w-11 h-11 rounded-full bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-[#a3a3a3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#0a0a0a]">{nonCircleUsers.length} {nonCircleUsers.length === 1 ? "user" : "users"}</span>
                    <span className="text-xs text-[#737373] block">Non-Circle {type}</span>
                  </div>
                </div>
              )}

              {/* If no circle users but has non-circle */}
              {circleUsers.length === 0 && nonCircleUsers.length > 0 && (
                <p className="text-xs text-[#a3a3a3] text-center pb-3">Circle member profiles are visible to Circle users</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UserInfoSection({
  user,
  profile,
  isFollowing,
  onFollow,
  isOwnProfile,
  onEditProfile,
  displayName,
  displayTitle,
  displayLocation,
  displayWebsite,
  isCustomDomain = false,
  onShowFollowers,
  realStats,
}: {
  user: typeof users[0];
  profile: ReturnType<typeof generateProfileData>;
  isFollowing: boolean;
  onFollow: () => void;
  isOwnProfile: boolean;
  onEditProfile: () => void;
  displayName: string;
  displayTitle: string;
  displayLocation: string;
  displayWebsite: string;
  isCustomDomain?: boolean;
  onShowFollowers?: (type: "followers" | "following") => void;
  realStats?: { followers: number; following: number; posts: number } | null;
}) {
  const isCircleUser = user.role === "CIRCLE" || user.role === "ADMIN" || user.role === "AUTHOR";
  const { currentUserId } = useContext(AuthContext);
  const router = useRouter();
  const statsFollowers = realStats ? String(realStats.followers) : profile.followers;
  const statsFollowing = realStats ? String(realStats.following) : profile.following;
  const statsPosts = realStats ? String(realStats.posts) : profile.postsCount;
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [showMenu]);

  // Close share popup on outside click
  useEffect(() => {
    if (!showSharePopup) return;
    const close = () => setShowSharePopup(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [showSharePopup]);

  const copyProfileLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/${user.handle}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  const profileUrl = `${window.location.origin}/${user.handle}`;
  const shareText = `Check out ${displayName}'s profile on Albiz - ${displayTitle}`;

  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + profileUrl)}`;
    window.open(url, '_blank');
    setShowSharePopup(false);
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank');
    setShowSharePopup(false);
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank');
    setShowSharePopup(false);
  };

  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank');
    setShowSharePopup(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowSharePopup(false);
  };

  return (
    <>
      <div className="px-4 md:px-8 pt-20 pb-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-[#0a0a0a]">{displayName}</h1>
              {user.verified && <VerifiedBadge className="scale-125" />}
              {user.role === "CIRCLE" && (
                <span className="px-2 py-0.5 bg-[#F44444] text-white text-xs font-medium rounded-full">Circle</span>
              )}
            </div>
            <p className="text-sm md:text-base text-[#737373] mt-1">{displayTitle}</p>
            {isCircleUser && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs md:text-sm text-[#737373]">
                {displayLocation && <span className="flex items-center gap-1 whitespace-nowrap"><MapPin className="w-4 h-4 flex-shrink-0" />{displayLocation}</span>}
                {displayWebsite && <span className="flex items-center gap-1 whitespace-nowrap"><Globe className="w-4 h-4 flex-shrink-0" />{displayWebsite}</span>}
                <span className="flex items-center gap-1 whitespace-nowrap"><Calendar className="w-4 h-4 flex-shrink-0" />Joined {profile.joinedDate}</span>
              </div>
            )}
          </div>
          {!isCustomDomain && (
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              {isCircleUser && (
                <>
                  {isOwnProfile ? (
                    <button
                      onClick={onEditProfile}
                      className="px-3 py-1 md:px-5 md:py-2 text-xs md:text-sm font-medium rounded-full bg-[#F44444] text-white hover:bg-[#d63c3c] transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      Edit
                    </button>
                  ) : (
                    <button
                      onClick={onFollow}
                      className={`px-3 py-1 md:px-5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all duration-200 ${
                        isFollowing
                          ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                          : "bg-[#F44444] text-white hover:bg-[#d63c3c]"
                      } active:scale-95`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                  <div className="relative">
                    <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 md:p-2 border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors">
                      <MoreVertical className="w-4 h-4 md:w-5 md:h-5 text-[#525252]" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-[#e5e5e5] py-1 z-20 min-w-[160px]" onClick={e => e.stopPropagation()}>
                        <button onClick={copyProfileLink} className="w-full text-left px-4 py-2.5 text-sm text-[#0a0a0a] hover:bg-[#fafafa] flex items-center gap-2">
                          {copied ? <Check className="w-4 h-4 text-[#22c55e]" /> : <ExternalLink className="w-4 h-4 text-[#737373]" />}
                          {copied ? "Copied" : "Copy link to profile"}
                        </button>
                        <button onClick={() => { setShowMenu(false); setShowSharePopup(true); }} className="w-full text-left px-4 py-2.5 text-sm text-[#0a0a0a] hover:bg-[#fafafa] flex items-center gap-2">
                          <Share2 className="w-4 h-4 text-[#737373]" />
                          Share to social media
                        </button>
                        {!isOwnProfile && (
                          <>
                            <Link href={`/messages?user=${user.id}`} onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2.5 text-sm text-[#0a0a0a] hover:bg-[#fafafa] flex items-center gap-2">
                              <Mail className="w-4 h-4 text-[#737373]" /> Send message
                            </Link>
                            <button
                              onClick={async () => {
                                setShowMenu(false);
                                if (blocking) return;
                                setBlocking(true);
                                try {
                                  await api.blockUser(currentUserId, user.id);
                                  router.push("/");
                                } catch {}
                                setBlocking(false);
                              }}
                              disabled={blocking}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#F44444] hover:bg-[#fafafa] flex items-center gap-2 disabled:opacity-50"
                            >
                              <Shield className="w-4 h-4" /> {blocking ? "Blocking..." : "Block"}
                            </button>
                          </>
                        )}
                        {isOwnProfile && (
                          <Link href="/settings" onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2.5 text-sm text-[#0a0a0a] hover:bg-[#fafafa] flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-[#737373]" /> Settings
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
             
            </div>
          )}
        </div>
        {isCircleUser && (
          <div className="flex items-center gap-4 md:gap-6 mt-6">
            <button onClick={() => onShowFollowers?.("followers")} className="text-center hover:opacity-70 transition-opacity">
              <span className="text-lg md:text-xl font-bold text-[#0a0a0a]">{statsFollowers}</span>
              <p className="text-xs md:text-sm text-[#737373]">Followers</p>
            </button>
            <div className="w-px h-10 bg-[#e5e5e5]" />
            <button onClick={() => onShowFollowers?.("following")} className="text-center hover:opacity-70 transition-opacity">
              <span className="text-lg md:text-xl font-bold text-[#0a0a0a]">{statsFollowing}</span>
              <p className="text-xs md:text-sm text-[#737373]">Following</p>
            </button>
            <div className="w-px h-10 bg-[#e5e5e5]" />
            <div className="text-center">
              <span className="text-lg md:text-xl font-bold text-[#0a0a0a]">{statsPosts}</span>
              <p className="text-xs md:text-sm text-[#737373]">Posts</p>
            </div>
          </div>
        )}
      </div>
      {showSharePopup && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSharePopup(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#0a0a0a]">Share profile</h3>
              <button onClick={() => setShowSharePopup(false)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#737373]" />
              </button>
            </div>
            <div className="space-y-2">
              <button onClick={copyLink} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <LinkIcon className="w-5 h-5 text-[#737373]" />
                <span className="text-sm text-[#0a0a0a]">{copied ? "Copied!" : "Copy link"}</span>
              </button>
              <button onClick={shareToWhatsApp} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <span className="text-sm text-[#0a0a0a]">WhatsApp</span>
              </button>
              <button onClick={shareToTwitter} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <Share2 className="w-5 h-5 text-[#1DA1F2]" />
                <span className="text-sm text-[#0a0a0a]">Twitter</span>
              </button>
              <button onClick={shareToFacebook} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <Share2 className="w-5 h-5 text-[#4267B2]" />
                <span className="text-sm text-[#0a0a0a]">Facebook</span>
              </button>
              <button onClick={shareToLinkedIn} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors text-left">
                <Briefcase className="w-5 h-5 text-[#0077B5]" />
                <span className="text-sm text-[#0a0a0a]">LinkedIn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Story Highlights ───

function HighlightsRow({ highlights, onViewHighlight }: { highlights: ReturnType<typeof generateProfileData>["highlights"]; onViewHighlight?: (index: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      const ro = new ResizeObserver(checkScroll);
      ro.observe(el);
      return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
    }
  }, [highlights.length]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  if (!highlights.length) return null;
  return (
    <div className="px-4 md:px-8 pb-4">
      {(canScrollLeft || canScrollRight) && (
        <div className="flex items-center gap-1 mb-2 justify-end">
          <button onClick={() => scroll("left")} disabled={!canScrollLeft} className="hidden md:flex w-6 h-6 rounded-full items-center justify-center border border-[#e5e5e5] disabled:opacity-30 hover:bg-[#f5f5f5] transition-all">
            <ChevronLeft className="w-3.5 h-3.5 text-[#525252]" />
          </button>
          <button onClick={() => scroll("right")} disabled={!canScrollRight} className="hidden md:flex w-6 h-6 rounded-full items-center justify-center border border-[#e5e5e5] disabled:opacity-30 hover:bg-[#f5f5f5] transition-all">
            <ChevronRight className="w-3.5 h-3.5 text-[#525252]" />
          </button>
        </div>
      )}
      <div className="relative">
        {canScrollLeft && <div className="absolute left-0 top-0 bottom-0 w-6 md:w-8 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))" }} />}
        {canScrollRight && <div className="absolute right-0 top-0 bottom-0 w-6 md:w-8 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, rgba(255,255,255,1), rgba(255,255,255,0))" }} />}
        <div ref={scrollRef} className="flex gap-3 md:gap-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {highlights.map((hl, i) => (
            <button key={hl.id} onClick={() => onViewHighlight?.(i)} className="flex flex-col items-center gap-1 md:gap-1.5 flex-shrink-0 group cursor-pointer">
              <div className="w-[50px] h-[50px] md:w-[68px] md:h-[68px] rounded-full p-[2px] md:p-[3px] bg-gradient-to-br from-[#F44444] to-[#F44444]/40">
                <div className="w-full h-full rounded-full overflow-hidden bg-white p-[1.5px] md:p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    <Image src={hl.cover} alt={hl.name} width={64} height={64} className="object-cover w-full h-full" />
                  </div>
                </div>
              </div>
              <span className="text-[10px] md:text-[11px] text-[#525252] max-w-[52px] md:max-w-[72px] truncate">{hl.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Highlight Viewer (story-like full-screen viewer for profile highlights) ───

function HighlightViewer({ highlights, startIndex, onClose }: {
  highlights: ReturnType<typeof generateProfileData>["highlights"];
  startIndex: number;
  onClose: () => void;
}) {
  const [hlIndex, setHlIndex] = useState(startIndex);
  const [imgIndex, setImgIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const hl = highlights[hlIndex];
  if (!hl) { onClose(); return null; }

  const images = hl.images?.length ? hl.images : [hl.cover];
  const currentImg = images[imgIndex] || hl.cover;

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = "unset"; }; }, []);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          // Next image in this highlight
          if (imgIndex < images.length - 1) {
            setImgIndex(i => i + 1);
            return 0;
          }
          // Next highlight
          if (hlIndex < highlights.length - 1) {
            setHlIndex(h => h + 1);
            setImgIndex(0);
            return 0;
          }
          onClose();
          return 100;
        }
        return prev + 1.5;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [hlIndex, imgIndex, paused, images.length, highlights.length, onClose]);

  const goNext = () => {
    if (imgIndex < images.length - 1) { setImgIndex(i => i + 1); setProgress(0); }
    else if (hlIndex < highlights.length - 1) { setHlIndex(h => h + 1); setImgIndex(0); setProgress(0); }
    else onClose();
  };

  const goPrev = () => {
    if (imgIndex > 0) { setImgIndex(i => i - 1); setProgress(0); }
    else if (hlIndex > 0) { setHlIndex(h => h - 1); setImgIndex(0); setProgress(0); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center">
      {/* Progress bars for images in current highlight */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3 max-w-md mx-auto">
        {images.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-75 ease-linear" style={{ width: `${i < imgIndex ? 100 : i === imgIndex ? progress : 0}%` }} />
          </div>
        ))}
      </div>

      {/* Header — highlight name */}
      <div className="absolute top-6 left-0 right-0 z-30 flex items-center justify-between px-4 max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/50 bg-white/10 flex items-center justify-center">
            <Image src={hl.cover} alt={hl.name} width={40} height={40} className="object-cover w-full h-full rounded-full" />
          </div>
          <div>
            <span className="text-white text-sm font-semibold">{hl.name}</span>
            <span className="text-white/60 text-xs block">{hl.storyCount} {hl.storyCount === 1 ? "item" : "items"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPaused(p => !p)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            {paused ? (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            ) : (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            )}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {(hlIndex > 0 || imgIndex > 0) && (
        <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}
      <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center">
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Image */}
      <div className="w-full max-w-md aspect-[9/16] relative rounded-xl overflow-hidden">
        <Image src={currentImg} alt={`${hl.name} ${imgIndex + 1}`} fill className="object-cover" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Tap areas */}
      <button onClick={goPrev} className="absolute left-0 top-20 w-1/4 h-[calc(100%-120px)] z-20" />
      <button onClick={goNext} className="absolute right-0 top-20 w-1/4 h-[calc(100%-120px)] z-20" />

      {/* Highlight switcher at bottom */}
      <div className="absolute bottom-4 left-0 right-0 z-30 flex gap-2 justify-center px-4 max-w-md mx-auto">
        {highlights.map((h, i) => (
          <button
            key={h.id}
            onClick={() => { setHlIndex(i); setImgIndex(0); setProgress(0); }}
            className={`w-2 h-2 rounded-full transition-all ${i === hlIndex ? "bg-white scale-125" : "bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar Cards ───

function NetWorthCard({ netWorth }: { netWorth: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Net Worth</span>
        <DollarSign className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#0a0a0a]">{netWorth}</span>
        <span className="text-xs text-green-500 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+12.5%</span>
      </div>
      <p className="text-xs text-[#737373] mt-1">Estimated value</p>
    </div>
  );
}

function RankingsCard({ profile }: { profile: ReturnType<typeof generateProfileData> }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Rankings</span>
        <Trophy className="w-4 h-4 text-[#F44444]" />
      </div>
      <div className="space-y-3">
        {[{ label: "Global", rank: profile.globalRank }, { label: "Sector", rank: profile.sectorRank }, { label: "Category", rank: profile.categoryRank }].map(r => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-[#525252]">{r.label}</span>
            <span className="text-sm font-semibold text-[#0a0a0a]">{r.rank}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileStatsCard({ profile }: { profile: ReturnType<typeof generateProfileData> }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Profile Stats</span>
        <BarChart3 className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#525252] flex items-center gap-2"><Eye className="w-4 h-4" />Profile views</span>
          <span className="text-sm font-semibold text-[#0a0a0a]">{profile.profileViews}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#525252] flex items-center gap-2"><Users className="w-4 h-4" />Search appearances</span>
          <span className="text-sm font-semibold text-[#0a0a0a]">{profile.searchAppearances}</span>
        </div>
      </div>
    </div>
  );
}

function CompaniesCard({ experience }: { experience: ReturnType<typeof generateProfileData>["experience"] }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Companies</span>
        <Building2 className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="space-y-3">
        {experience.slice(0, 3).map(exp => (
          <div key={exp.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#f5f5f5]">
              <Image src={exp.logo} alt={exp.company} width={40} height={40} className="object-cover w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0a0a0a] truncate">{exp.company}</p>
              <p className="text-xs text-[#737373]">{exp.role}</p>
            </div>
            <span className="text-xs text-[#a3a3a3]">{exp.period}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MutualConnectionsCard({ connections }: { connections: ReturnType<typeof generateProfileData>["mutualConnections"] }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Mutual Connections</span>
        <Users className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="space-y-2">
        {connections.slice(0, 3).map(conn => (
          <Link key={conn.id} href={`/${conn.handle}`} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-[#fafafa] transition-colors">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
              {conn.avatar ? (
                <Image src={conn.avatar} alt={conn.name} width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                  <span className="text-xs font-medium text-[#737373]">{conn.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-[#0a0a0a] truncate block">{conn.name}</span>
              <span className="text-[10px] text-[#a3a3a3]">{conn.mutualCount} mutual</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProfileRightSidebar({ profile, isCustomDomain }: { profile: ReturnType<typeof generateProfileData>; isCustomDomain?: boolean }) {
  return (
    <aside className="hidden lg:block w-80 flex-shrink-0 space-y-4 py-4 pl-4">
      <NetWorthCard netWorth={profile.netWorth} />
      <RankingsCard profile={profile} />
      {!isCustomDomain && <ProfileStatsCard profile={profile} />}
      <CompaniesCard experience={profile.experience} />
      {!isCustomDomain && <MutualConnectionsCard connections={profile.mutualConnections} />}
    </aside>
  );
}

// ─── Tab: Posts ───

function PostCard({ user, post }: { user: typeof users[0]; post: ReturnType<typeof generateProfileData>["userPosts"][0] }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-200">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0">
          {user.avatar ? (
            <Image src={user.avatar} alt={user.name} width={40} height={40} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
              <span className="text-sm font-medium text-[#737373]">{user.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-wrap">
              <span className="font-medium text-sm text-[#0a0a0a] truncate">{user.name}</span>
              {user.verified && <VerifiedBadge className="scale-90 flex-shrink-0" />}
              <span className="text-[#a3a3a3] text-xs">&middot;</span>
              <span className="text-[#737373] text-xs whitespace-nowrap">{post.date}</span>
            </div>
            <button className="p-1 hover:bg-[#f5f5f5] rounded transition-colors flex-shrink-0">
              <MoreHorizontal className="w-4 h-4 text-[#737373]" />
            </button>
          </div>
          <p className="text-[#262626] text-sm mt-2">{post.content}</p>
          {post.image && (
            <div className="rounded-xl overflow-hidden mt-3">
              <Image src={post.image} alt="" width={800} height={500} className="object-cover w-full" />
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-[#737373]">
            <span className="flex items-center gap-1 text-xs"><Eye className="w-4 h-4" />{post.stats.views}</span>
            <span className="flex items-center gap-1 text-xs"><Heart className="w-4 h-4" />{post.stats.likes}</span>
            <span className="flex items-center gap-1 text-xs"><MessageCircle className="w-4 h-4" />{post.stats.comments}</span>
            <span className="flex items-center gap-1 text-xs"><Share2 className="w-4 h-4" />{post.stats.shares}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePostCard({ post, user, isOwnProfile, menuOpen, setMenuOpen, startEdit, handleDelete, initialLiked = false }: {
  post: any; user: typeof users[0]; isOwnProfile: boolean;
  menuOpen: number | null; setMenuOpen: (id: number | null) => void;
  startEdit: (post: any) => void; handleDelete: (id: number) => void;
  initialLiked?: boolean;
}) {
  const { currentUserId } = useContext(AuthContext);
  const stats = post.stats || { views: "0", likes: "0", comments: "0", shares: "0" };
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(stats.likes);
  const [commentCount, setCommentCount] = useState(stats.comments);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    api.likePost(post.id, newLiked ? "like" : "unlike", currentUserId)
      .then(res => { if (res.likes) setLikeCount(res.likes); })
      .catch(() => {});
  };

  const toggleComments = () => {
    const opening = !showComments;
    setShowComments(opening);
    // Load comments in background — don't block the UI
    if (opening && comments.length === 0) {
      setLoadingComments(true);
      api.getComments(post.id).then(setComments).catch(() => {}).finally(() => setLoadingComments(false));
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const c = await api.addComment(post.id, currentUserId, commentText.trim());
      if (c.id) {
        setComments(prev => [c, ...prev]);
        const n = parseInt(commentCount) || 0;
        setCommentCount(String(n + 1));
      }
      setCommentText("");
    } catch {}
    setPostingComment(false);
  };

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-3 md:p-4 bg-white hover:border-[#d5d5d5] transition-colors">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
            {user.avatar ? (
              <Image src={user.avatar} alt={user.name} width={36} height={36} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                <span className="text-xs font-medium text-[#737373]">{user.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-sm text-[#0a0a0a]">{user.name}</span>
              {user.verified && <VerifiedBadge className="scale-90" />}
              <span className="text-[#a3a3a3] text-xs">{post.date}</span>
            </div>
            <span className="text-xs text-[#737373] truncate block">{user.title}</span>
            {post.type === "post" && post.description && (
              <span className="text-[10px] text-[#F44444] flex items-center gap-0.5 mt-0.5"><MapPin className="w-2.5 h-2.5" />{post.description}</span>
            )}
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <button onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <MoreVertical className="w-4 h-4 text-[#737373]" />
          </button>
          {menuOpen === post.id && (
            <div className="absolute right-0 top-9 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-1.5 z-20 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150" onClick={e => e.stopPropagation()}>
              {isOwnProfile && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(post); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#0a0a0a] hover:bg-[#fafafa] flex items-center gap-2.5 transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#F44444] hover:bg-[#fafafa] flex items-center gap-2.5 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </>
              )}
              {!isOwnProfile && (
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(null); }} className="w-full text-left px-3.5 py-2.5 text-xs text-[#525252] hover:bg-[#fafafa] flex items-center gap-2.5 transition-colors">
                  <EyeOff className="w-3.5 h-3.5" /> Not interested
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {post.title && <h3 className="font-semibold text-[#0a0a0a] mb-1">{post.title}</h3>}
      {post.content && <div className="text-sm text-[#262626] mb-3 [&_b]:font-bold [&_i]:italic [&_a]:text-[#F44444] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: post.content }} />}
      {post.image && (
        <div className="rounded-xl overflow-hidden mb-3">
          <Image src={post.image} alt="" width={800} height={400} className="object-cover w-full" unoptimized />
        </div>
      )}
      {/* Interactive Stats */}
      <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
        <div className="flex items-center gap-4 text-[#737373]">
          <span className="flex items-center gap-1 text-xs"><Eye className="w-3.5 h-3.5" />{stats.views}</span>
          <button onClick={handleLike} className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-[#F44444]" : "hover:text-[#525252]"}`}>
            <Heart className={`w-3.5 h-3.5 ${liked ? "fill-[#F44444]" : ""}`} />{likeCount}
          </button>
          <button onClick={toggleComments} className={`flex items-center gap-1 text-xs transition-colors ${showComments ? "text-[#F44444]" : "hover:text-[#525252]"}`}>
            <MessageCircle className={`w-3.5 h-3.5 ${showComments ? "fill-[#F44444]/10" : ""}`} />{commentCount}
          </button>
          <span className="flex items-center gap-1 text-xs"><Share2 className="w-3.5 h-3.5" />{stats.shares}</span>
        </div>
        <SaveBookmarkButton postId={post.id} />
      </div>
      {/* Comments Section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
              {user.avatar ? (
                <Image src={user.avatar} alt={user.name} width={28} height={28} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                  <span className="text-xs font-medium text-[#737373]">{user.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1 flex items-center gap-1.5 bg-[#f5f5f5] rounded-full px-3 py-1.5">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitComment(); }}
                placeholder="Write a comment..."
                className="flex-1 bg-transparent text-xs outline-none text-[#262626] placeholder:text-[#a3a3a3]"
              />
              <button onClick={submitComment} disabled={!commentText.trim() || postingComment} className="text-[#F44444] disabled:text-[#d5d5d5] transition-colors">
                {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {loadingComments ? (
            <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-[#a3a3a3]" /></div>
          ) : comments.length > 0 ? (
            <div className="space-y-2.5 max-h-[240px] overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 group/comment">
                  <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                    {c.avatar ? (
                      <Image src={c.avatar} alt={c.name} width={24} height={24} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                        <span className="text-[10px] font-medium text-[#737373]">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#0a0a0a]">{c.name}</span>
                      {c.verified && <VerifiedBadge className="scale-75" />}
                      <span className="text-[10px] text-[#a3a3a3]">{new Date(c.createdAt).toLocaleDateString()}</span>
                      {c.userId === currentUserId && (
                        <button
                          onClick={() => { api.deleteComment(post.id, c.id).catch(() => {}); setComments(prev => prev.filter(x => x.id !== c.id)); const n = parseInt(commentCount) || 0; setCommentCount(String(Math.max(0, n - 1))); }}
                          className="opacity-0 group-hover/comment:opacity-100 transition-opacity ml-auto text-[#a3a3a3] hover:text-[#F44444]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#262626] mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#a3a3a3] text-center py-2">No comments yet</p>
          )}
        </div>
      )}
    </div>
  );
}

function PostsTab({ user, profile }: { user: typeof users[0]; profile: ReturnType<typeof generateProfileData> }) {
  const { currentUserId } = useContext(AuthContext);
  const isOwnProfile = user.id === currentUserId;
  const [dbPosts, setDbPosts] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());

  const fetchPosts = () => {
    api.getPosts()
      .then(allPosts => setDbPosts(allPosts.filter((p: any) => p.userId === user.id)))
      .catch(() => {});
  };
  useEffect(() => {
    fetchPosts();
    if (currentUserId) {
      api.getLikedPosts(currentUserId).then(ids => setLikedPostIds(new Set(ids))).catch(() => {});
    }
  }, [user.id, currentUserId]);

  const editEditorRef = useRef<HTMLDivElement>(null);

  const handleDelete = async (postId: number) => {
    setMenuOpen(null);
    try {
      await api.deletePost(postId);
      setDbPosts(prev => prev.filter(p => p.id !== postId));
      window.dispatchEvent(new Event("albiz-post-created"));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const startEdit = (post: any) => {
    setEditingPost(post);
    setEditContent(post.content || "");
    setMenuOpen(null);
    // Set editor content after render
    setTimeout(() => {
      if (editEditorRef.current) editEditorRef.current.innerHTML = post.content || "";
    }, 50);
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    setSaving(true);
    const html = editEditorRef.current?.innerHTML || editContent;
    try {
      await api.editPost(editingPost.id, { content: html });
      setDbPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: html } : p));
      window.dispatchEvent(new Event("albiz-post-created"));
    } catch {}
    setEditingPost(null);
    setSaving(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (menuOpen === null) return;
    const close = () => setMenuOpen(null);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  // Only use DB posts — don't mix in static data (static posts reappear after deletion)
  const allUserPosts = dbPosts;

  return (
    <>
      {/* Edit Modal — full Create Post interface */}
      {editingPost && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingPost(null)} />
          <div className="relative bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-3 md:p-5 border-b border-[#f0f0f0]">
              <span className="text-lg md:text-xl font-semibold text-[#0a0a0a]">Edit Post</span>
              <button onClick={() => setEditingPost(null)} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg"><X className="w-5 h-5 text-[#737373]" /></button>
            </div>
            {/* User Info */}
            <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-3 md:py-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
                {user.avatar ? (
                  <Image src={user.avatar} alt={user.name} width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                    <span className="text-sm font-medium text-[#737373]">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <span className="font-semibold text-sm md:text-base text-[#0a0a0a]">{user.name}</span>
            </div>
            {/* Formatting Toolbar */}
            <div className="px-3 md:px-5 pb-2">
              <div className="flex items-center gap-0.5 md:gap-1">
                <button onMouseDown={e => e.preventDefault()} onClick={() => { editEditorRef.current?.focus(); document.execCommand("bold"); }} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Bold"><Bold className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => { editEditorRef.current?.focus(); document.execCommand("italic"); }} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Italic"><Italic className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => { editEditorRef.current?.focus(); document.execCommand("createLink", false, window.getSelection()?.toString() || ""); }} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Link"><LinkIcon className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => { editEditorRef.current?.focus(); document.execCommand("insertUnorderedList"); }} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Bullet List"><List className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => { editEditorRef.current?.focus(); document.execCommand("insertOrderedList"); }} className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]" title="Numbered List"><ListOrdered className="w-4 h-4 md:w-5 md:h-5" /></button>
              </div>
            </div>
            {/* Content Editor */}
            <div className="px-3 md:px-5 pb-3 md:pb-4">
              <div className="bg-[#f5f5f5] rounded-xl p-3 md:p-4 min-h-[100px] md:min-h-[120px]">
                <div
                  ref={editEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setEditContent(editEditorRef.current?.innerHTML || "")}
                  data-placeholder="What's on your mind?"
                  className="w-full bg-transparent text-[#262626] text-sm md:text-base outline-none min-h-[80px] md:min-h-[100px] empty:before:content-[attr(data-placeholder)] empty:before:text-[#c5c5c5] empty:before:pointer-events-none [&_b]:font-bold [&_i]:italic [&_a]:text-[#F44444] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                />
              </div>
            </div>
            {/* Image preview */}
            {editingPost.image && (
              <div className="px-3 md:px-5 pb-3 md:pb-4">
                <div className="flex gap-2 md:gap-3 flex-wrap">
                  <div className="relative w-24 h-20 md:w-32 md:h-28 rounded-xl overflow-hidden">
                    <Image src={editingPost.image} alt="" width={128} height={112} className="object-cover w-full h-full" unoptimized />
                  </div>
                </div>
              </div>
            )}
            {/* Action Icons */}
            <div className="px-3 md:px-5 pb-3 md:pb-4">
              <div className="flex items-center gap-1 md:gap-2">
                <button className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Upload Image"><ImagePlus className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => { editEditorRef.current?.focus(); document.execCommand("insertText", false, " "); }} className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Emoji"><Smile className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Location"><MapPin className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onMouseDown={e => e.preventDefault()} onClick={() => { editEditorRef.current?.focus(); document.execCommand("insertText", false, "#"); }} className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]" title="Hashtag"><Hash className="w-4 h-4 md:w-5 md:h-5" /></button>
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-3 md:px-5 py-3 md:py-4 border-t border-[#f0f0f0]">
              <span className="text-xs md:text-sm text-[#737373]">{(editEditorRef.current?.innerText || "").length}/1000</span>
              <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setEditingPost(null)} className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d63c3c] transition-colors disabled:opacity-40 flex items-center gap-1.5">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {allUserPosts.length > 0 ? (
        allUserPosts.map(post => (
          <ProfilePostCard
            key={`post-${post.id}`}
            post={post}
            user={user}
            isOwnProfile={isOwnProfile}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            startEdit={startEdit}
            handleDelete={handleDelete}
            initialLiked={likedPostIds.has(post.id)}
          />
        ))
      ) : (
        profile.userPosts.map(post => (
          <PostCard key={post.id} user={user} post={post} />
        ))
      )}
    </>
  );
}

// ─── Tab: About ───

function AboutTab({ profile }: { profile: ReturnType<typeof generateProfileData> }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <p className="text-sm text-[#262626] leading-relaxed">{profile.bio}</p>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Experience</span>
        </div>
        <div className="space-y-0">
          {profile.experience.map((exp, i) => (
            <div key={exp.id} className="flex gap-3 relative">
              {i < profile.experience.length - 1 && (
                <div className="absolute left-5 top-12 w-px h-[calc(100%-12px)] bg-[#e5e5e5]" />
              )}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#f5f5f5] flex-shrink-0 z-10">
                <Image src={exp.logo} alt={exp.company} width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0 pb-5">
                <p className="text-sm font-medium text-[#0a0a0a]">{exp.role}</p>
                <p className="text-xs text-[#737373]">{exp.company} &middot; {exp.period}</p>
                <p className="text-xs text-[#525252] mt-1.5 leading-relaxed">{exp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Education</span>
        </div>
        <div className="space-y-4">
          {profile.education.map(edu => (
            <div key={edu.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#f5f5f5] flex-shrink-0">
                <Image src={edu.logo} alt={edu.school} width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0a0a0a]">{edu.school}</p>
                <p className="text-xs text-[#737373]">{edu.degree}</p>
                <p className="text-xs text-[#a3a3a3]">{edu.period}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Skills</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.skills.map(skill => (
            <span key={skill} className="px-3 py-1.5 rounded-full bg-[#f5f5f5] text-xs text-[#525252] border border-[#e5e5e5]">{skill}</span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Interests</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.interests.map(interest => (
            <span key={interest} className="px-3 py-1.5 rounded-full text-xs font-medium text-[#F44444] bg-[#F44444]/5 border border-[#F44444]/15">{interest}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Social Life ───

function SocialLifeTab({ user, profile }: { user: typeof users[0]; profile: ReturnType<typeof generateProfileData> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Followers", value: profile.followers },
          { label: "Following", value: profile.following },
          { label: "Communities", value: String(profile.communities.length) },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
            <span className="text-lg font-bold text-[#0a0a0a]">{stat.value}</span>
            <p className="text-xs text-[#737373] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#737373]" />
            <span className="text-sm font-semibold text-[#0a0a0a]">Connections</span>
          </div>
        </div>
        <div className="space-y-0.5">
          {profile.mutualConnections.map(conn => (
            <Link key={conn.id} href={`/${conn.handle}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#fafafa] transition-colors">
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                {conn.avatar ? (
                  <Image src={conn.avatar} alt={conn.name} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                    <span className="text-sm font-medium text-[#737373]">{conn.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-[#0a0a0a] truncate">{conn.name}</span>
                  <VerifiedBadge className="scale-75" />
                </div>
                <p className="text-xs text-[#737373] truncate">{conn.title}</p>
              </div>
              <span className="text-[10px] text-[#a3a3a3] flex-shrink-0">{conn.mutualCount} mutual</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Communities</span>
        </div>
        <div className="space-y-0.5">
          {profile.communities.map(comm => (
            <div key={comm.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#fafafa] transition-colors">
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                {comm.avatar ? (
                  <Image src={comm.avatar} alt={comm.name} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-[#f5f5f5] flex items-center justify-center">
                    <span className="text-sm font-medium text-[#737373]">{comm.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[#0a0a0a] truncate block">{comm.name}</span>
                <p className="text-xs text-[#737373]">{comm.members} members</p>
              </div>
              <span className="text-[10px] text-[#525252] px-2 py-0.5 rounded-full bg-[#f5f5f5]">{comm.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Achievements ───

function AchievementsTab({ profile }: { profile: ReturnType<typeof generateProfileData> }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Badges</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.badges.map(badge => (
            <span key={badge.id} className="px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: badge.color }}>
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-[#F44444]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Awards & Recognition</span>
        </div>
        <div className="space-y-4">
          {profile.awards.map(award => (
            <div key={award.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F44444]/10 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-[#F44444]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0a0a0a]">{award.title}</p>
                  <span className="text-xs text-[#a3a3a3] flex-shrink-0">{award.year}</span>
                </div>
                <p className="text-xs text-[#737373]">{award.category}</p>
                <p className="text-xs text-[#525252] mt-1">{award.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-[#737373]" />
          <span className="text-sm font-semibold text-[#0a0a0a]">Milestones</span>
        </div>
        <div className="space-y-0">
          {profile.milestones.map((ms, i) => (
            <div key={ms.id} className="flex gap-3 relative">
              {i < profile.milestones.length - 1 && (
                <div className="absolute left-[11px] top-8 w-px h-[calc(100%-8px)] bg-[#e5e5e5]" />
              )}
              <div className="w-6 h-6 rounded-full bg-[#F44444]/10 flex items-center justify-center flex-shrink-0 z-10 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-[#F44444]" />
              </div>
              <div className="flex-1 min-w-0 pb-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#0a0a0a]">{ms.title}</p>
                  <span className="text-xs text-[#a3a3a3] flex-shrink-0">{ms.date}</span>
                </div>
                <p className="text-xs text-[#525252] mt-0.5">{ms.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Awards", value: String(profile.awards.length), icon: Trophy },
          { label: "Milestones", value: String(profile.milestones.length), icon: Target },
          { label: "Badges", value: String(profile.badges.length), icon: Medal },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-center">
            <stat.icon className="w-5 h-5 text-[#F44444] mx-auto mb-2" />
            <span className="text-lg font-bold text-[#0a0a0a] block">{stat.value}</span>
            <p className="text-xs text-[#737373]">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Tab Content Display ───

function CustomTabContent({ tab }: { tab: CustomTab }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="text-sm text-[#262626] leading-relaxed whitespace-pre-wrap">{tab.content}</div>
      </div>
    </div>
  );
}

// ─── Main Page ───

const baseTabs = ["Posts", "About", "Social Life", "Achievements"];

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    const isCustomDomainParam = urlParams.get("_customDomain") === "1";
    const allowedDomains = process.env.NEXT_PUBLIC_ALLOWED_DOMAINS?.split(",") || ["localhost", "albizmedia.com", "www.albizmedia.com"];
    if (!allowedDomains.includes(host) || isCustomDomainParam) {
      setIsCustomDomain(true);
    }
  }, []);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal, currentUserId, userRole } = useContext(AuthContext);
  const { setShowStoryViewer, setStoryViewingUserId } = useContext(StoryContext);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dbProfile, setDbProfile] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [followersModal, setFollowersModal] = useState<"followers" | "following" | null>(null);
  const [viewingHighlight, setViewingHighlight] = useState<number | null>(null);
  const [realStats, setRealStats] = useState<{ followers: number; following: number; posts: number } | null>(null);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [realHasStory, setRealHasStory] = useState(false);
  const [showCircleUpgrade, setShowCircleUpgrade] = useState(false);
  const [showCircleUpgradeSuccess, setShowCircleUpgradeSuccess] = useState(false);
  const [circleUpgradeLoading, setCircleUpgradeLoading] = useState(false);
  const [editState, setEditState] = useState<EditState>({
    name: "", handle: "", title: "", bio: "", location: "", website: "",
    avatar: "", coverPhoto: "",
    experience: [], education: [], skills: [], interests: [], customTabs: [],
    highlights: [],
  });

  const handleCircleUpgrade = async (formData: FormData) => {
    setCircleUpgradeLoading(true);
    try {
      formData.append('userId', currentUserId?.toString() || '');
      
      const response = await fetch('/api/circle-upgrade', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        const error: any = new Error(result.message || 'Failed to submit upgrade request');
        if (result.fieldErrors) {
          error.fieldErrors = result.fieldErrors;
        }
        throw error;
      }
      
      setShowCircleUpgrade(false);
      setShowCircleUpgradeSuccess(true);
    } catch (error: any) {
      console.error('Circle upgrade error:', error);
      // Error is passed to form component for field-specific error display
    } finally {
      setCircleUpgradeLoading(false);
    }
  };

  // Fetch profile from DB (skip reserved paths)
  const reservedPaths = ["login", "signup", "settings", "messages", "admin", "api", "explore", "saved", "notifications", "analytics"];
  useEffect(() => {
    if (reservedPaths.includes(handle)) return;
    setDbLoading(true);
    api.getUserProfile(handle)
      .then(data => setDbProfile(data))
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, [handle]);

  // Find user: local static data first, then DB profile
  const isCircle = userRole === "CIRCLE" || userRole === "ADMIN";
  const localUser = users.find(u => u.handle === handle);
  const user = localUser || (dbProfile ? {
    id: dbProfile.id, name: dbProfile.name, handle: dbProfile.handle,
    title: dbProfile.title, avatar: dbProfile.avatar, verified: dbProfile.verified,
    isPremium: dbProfile.isPremium, hasStory: dbProfile.hasStory, role: dbProfile.role,
  } as typeof users[0] : null);

  // Fetch real stats from DB
  useEffect(() => {
    if (user?.id) {
      api.getUserStats(user.id).then(setRealStats).catch(() => {});
      // Check real story status from DB
      api.getStories(user.id).then((data: any) => {
        const count = (data.storyUsers || []).reduce((s: number, su: any) => s + su.stories.length, 0);
        setRealHasStory(count > 0);
      }).catch(() => {});
      if (currentUserId && user.id !== currentUserId) {
        api.getBlockedUsers(currentUserId).then(list => {
          setIsBlockedByMe(list.some((b: any) => b.blockedId === user.id));
        }).catch(() => {});
      }
    }
  }, [user?.id, currentUserId]);

  // Show loading spinner while DB is still fetching (only if no local match)
  if (!user && dbLoading) {
    return (
      <main className="flex-1 min-w-0 bg-white overflow-y-auto flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#e5e5e5] border-t-[#F44444] rounded-full animate-spin" />
      </main>
    );
  }

  if (!user) {
    return (
      <>
        <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-[#737373]">User not found</p>
            {!isCustomDomain && (
              <Link href="/" className="text-[#F44444] text-sm font-medium mt-2 inline-block hover:underline">Back to feed</Link>
            )}
          </div>
        </main>
        {!isCustomDomain && <RightSidebar />}
      </>
    );
  }

  // Show blocked state
  if (isBlockedByMe && !isCustomDomain) {
    return (
      <>
        <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto flex items-center justify-center py-20">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-[#a3a3a3]" />
            </div>
            <p className="text-lg font-semibold text-[#0a0a0a] mb-1">@{user.handle} is blocked</p>
            <p className="text-sm text-[#737373] mb-4">You won&apos;t see their posts, stories, or profile. You can unblock them in Settings &gt; Privacy &amp; Safety.</p>
            <div className="flex gap-2 justify-center">
              <Link href="/" className="px-4 py-2 text-sm font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">Back to feed</Link>
              <button
                onClick={async () => {
                  await api.unblockUser(currentUserId, user.id).catch(() => {});
                  setIsBlockedByMe(false);
                }}
                className="px-4 py-2 text-sm font-medium rounded-full bg-[#F44444] text-white hover:bg-[#d63c3c] transition-colors"
              >
                Unblock
              </button>
            </div>
          </div>
        </main>
        <RightSidebar />
      </>
    );
  }

  const profile = generateProfileData(user.id);
  const isOwnProfile = user.id === currentUserId && !isCustomDomain;
  const isFollowing = following.has(user.id);

  // Display values: DB > generated defaults
  const db = dbProfile;
  const displayName = db?.name || user.name;
  const displayTitle = db?.title || user.title;
  const displayLocation = db?.location || profile.location;
  const displayWebsite = db?.website || profile.website;
  const displayBio = db?.bio || profile.bio;
  const displayAvatar = db?.avatar || user.avatar;
  const displayCover = db?.coverPhoto || "";
  const displayExperience = db?.experience?.length ? db.experience : profile.experience;
  const displayEducation = db?.education?.length ? db.education : profile.education;
  const displaySkills = db?.skills?.length ? db.skills : profile.skills;
  const displayInterests = db?.interests?.length ? db.interests : profile.interests;
  const customTabs = db?.customTabs?.length ? db.customTabs : [];
  const displayHighlights = db?.highlights?.length ? db.highlights : profile.highlights;

  const allTabs = [...baseTabs, ...customTabs.filter((t: any) => t.title?.trim()).map((t: any) => t.title)];

  const handleFollow = () => {
    if (!isSignedIn) { openAuthModal("signin"); return; }
    toggleFollow(user.id);
  };

  const handleStartEdit = () => {
    setEditState({
      name: displayName,
      handle: db?.handle || user.handle,
      title: displayTitle,
      bio: displayBio,
      location: displayLocation,
      website: displayWebsite,
      avatar: displayAvatar,
      coverPhoto: displayCover,
      experience: JSON.parse(JSON.stringify(displayExperience)),
      education: JSON.parse(JSON.stringify(displayEducation)),
      skills: [...displaySkills],
      interests: [...displayInterests],
      customTabs: JSON.parse(JSON.stringify(customTabs)),
      highlights: JSON.parse(JSON.stringify(displayHighlights)),
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const currentHandle = db?.handle || user.handle;
      const result = await api.updateUserProfile(currentHandle, {
        requestingUserId: currentUserId,
        name: editState.name,
        handle: editState.handle,
        title: editState.title,
        bio: editState.bio,
        location: editState.location,
        website: editState.website,
        avatar: editState.avatar,
        coverPhoto: editState.coverPhoto,
        experience: editState.experience,
        education: editState.education,
        skills: editState.skills,
        interests: editState.interests,
        customTabs: editState.customTabs,
        highlights: editState.highlights,
      });

      setIsEditing(false);

      // Refresh from DB
      const newHandle = result.handle || editState.handle;
      const refreshed = await api.getUserProfile(newHandle);
      setDbProfile(refreshed);

      const newAllTabs = [...baseTabs, ...(editState.customTabs || []).filter(t => t.title.trim()).map(t => t.title)];
      if (activeTab >= newAllTabs.length) setActiveTab(0);

      // Navigate to new handle URL if it changed
      if (newHandle !== handle) {
        router.replace(`/${newHandle}`);
        return; // router.replace will remount with the new handle
      }
    } catch (err) {
      console.error("Save failed:", err);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const tabContent = () => {
    const profileWithOverrides = {
      ...profile,
      bio: displayBio,
      experience: displayExperience,
      education: displayEducation,
      skills: displaySkills,
      interests: displayInterests,
    };

    if (activeTab === 0) return <PostsTab user={user} profile={profile} />;
    if (activeTab === 1) return <AboutTab profile={profileWithOverrides} />;
    if (activeTab === 2) return <SocialLifeTab user={user} profile={profile} />;
    if (activeTab === 3) return <AchievementsTab profile={profile} />;

    const customTabIndex = activeTab - baseTabs.length;
    const visibleCustomTabs = customTabs.filter((t: any) => t.title?.trim());
    if (customTabIndex >= 0 && customTabIndex < visibleCustomTabs.length) {
      return <CustomTabContent tab={visibleCustomTabs[customTabIndex]} />;
    }

    return <PostsTab user={user} profile={profile} />;
  };

  return (
    <>
      <main className="flex-1 min-w-0 bg-white overflow-y-auto">
        {!isCustomDomain && (
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#f0f0f0] px-4 sm:px-6 py-2 md:py-3 flex items-center justify-between">
            <Link href="/" className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
          </div>
        )}

        {/* Banner image only for Circle/Author users */}
        {(user.role === "CIRCLE" || user.role === "ADMIN" || user.role === "AUTHOR") && (
          <ProfileHeader
            user={user}
            profile={profile}
            isEditing={isEditing}
            editState={isEditing ? editState : undefined}
            setEditState={isEditing ? setEditState : undefined}
            displayAvatar={!isEditing ? displayAvatar : undefined}
            displayCover={!isEditing ? (displayCover || undefined) : undefined}
            hasActiveStory={realHasStory}
            onAvatarClick={() => {
              setStoryViewingUserId(user.id);
              setShowStoryViewer(true);
            }}
          />
        )}

        {isEditing ? (
          <EditProfileInline
            user={user}
            profile={profile}
            editState={editState}
            setEditState={setEditState}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        ) : (
          <>
            {/* UserInfoSection only for Circle/Author/Admin users */}
            {(user.role === "CIRCLE" || user.role === "ADMIN" || user.role === "AUTHOR") && (
              <UserInfoSection
                user={user}
                profile={profile}
                isFollowing={isFollowing}
                onFollow={handleFollow}
                isOwnProfile={isOwnProfile}
                onEditProfile={handleStartEdit}
                displayName={displayName}
                displayTitle={displayTitle}
                displayLocation={displayLocation}
                displayWebsite={displayWebsite}
                isCustomDomain={isCustomDomain}
                onShowFollowers={setFollowersModal}
                realStats={realStats}
              />
            )}

            {/* Normal user profile enhancements - upload profile picture with overlay button */}
            {(user.role === "NORMAL" || !user.role || (user.role !== "CIRCLE" && user.role !== "ADMIN" && user.role !== "AUTHOR")) && isOwnProfile && (
              <div className="px-4 md:px-8 pt-8 pb-6">
                <div className="flex flex-col items-center mb-8">
                  <div className="relative mb-4">
                    <div className="w-32 h-32 rounded-full overflow-hidden ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white">
                      {displayAvatar ? (
                        <Image src={displayAvatar} alt={displayName} width={128} height={128} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full bg-[#f0f0f0] flex items-center justify-center"><User className="w-12 h-12 text-[#a3a3a3]" /></div>
                      )}
                    </div>
                    <button
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                      className="absolute bottom-0 right-0 w-10 h-10 bg-[#F44444] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#d64d3c] transition-colors"
                    >
                      <ImagePlus className="w-5 h-5" />
                    </button>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const uploadRes = await api.uploadAvatar(file);
                          if (uploadRes.url) {
                            await api.updateAvatar(uploadRes.url);
                            window.location.reload();
                          }
                        } catch (err) {
                          console.error("Upload failed:", err);
                        }
                      }}
                    />
                  </div>
                  <h2 className="text-2xl font-semibold text-[#0a0a0a]">{displayName}</h2>
                </div>

                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-full bg-gradient-to-r from-[#CBCBCB] to-[#D3D3D3] rounded-xl p-4 text-black">
                    <p className="text-sm font-semibold mb-1 text-black">Unlock messaging, analytics, and more</p>
                    <p className="text-xs opacity-90">Get access to premium features</p>
                  </div>

                  <button
                    onClick={() => setShowCircleUpgrade(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F44444] rounded-xl text-sm font-medium text-white hover:bg-[#d63c3c] transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    Upgrade to Circle
                  </button>
                </div>
              </div>
            )}

            {/* Suggested Profiles for normal users on their own profile */}
            {(user.role === "NORMAL" || !user.role || (user.role !== "CIRCLE" && user.role !== "ADMIN" && user.role !== "AUTHOR")) && isOwnProfile && <SuggestedProfiles />}

            {/* Profile activity sections - available for all users */}
            <>
              <HighlightsRow highlights={displayHighlights} onViewHighlight={setViewingHighlight} />

              <div className="border-b border-[#e5e5e5]">
                <div className="px-4 md:px-8 flex gap-1 overflow-x-auto">
                  {allTabs.map((tab, i) => (
                    <button
                      key={`${tab}-${i}`}
                      onClick={() => setActiveTab(i)}
                      className={`px-3 md:px-4 py-2.5 md:py-3 text-[13px] md:text-sm font-medium whitespace-nowrap transition-colors relative ${
                        i === activeTab ? "text-[#F44444]" : "text-[#737373] hover:text-[#0a0a0a]"
                      }`}
                    >
                      {tab}
                      {i === activeTab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F44444]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-6 px-4 md:px-8 py-4">
                <div className="flex-1 min-w-0 space-y-4">
                  {tabContent()}
                </div>
                <ProfileRightSidebar profile={profile} isCustomDomain={isCustomDomain} />
              </div>
            </>
          </>
        )}

        {isCustomDomain && (db?.showBranding !== false) && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-[#f0f0f0] px-4 py-2.5 flex items-center justify-center gap-2">
            <AlbizLogo size={16} />
            <span className="text-xs text-[#a3a3a3]">Powered by</span>
            <a href="https://albizmedia.com" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#525252] hover:text-[#F44444] transition-colors">
              Albiz Media
            </a>
          </div>
        )}
      </main>

      {/* Followers/Following Modal */}
      {followersModal && (
        <FollowersModal userId={user.id} type={followersModal} onClose={() => setFollowersModal(null)} />
      )}

      {/* Highlight Viewer */}
      {viewingHighlight !== null && (
        <HighlightViewer
          highlights={displayHighlights}
          startIndex={viewingHighlight}
          onClose={() => setViewingHighlight(null)}
        />
      )}

      {/* Circle Upgrade Modal */}
      {showCircleUpgrade && (
        <CircleUpgradeForm 
          onSubmit={handleCircleUpgrade} 
          loading={circleUpgradeLoading}
          onClose={() => setShowCircleUpgrade(false)} 
        />
      )}

      {/* Circle Upgrade Success Modal */}
      {showCircleUpgradeSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCircleUpgradeSuccess(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="w-16 h-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Upgrade Request Submitted!</h2>
              <p className="text-sm text-[#737373] mb-6">
                Your Circle upgrade request has been submitted successfully. You'll receive an email confirmation shortly.
              </p>
              <button 
                onClick={() => setShowCircleUpgradeSuccess(false)}
                className="w-full py-2.5 rounded-xl bg-[#22c55e] text-white font-medium hover:bg-[#16a34a] transition-colors cursor-pointer"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
