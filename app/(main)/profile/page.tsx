"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  Search,
  Bell,
  Mail,
  Bookmark,
  BarChart3,
  Settings,
  User,
  Plus,
  ArrowLeft,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MoreHorizontal,
  Share2,
  ImagePlus,
  Smile,
  MapPin,
  Hash,
  AtSign,
  Check,
  Circle,
  TrendingUp,
  Trophy,
  Eye,
  Users,
  FileText,
  ExternalLink,
  Building2,
  Globe,
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  Calendar,
  Award,
  Target,
  DollarSign,
  Star,
} from "lucide-react";

// navItems removed — navigation handled by (main)/layout.tsx

// Current user data
const currentUser = {
  id: 1,
  name: "Jessin Sam S",
  handle: "jessinsam",
  title: "Founder @ Example.com",
  avatar: "/Jess-profile.jpg",
  coverPhoto: "https://picsum.photos/seed/cover-profile/1200/400",
  verified: true,
  isPremium: true,
  bio: "Building the future of business connections. Passionate about startups, technology, and making meaningful connections.",
  location: "San Francisco, CA",
  website: "example.com",
  joinedDate: "January 2023",
  stats: {
    followers: "150k",
    following: "1500",
    posts: "1205",
  },
  netWorth: "$2.5M",
  ranking: "#127",
  profileViews: "45.2k",
  searchAppearances: "12.8k",
  socialLinks: {
    twitter: "jessinsam",
    linkedin: "jessinsam",
    instagram: "jessinsam",
    youtube: "jessinsam",
  },
};

// Companies data
const companies = [
  {
    id: 1,
    name: "Example Inc.",
    role: "Founder & CEO",
    logo: "https://picsum.photos/seed/company1/100",
    period: "2021 - Present",
  },
  {
    id: 2,
    name: "Tech Ventures",
    role: "Advisor",
    logo: "https://picsum.photos/seed/company2/100",
    period: "2023 - Present",
  },
  {
    id: 3,
    name: "StartupX",
    role: "Co-founder",
    logo: "https://picsum.photos/seed/company3/100",
    period: "2019 - 2021",
  },
];

// Highlights data
const highlights = [
  {
    id: 1,
    title: "Forbes 30 Under 30",
    year: "2024",
    icon: Award,
  },
  {
    id: 2,
    title: "TechCrunch Disrupt Winner",
    year: "2023",
    icon: Trophy,
  },
  {
    id: 3,
    title: "Y Combinator Alumni",
    year: "2022",
    icon: Target,
  },
];

// Recent stories data
const recentStories = [
  {
    id: 1,
    image: "https://picsum.photos/seed/story1/200/300",
    time: "2h ago",
  },
  {
    id: 2,
    image: "https://picsum.photos/seed/story2/200/300",
    time: "5h ago",
  },
  {
    id: 3,
    image: "https://picsum.photos/seed/story3/200/300",
    time: "1d ago",
  },
];

// Posts data
const userPosts = [
  {
    id: 1,
    content: "Excited to announce that Example.com has secured $10M in Series A funding! Thank you to all our investors and supporters who believed in our vision. This is just the beginning.",
    date: "Dec 12th 2025",
    time: "1:56 PM",
    image: "https://picsum.photos/seed/post1/800/500",
    stats: { views: "12k", likes: "3.2k", comments: "456", shares: "234" },
  },
  {
    id: 2,
    content: "Just wrapped up an amazing panel discussion at TechCrunch Disrupt. The future of AI in business is incredibly exciting. Here are my key takeaways...",
    date: "Dec 10th 2025",
    time: "4:30 PM",
    stats: { views: "8.5k", likes: "2.1k", comments: "189", shares: "145" },
  },
  {
    id: 3,
    content: "Building in public has been one of the best decisions for Example.com. Transparency builds trust, and trust builds community. Here's what we learned...",
    date: "Dec 8th 2025",
    time: "10:15 AM",
    image: "https://picsum.photos/seed/post3/800/500",
    stats: { views: "15k", likes: "4.5k", comments: "567", shares: "312" },
  },
];

const profileTabs = ["Posts", "About", "Social Life", "News", "Achievements"];

function AlbizLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * (104/121)} viewBox="0 0 121 104" fill="none">
      <path d="M71.9121 20.311L59.8833 0L9.15527e-05 103.861H23.2838L71.9121 20.311Z" fill="#FF4444"/>
      <path d="M96.0998 62.0821L83.9408 41.9091L47.9848 103.861H71.9121L96.0998 62.0821Z" fill="#FF4444"/>
      <path d="M120.15 103.861L108.381 83.2972L96.0998 103.861H120.15Z" fill="#FF4444"/>
      <path d="M108.058 83.3157L96.1438 62.4531L84.0538 83.3157L96.1438 103.795L108.058 83.3157Z" fill="#AF1212"/>
      <path d="M47.661 62.4531L60.0422 83.3157L47.661 103.795L35.7549 82.5496L47.661 62.4531Z" fill="#AF1212"/>
    </svg>
  );
}

function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Circle className="w-3.5 h-3.5 fill-[#F44444] text-[#F44444]" />
      <Check className="w-2 h-2 text-white absolute" strokeWidth={3} />
    </span>
  );
}

// LeftSidebar removed — provided by (main)/layout.tsx

function ProfileHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e5e5] px-4 py-3">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#525252]" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#0a0a0a]">{currentUser.name}</span>
              <VerifiedBadge />
            </div>
            <span className="text-xs text-[#737373]">{currentUser.stats.posts} posts</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-[#525252]" />
          </button>
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <Share2 className="w-5 h-5 text-[#525252]" />
          </button>
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <MoreHorizontal className="w-5 h-5 text-[#525252]" />
          </button>
        </div>
      </div>
    </header>
  );
}

function CoverSection() {
  return (
    <div className="relative px-4 md:px-8 pt-4">
      {/* Cover Photo */}
      <div className="h-48 md:h-64 lg:h-72 w-full overflow-hidden rounded-2xl relative">
        <Image
          src={currentUser.coverPhoto}
          alt="Cover"
          width={1200}
          height={400}
          className="object-cover w-full h-full"
          priority
        />
        {/* Edit Cover Button */}
        <button className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm text-[#0a0a0a] text-sm font-medium rounded-lg hover:bg-white transition-colors">
          Edit Cover
        </button>
      </div>
      
      {/* Profile Avatar */}
      <div className="absolute -bottom-16 left-4 md:left-8">
        <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden ring-4 ring-white bg-white">
          <Image
            src={currentUser.avatar}
            alt={currentUser.name}
            width={128}
            height={128}
            className="object-cover w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}

function UserInfoSection() {
  return (
    <div className="px-4 md:px-8 pt-20 pb-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0a0a0a]">{currentUser.name}</h1>
            <VerifiedBadge className="scale-125" />
            {currentUser.isPremium && (
              <span className="px-2 py-0.5 bg-[#F44444] text-white text-xs font-medium rounded-full">Premium</span>
            )}
          </div>
          <p className="text-[#737373] mt-1">{currentUser.title}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-[#737373]">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              {currentUser.location}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Globe className="w-4 h-4 flex-shrink-0" />
              {currentUser.website}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              Joined {currentUser.joinedDate}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-[#F44444] text-white text-sm font-medium rounded-full hover:bg-[#d64d3c] transition-colors">
            Edit Profile
          </button>
          <button className="p-2 border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors">
            <Settings className="w-5 h-5 text-[#525252]" />
          </button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="flex items-center gap-6 mt-6">
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{currentUser.stats.followers}</span>
          <p className="text-sm text-[#737373]">Followers</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{currentUser.stats.following}</span>
          <p className="text-sm text-[#737373]">Following</p>
        </div>
        <div className="w-px h-10 bg-[#e5e5e5]" />
        <div className="text-center">
          <span className="text-xl font-bold text-[#0a0a0a]">{currentUser.stats.posts}</span>
          <p className="text-sm text-[#737373]">Posts</p>
        </div>
      </div>
    </div>
  );
}

function CreatePostSection() {
  const [postContent, setPostContent] = useState("");

  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] mb-4">
      <div className="flex items-center gap-2.5 sm:gap-3 mb-2">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0">
          <Image
            src={currentUser.avatar}
            alt={currentUser.name}
            width={40}
            height={40}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex items-center gap-1">
          {[Bold, Italic, LinkIcon, List, ListOrdered].map((Icon, i) => (
            <button
              key={i}
              className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]"
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={postContent}
        onChange={(e) => setPostContent(e.target.value)}
        placeholder="What's on your mind?"
        className="w-full bg-[#f5f5f5] rounded-xl p-3 text-sm resize-none outline-none min-h-[80px] focus:ring-2 focus:ring-[#F44444]/20 transition-all"
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-0.5 sm:gap-1">
          {[ImagePlus, Smile, MapPin, Hash, AtSign].map((Icon, i) => (
            <button
              key={i}
              className="p-1.5 sm:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]"
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F44444] text-white text-sm font-medium rounded-full hover:bg-[#d64d3c] transition-colors">
          Post
        </button>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: typeof userPosts[0] }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-200">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0">
          <Image
            src={currentUser.avatar}
            alt={currentUser.name}
            width={40}
            height={40}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-wrap">
              <span className="font-medium text-sm text-[#0a0a0a] truncate">{currentUser.name}</span>
              <VerifiedBadge className="scale-90 flex-shrink-0" />
              <span className="text-[#a3a3a3] text-xs">·</span>
              <span className="text-[#737373] text-xs whitespace-nowrap">{post.date}</span>
            </div>
            <button className="p-1 hover:bg-[#f5f5f5] rounded transition-colors flex-shrink-0">
              <MoreHorizontal className="w-4 h-4 text-[#737373]" />
            </button>
          </div>
          
          <p className="text-[#262626] text-sm mt-2">{post.content}</p>
          
          {post.image && (
            <div className="rounded-xl overflow-hidden mt-3">
              <Image
                src={post.image}
                alt="Post image"
                width={800}
                height={500}
                className="object-cover w-full"
              />
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-3 text-[#737373]">
            <span className="flex items-center gap-1 text-xs">
              <Eye className="w-4 h-4" />
              {post.stats.views}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Star className="w-4 h-4" />
              {post.stats.likes}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <FileText className="w-4 h-4" />
              {post.stats.comments}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Share2 className="w-4 h-4" />
              {post.stats.shares}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetWorthCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Net Worth</span>
        <DollarSign className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#0a0a0a]">{currentUser.netWorth}</span>
        <span className="text-xs text-green-500 flex items-center gap-0.5">
          <TrendingUp className="w-3 h-3" />
          +12.5%
        </span>
      </div>
      <p className="text-xs text-[#737373] mt-1">Estimated value</p>
    </div>
  );
}

function RankingsCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Rankings</span>
        <Trophy className="w-4 h-4 text-[#F44444]" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#525252]">Global</span>
          <span className="text-sm font-semibold text-[#0a0a0a]">{currentUser.ranking}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#525252]">Technology</span>
          <span className="text-sm font-semibold text-[#0a0a0a]">#45</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#525252]">Startups</span>
          <span className="text-sm font-semibold text-[#0a0a0a]">#12</span>
        </div>
      </div>
    </div>
  );
}

function ProfileStatsCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Profile Stats</span>
        <BarChart3 className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#525252] flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Profile views
          </span>
          <span className="text-sm font-semibold text-[#0a0a0a]">{currentUser.profileViews}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#525252] flex items-center gap-2">
            <Users className="w-4 h-4" />
            Search appearances
          </span>
          <span className="text-sm font-semibold text-[#0a0a0a]">{currentUser.searchAppearances}</span>
        </div>
      </div>
    </div>
  );
}

function LinksCard() {
  const socialIcons = {
    twitter: Twitter,
    linkedin: Linkedin,
    instagram: Instagram,
    youtube: Youtube,
  };
  
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Links</span>
        <ExternalLink className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="flex items-center gap-2">
        {Object.entries(currentUser.socialLinks).map(([platform, handle]) => {
          const Icon = socialIcons[platform as keyof typeof socialIcons];
          return (
            <button
              key={platform}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#f5f5f5] hover:bg-[#ebebeb] transition-colors"
            >
              <Icon className="w-4 h-4 text-[#525252]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HighlightsCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Highlights</span>
        <Award className="w-4 h-4 text-[#F44444]" />
      </div>
      <div className="space-y-3">
        {highlights.map((highlight) => (
          <div key={highlight.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F44444]/10 flex items-center justify-center">
              <highlight.icon className="w-4 h-4 text-[#F44444]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0a0a0a] truncate">{highlight.title}</p>
              <p className="text-xs text-[#737373]">{highlight.year}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompaniesCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Companies</span>
        <Building2 className="w-4 h-4 text-[#737373]" />
      </div>
      <div className="space-y-3">
        {companies.map((company) => (
          <div key={company.id} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#f5f5f5]">
              <Image
                src={company.logo}
                alt={company.name}
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0a0a0a] truncate">{company.name}</p>
              <p className="text-xs text-[#737373]">{company.role}</p>
            </div>
            <span className="text-xs text-[#a3a3a3]">{company.period}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentStoriesCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#0a0a0a]">Recent Stories</span>
        <button className="text-xs text-[#F44444] font-medium hover:underline">View all</button>
      </div>
      <div className="flex gap-2">
        {recentStories.map((story) => (
          <div key={story.id} className="relative w-20 h-28 rounded-xl overflow-hidden flex-shrink-0">
            <Image
              src={story.image}
              alt="Story"
              fill
              className="object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
              <span className="text-white text-[10px]">{story.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RightSidebar() {
  return (
    <aside className="hidden lg:block w-80 flex-shrink-0 space-y-4 py-4 pl-4">
      <NetWorthCard />
      <RankingsCard />
      <ProfileStatsCard />
      <LinksCard />
      <HighlightsCard />
      <CompaniesCard />
      <RecentStoriesCard />
    </aside>
  );
}

function MainContent() {
  const [activeTab, setActiveTab] = useState(0);
  
  return (
    <div className="flex-1 min-w-0">
      <CoverSection />
      <UserInfoSection />
      
      {/* Tabs with border spanning full width including sidebar */}
      <div className="border-b border-[#e5e5e5]">
        <div className="px-4 md:px-8 flex gap-1 overflow-x-auto">
          {profileTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                i === activeTab
                  ? "text-[#F44444]"
                  : "text-[#737373] hover:text-[#0a0a0a]"
              }`}
            >
              {tab}
              {i === activeTab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F44444]" />
              )}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex gap-6 px-4 md:px-8 py-4">
        {/* Posts Feed */}
        <div className="flex-1 min-w-0 space-y-4">
          <CreatePostSection />
          {userPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
        
        {/* Right Sidebar */}
        <RightSidebar />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <main className="flex-1 min-w-0 bg-white overflow-y-auto">
      <MainContent />
    </main>
  );
}
