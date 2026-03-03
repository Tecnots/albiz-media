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
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
  Users,
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
} from "lucide-react";
import { FollowingContext, AuthContext } from "@/app/lib/contexts";
import { users, posts } from "@/app/lib/data";
import { RightSidebar, AlbizLogo } from "@/app/lib/shared-components";

import { api } from "@/app/lib/api";

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

function CoverSection({
  user,
  isEditing,
  editState,
  setEditState,
  displayAvatar,
  displayCover,
}: {
  user: typeof users[0];
  isEditing?: boolean;
  editState?: EditState;
  setEditState?: (s: EditState) => void;
  displayAvatar?: string;
  displayCover?: string;
}) {
  const coverRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const coverSrc = displayCover || `https://picsum.photos/seed/cover-${user.handle}/1200/400`;
  const avatarSrc = displayAvatar || user.avatar;

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editState && setEditState) {
      const url = URL.createObjectURL(file);
      setEditState({ ...editState, coverPhoto: url });
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editState && setEditState) {
      const url = URL.createObjectURL(file);
      setEditState({ ...editState, avatar: url });
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
        <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden ring-4 ring-white bg-white relative group">
          <Image src={isEditing && editState?.avatar ? editState.avatar : avatarSrc} alt={user.name} width={128} height={128} className="object-cover w-full h-full" />
          {isEditing && (
            <>
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
              <button
                onClick={() => avatarRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit State Type ───

type ExperienceItem = { id: number; role: string; company: string; logo: string; period: string; description: string };
type EducationItem = { id: number; school: string; degree: string; period: string; logo: string };
type CustomTab = { id: number; title: string; content: string };

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
      <div className="flex items-center gap-6 mt-6 mb-6">
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{profile.followers}</span>
          <p className="text-sm text-[#737373]">Followers</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{profile.following}</span>
          <p className="text-sm text-[#737373]">Following</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{profile.postsCount}</span>
          <p className="text-sm text-[#737373]">Posts</p>
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
}) {
  return (
    <div className="px-4 md:px-8 pt-20 pb-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0a0a0a]">{displayName}</h1>
            {user.verified && <VerifiedBadge className="scale-125" />}
            {user.role === "CIRCLE" && (
              <span className="px-2 py-0.5 bg-[#F44444] text-white text-xs font-medium rounded-full">Circle</span>
            )}
          </div>
          <p className="text-[#737373] mt-1">{displayTitle}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-[#737373]">
            {displayLocation && <span className="flex items-center gap-1 whitespace-nowrap"><MapPin className="w-4 h-4 flex-shrink-0" />{displayLocation}</span>}
            {displayWebsite && <span className="flex items-center gap-1 whitespace-nowrap"><Globe className="w-4 h-4 flex-shrink-0" />{displayWebsite}</span>}
            <span className="flex items-center gap-1 whitespace-nowrap"><Calendar className="w-4 h-4 flex-shrink-0" />Joined {profile.joinedDate}</span>
          </div>
        </div>
        {!isCustomDomain && (
          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <button
                onClick={onEditProfile}
                className="px-5 py-2 text-sm font-medium rounded-full bg-[#F44444] text-white hover:bg-[#d63c3c] transition-all active:scale-95 flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={onFollow}
                  className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                    isFollowing
                      ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                      : "bg-[#F44444] text-white hover:bg-[#d63c3c]"
                  } active:scale-95`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
                <button className="p-2 border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors">
                  <Mail className="w-5 h-5 text-[#525252]" />
                </button>
              </>
            )}
            <button className="p-2 border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors">
              <MoreHorizontal className="w-5 h-5 text-[#525252]" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-6 mt-6">
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{profile.followers}</span>
          <p className="text-sm text-[#737373]">Followers</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{profile.following}</span>
          <p className="text-sm text-[#737373]">Following</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{profile.postsCount}</span>
          <p className="text-sm text-[#737373]">Posts</p>
        </div>
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
              <Image src={conn.avatar} alt={conn.name} width={32} height={32} className="object-cover w-full h-full" />
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
          <Image src={user.avatar} alt={user.name} width={40} height={40} className="object-cover w-full h-full" />
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

function PostsTab({ user, profile }: { user: typeof users[0]; profile: ReturnType<typeof generateProfileData> }) {
  // Also include any posts from the global feed that belong to this user
  const feedPosts = posts.filter(p => p.userId === user.id && p.type === "post");

  return (
    <>
      {profile.userPosts.map(post => (
        <PostCard key={post.id} user={user} post={post} />
      ))}
      {feedPosts.map(post => (
        <div key={`feed-${post.id}`} className="bg-white rounded-xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-200">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0">
              <Image src={user.avatar} alt={user.name} width={40} height={40} className="object-cover w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-wrap">
                <span className="font-medium text-sm text-[#0a0a0a] truncate">{user.name}</span>
                {user.verified && <VerifiedBadge className="scale-90 flex-shrink-0" />}
                <span className="text-[#a3a3a3] text-xs">&middot;</span>
                <span className="text-[#737373] text-xs">{post.date}</span>
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
      ))}
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
                <Image src={conn.avatar} alt={conn.name} width={40} height={40} className="object-cover w-full h-full" />
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
                <Image src={comm.avatar} alt={comm.name} width={40} height={40} className="object-cover w-full h-full" />
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
    if (host !== "localhost" && host !== "albizmedia.com" && host !== "www.albizmedia.com") {
      setIsCustomDomain(true);
    }
  }, []);
  const { following, toggleFollow } = useContext(FollowingContext);
  const { isSignedIn, openAuthModal, currentUserId, userRole } = useContext(AuthContext);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dbProfile, setDbProfile] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [editState, setEditState] = useState<EditState>({
    name: "", handle: "", title: "", bio: "", location: "", website: "",
    avatar: "", coverPhoto: "",
    experience: [], education: [], skills: [], interests: [], customTabs: [],
  });

  // Fetch profile from DB
  useEffect(() => {
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

  const profile = generateProfileData(user.id);
  const isOwnProfile = user.id === currentUserId && isCircle && !isCustomDomain;
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
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#f0f0f0] px-4 sm:px-6 py-3 flex items-center justify-between">
            <Link href="/" className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            {isOwnProfile && !isEditing && (
              <span className="text-xs text-[#a3a3a3]">@{db?.handle || user.handle}</span>
            )}
          </div>
        )}

        <CoverSection
          user={user}
          isEditing={isEditing}
          editState={isEditing ? editState : undefined}
          setEditState={isEditing ? setEditState : undefined}
          displayAvatar={!isEditing ? displayAvatar : undefined}
          displayCover={!isEditing ? (displayCover || undefined) : undefined}
        />

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
            />

            <div className="border-b border-[#e5e5e5]">
              <div className="px-4 md:px-8 flex gap-1 overflow-x-auto">
                {allTabs.map((tab, i) => (
                  <button
                    key={`${tab}-${i}`}
                    onClick={() => setActiveTab(i)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
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
    </>
  );
}
