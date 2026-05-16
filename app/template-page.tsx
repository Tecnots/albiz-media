"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, createContext, useContext, useEffect, useRef } from "react";
import { ReadButton } from "@/app/lib/shared-components";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Search,
  Compass,
  Users,
  Bell,
  Mail,
  Bookmark,
  BarChart3,
  Settings,
  SlidersHorizontal,
  User,
  MoreVertical,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  Circle,
  Check,
  Plus,
  Menu,
  X,
  ArrowLeft,
  Clock,
  Heart,
  Send,
  BookmarkPlus,
  Link2,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Smile,
  MapPin,
  Hash,
  AtSign,
  ImagePlus,
  PenLine,
  CircleDashed,
  TrendingUp,
  Filter,
  Building2,
  ChevronRight,
  Mic,
  FolderOpen,
  ChevronDown,
  ArrowUp,
  LogOut,
  EyeOff,
} from "lucide-react";

// Context for following state
const FollowingContext = createContext<{
  following: Set<number>;
  toggleFollow: (userId: number) => void;
}>({ following: new Set(), toggleFollow: () => {} });

// Context for article detail view
const ArticleContext = createContext<{
  selectedArticle: number | null;
  setSelectedArticle: (id: number | null) => void;
}>({ selectedArticle: null, setSelectedArticle: () => {} });

// Context for create post modal
const CreatePostContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

// Context for create story modal
const CreateStoryContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

// Context for active navigation view
const NavContext = createContext<{
  activeView: string;
  setActiveView: (view: string) => void;
}>({ activeView: "Activities", setActiveView: () => {} });

// Context for auth state
const AuthContext = createContext<{
  isSignedIn: boolean;
  userRole: "CIRCLE" | "NORMAL" | null;
  signOut: () => void;
  signIn: (role?: "CIRCLE" | "NORMAL") => void;
  openAuthModal: (mode: "signin" | "signup") => void;
}>({ isSignedIn: true, userRole: "CIRCLE", signOut: () => {}, signIn: () => {}, openAuthModal: () => {} });

// Demo accounts for validation (matches seeded data)
const demoAccounts = [
  { id: 1, email: "jessinsam@demo.albiz.com", password: "demo123", name: "Jessin Sam S", role: "CIRCLE" },
  { id: 2, email: "openai@demo.albiz.com", password: "demo123", name: "Open AI", role: "CIRCLE" },
  { id: 3, email: "nikhilkamath@demo.albiz.com", password: "demo123", name: "Nikhil Kamath", role: "CIRCLE" },
  { id: 4, email: "elonmusk@demo.albiz.com", password: "demo123", name: "Elon Musk", role: "CIRCLE" },
  { id: 5, email: "realdonaldtrump@demo.albiz.com", password: "demo123", name: "Donald J. Trump", role: "NORMAL" },
  { id: 6, email: "ycombinator@demo.albiz.com", password: "demo123", name: "Y Combinator", role: "CIRCLE" },
  { id: 7, email: "satyanadella@demo.albiz.com", password: "demo123", name: "Satya Nadella", role: "CIRCLE" },
  { id: 8, email: "aaditpalicha@demo.albiz.com", password: "demo123", name: "Aadit Palicha", role: "CIRCLE" },
  { id: 9, email: "priyasharma@demo.albiz.com", password: "demo123", name: "Priya Sharma", role: "NORMAL" },
  { id: 10, email: "alexchen@demo.albiz.com", password: "demo123", name: "Alex Chen", role: "NORMAL" },
  { id: 11, email: "sarahjohnson@demo.albiz.com", password: "demo123", name: "Sarah Johnson", role: "NORMAL" },
  { id: 12, email: "rajpatel@demo.albiz.com", password: "demo123", name: "Raj Patel", role: "NORMAL" },
];

// Data generation
const generateUsers = () => [
  { id: 1, name: "Jessin Sam S", handle: "jessinsam", title: "Founder @ Example.com", avatar: "/Jess-profile.jpg", verified: true, isPremium: true, hasStory: true },
  { id: 2, name: "Open AI", handle: "openai", title: "ChatGPT Creators", avatar: "https://picsum.photos/seed/openai/200", verified: true, hasStory: true },
  { id: 3, name: "Nikhil Kamath", handle: "nikhilkamath", title: "Investor & Entrepreneur", avatar: "https://picsum.photos/seed/nikhil/200", verified: true, hasStory: true },
  { id: 4, name: "Elon Musk", handle: "elonmusk", title: "CEO @ Tesla, SpaceX", avatar: "https://picsum.photos/seed/elon/200", verified: true, hasStory: true },
  { id: 5, name: "Donald J. Trump", handle: "realdonaldtrump", title: "US President 2026", avatar: "https://picsum.photos/seed/trump/200", verified: true },
  { id: 6, name: "Y Combinator", handle: "ycombinator", title: "Help founders make something...", avatar: "https://picsum.photos/seed/yc/200", verified: true, hasStory: true },
  { id: 7, name: "Satya Nadella", handle: "satyanadella", title: "Chairman and CEO at Microsoft", avatar: "https://picsum.photos/seed/satya/200", verified: true },
  { id: 8, name: "Aadit Palicha", handle: "aaditpalicha", title: "Co-founder/CEO @ZeptoNow", avatar: "https://picsum.photos/seed/aadit/200", verified: true, hasStory: true },
];

const generatePosts = () => [
  {
    id: 1,
    userId: 2,
    type: "post" as const,
    content: "Happy to share that Example.com has secured $10M from the top investors. Thank you all for being a part of it.",
    date: "Dec 12th 2025",
    time: "1:56 PM",
    image: "https://picsum.photos/seed/funding-announce/800/500",
    tags: ["Business", "Startups"],
    stats: { views: "1k", likes: "1k", comments: "1k", shares: "1k" },
  },
  {
    id: 2,
    userId: 1,
    type: "article" as const,
    title: "Donald Trump reminds the entire world he has no idea what 6G means",
    description: 'When business leaders spout buzzwords like "AI," "8K" and "5G," sometimes in the same sentence, we often get a sneaking suspicion they don\'t know what they mean!',
    tags: ["News", "Policy", "Tech"],
    date: "Dec 12th 2025",
    image: "https://picsum.photos/seed/trump-article/400/300",
    stats: { views: "2.3k", likes: "1.2k", comments: "342", shares: "89" },
  },
  {
    id: 3,
    userId: 2,
    type: "article" as const,
    title: "OpenAI announces GPT-5: The most capable AI model yet",
    description: "The new model shows unprecedented reasoning capabilities and can now handle complex multi-step tasks with human-like accuracy.",
    tags: ["AI", "Technology", "News"],
    date: "Dec 12th 2025",
    image: "https://picsum.photos/seed/gpt5-announce/400/300",
    stats: { views: "45k", likes: "32k", comments: "5.2k", shares: "12k" },
  },
  {
    id: 4,
    userId: 3,
    type: "post" as const,
    content: "The best time to start investing was yesterday. The second best time is today. Start small, stay consistent.",
    date: "Dec 11th 2025",
    time: "10:30 AM",
    tags: ["Finance", "Investing"],
    stats: { views: "5.2k", likes: "2.1k", comments: "456", shares: "234" },
  },
  {
    id: 5,
    userId: 4,
    type: "article" as const,
    title: "SpaceX Starship completes first successful orbital flight",
    description: "After years of development and testing, SpaceX has achieved a major milestone in space exploration.",
    tags: ["Technology", "Space", "News"],
    date: "Dec 10th 2025",
    image: "https://picsum.photos/seed/spacex/400/300",
    stats: { views: "12k", likes: "8.5k", comments: "1.2k", shares: "3.4k" },
  },
  {
    id: 6,
    userId: 6,
    type: "post" as const,
    content: "Applications for YC Winter 2026 batch are now open. Apply now at ycombinator.com/apply",
    date: "Dec 9th 2025",
    time: "2:00 PM",
    tags: ["Startups", "Business"],
    stats: { views: "8.3k", likes: "3.2k", comments: "892", shares: "1.5k" },
  },
  {
    id: 7,
    userId: 7,
    type: "article" as const,
    title: "Microsoft unveils next-gen AI chips to compete with Nvidia",
    description: "The tech giant is betting big on custom silicon to power its Azure AI infrastructure and reduce dependency on third-party hardware.",
    tags: ["Technology", "AI", "Business"],
    date: "Dec 8th 2025",
    image: "https://picsum.photos/seed/ms-chips/400/300",
    stats: { views: "15k", likes: "6.7k", comments: "1.1k", shares: "2.3k" },
  },
  {
    id: 8,
    userId: 8,
    type: "article" as const,
    title: "Zepto becomes India's fastest unicorn with $5B valuation",
    description: "The quick commerce startup has disrupted the grocery delivery market with 10-minute deliveries across major Indian cities.",
    tags: ["News", "Business", "Startups"],
    date: "Dec 7th 2025",
    image: "https://picsum.photos/seed/zepto-unicorn/400/300",
    stats: { views: "22k", likes: "11k", comments: "2.3k", shares: "4.1k" },
  },
  {
    id: 9,
    userId: 4,
    type: "article" as const,
    title: "Tesla's Optimus robot begins factory trials",
    description: "The humanoid robot is now performing basic assembly tasks at Tesla's Fremont factory, marking a new era in manufacturing automation.",
    tags: ["Technology", "AI", "News"],
    date: "Dec 6th 2025",
    image: "https://picsum.photos/seed/optimus-robot/400/300",
    stats: { views: "35k", likes: "18k", comments: "3.2k", shares: "8.5k" },
  },
  {
    id: 10,
    userId: 2,
    type: "article" as const,
    title: "Claude 4 sets new benchmarks in AI safety research",
    description: "Anthropic's latest model demonstrates unprecedented ability to refuse harmful requests while maintaining helpfulness.",
    tags: ["AI", "Technology", "News"],
    date: "Dec 5th 2025",
    image: "https://picsum.photos/seed/claude4-safety/400/300",
    stats: { views: "28k", likes: "15k", comments: "2.8k", shares: "6.2k" },
  },
  {
    id: 11,
    userId: 5,
    type: "article" as const,
    title: "US announces new semiconductor export restrictions",
    description: "The Biden administration expands chip export controls to additional countries, impacting global tech supply chains.",
    tags: ["News", "Policy", "Technology"],
    date: "Dec 4th 2025",
    image: "https://picsum.photos/seed/chip-policy/400/300",
    stats: { views: "18k", likes: "4.2k", comments: "2.1k", shares: "3.8k" },
  },
  {
    id: 12,
    userId: 3,
    type: "article" as const,
    title: "Indian stock market hits all-time high amid foreign investment surge",
    description: "Sensex crosses 85,000 for the first time as global investors pour billions into Indian equities.",
    tags: ["News", "Finance", "Business"],
    date: "Dec 3rd 2025",
    image: "https://picsum.photos/seed/sensex-high/400/300",
    stats: { views: "42k", likes: "21k", comments: "4.5k", shares: "9.2k" },
  },
];

const filterTabs = ["For You", "Following", "Trending", "News", "AI", "Technology"];

const exploreTabs = ["For You", "Trending", "Circle", "News", "Founders", "Companies"];
const exploreSubTabs = ["Top", "Latest", "People", "Companies"];

const trendingTopics = [
  { id: 1, name: "AI & SaaS", posts: "2.1k posts this week", image: "https://picsum.photos/seed/ai-saas/200/200" },
  { id: 2, name: "UAE Startup", posts: "1.8k posts", image: "https://picsum.photos/seed/uae-startup/200/200" },
  { id: 3, name: "Fintech", posts: "1k posts", image: "https://picsum.photos/seed/fintech-topic/200/200" },
  { id: 4, name: "Web3", posts: "890 posts", image: "https://picsum.photos/seed/web3-topic/200/200" },
  { id: 5, name: "Climate Tech", posts: "670 posts", image: "https://picsum.photos/seed/climate-tech/200/200" },
];

const circleTabs = ["For You", "Following", "My Circle", "Explore", "Suggested", "Founders", "Companies"];

const generateCircleMembers = () => {
  const names = [
    { name: "Nikhil Kamath", title: "Investor & Entrepreneur", avatar: "https://picsum.photos/seed/nikhil/200", hasInitial: false },
    { name: "Y Combinator", title: "Help founders make something...", avatar: "", hasInitial: true, initial: "Y", initialBg: "#F97316" },
    { name: "Satya Nadella", title: "Chairman and CEO at Microsoft", avatar: "https://picsum.photos/seed/satya/200", hasInitial: false },
    { name: "Sam Altman", title: "CEO @ OpenAI", avatar: "https://picsum.photos/seed/sam-a/200", hasInitial: false },
    { name: "Jensen Huang", title: "CEO @ NVIDIA", avatar: "https://picsum.photos/seed/jensen/200", hasInitial: false },
    { name: "Sundar Pichai", title: "CEO @ Alphabet", avatar: "https://picsum.photos/seed/sundar/200", hasInitial: false },
    { name: "Sequoia Capital", title: "Venture Capital Firm", avatar: "", hasInitial: true, initial: "S", initialBg: "#10B981" },
    { name: "Marc Andreessen", title: "Co-founder @ a16z", avatar: "https://picsum.photos/seed/marc-a/200", hasInitial: false },
    { name: "Andreessen Horowitz", title: "Venture Capital Firm", avatar: "", hasInitial: true, initial: "A", initialBg: "#3B82F6" },
    { name: "Vitalik Buterin", title: "Co-founder @ Ethereum", avatar: "https://picsum.photos/seed/vitalik/200", hasInitial: false },
    { name: "Brian Chesky", title: "CEO @ Airbnb", avatar: "https://picsum.photos/seed/brian-c/200", hasInitial: false },
    { name: "Stripe", title: "Financial infrastructure for the internet", avatar: "", hasInitial: true, initial: "S", initialBg: "#6366F1" },
    { name: "Patrick Collison", title: "CEO @ Stripe", avatar: "https://picsum.photos/seed/patrick-c/200", hasInitial: false },
    { name: "Dario Amodei", title: "CEO @ Anthropic", avatar: "https://picsum.photos/seed/dario/200", hasInitial: false },
    { name: "Benchmark", title: "Venture Capital", avatar: "", hasInitial: true, initial: "B", initialBg: "#EF4444" },
    { name: "Tobi Lutke", title: "CEO @ Shopify", avatar: "https://picsum.photos/seed/tobi/200", hasInitial: false },
    { name: "Accel Partners", title: "Early-stage venture fund", avatar: "", hasInitial: true, initial: "A", initialBg: "#8B5CF6" },
    { name: "Drew Houston", title: "CEO @ Dropbox", avatar: "https://picsum.photos/seed/drew-h/200", hasInitial: false },
    { name: "Whitney Wolfe Herd", title: "Founder @ Bumble", avatar: "https://picsum.photos/seed/whitney/200", hasInitial: false },
    { name: "Lightspeed VP", title: "Global venture capital firm", avatar: "", hasInitial: true, initial: "L", initialBg: "#F59E0B" },
  ];

  return names.map((person, i) => ({
    id: 100 + i,
    ...person,
    verified: true,
    rank: i + 1,
  }));
};

const circleMembers = generateCircleMembers();

// Posts from circle members for the "For You" mixed feed
const circlePosts = [
  { memberId: 100, content: "Just closed a $200M fund focused on deep tech and climate. The next decade belongs to founders solving hard problems.", image: "https://picsum.photos/seed/nikhil-post/800/400", stats: { likes: "4.2k", comments: "312" } },
  { memberId: 102, content: "AI is going to redefine every industry. At Microsoft, we're building the infrastructure to make that happen responsibly.", stats: { likes: "18k", comments: "2.1k" } },
  { memberId: 103, content: "The next generation of AI won't just answer questions — it will reason, plan, and act. GPT-5 is a step in that direction.", image: "https://picsum.photos/seed/sam-post/800/400", stats: { likes: "32k", comments: "5.8k" } },
  { memberId: 105, content: "Search is being completely reimagined. What we're building at Google is going to change how people interact with information forever.", stats: { likes: "12k", comments: "1.4k" } },
  { memberId: 107, content: "Software is eating the world, but AI is eating software. Every company needs to figure out their AI strategy now, not next year.", image: "https://picsum.photos/seed/marc-post/800/400", stats: { likes: "8.5k", comments: "923" } },
  { memberId: 110, content: "The future of hospitality is personal. We're investing heavily in AI-powered experiences that make every trip unique.", stats: { likes: "6.1k", comments: "445" } },
  { memberId: 113, content: "Constitutional AI is not just a technique — it's a philosophy. Building safe AI systems requires rethinking how we train models from the ground up.", image: "https://picsum.photos/seed/dario-post/800/400", stats: { likes: "15k", comments: "1.8k" } },
  { memberId: 115, content: "Commerce is going through its biggest transformation since the internet. Shopify merchants processed $1B in a single day last quarter.", stats: { likes: "9.3k", comments: "678" } },
];

const notifications = [
  { id: 1, type: "follow" as const, userId: 3, time: "2min ago", group: "TODAY", unread: true },
  { id: 2, type: "follow" as const, userId: 7, time: "7min ago", group: "TODAY", unread: true },
  { id: 3, type: "like" as const, userId: 5, time: "2hr ago", group: "TODAY", unread: true, postPreview: "Happy to share that Example.com...", postImage: "https://picsum.photos/seed/funding-announce/200/200" },
  { id: 4, type: "comment" as const, userId: 4, time: "3hr ago", group: "TODAY", unread: false, postPreview: "The best time to start investing was yesterday..." },
  { id: 5, type: "mention" as const, userId: 2, time: "5hr ago", group: "TODAY", unread: false, postPreview: "Check out what @jessinsam is building..." },
  { id: 6, type: "like_story" as const, userId: 6, time: "1d ago", group: "YESTERDAY", unread: false },
  { id: 7, type: "follow" as const, userId: 8, time: "1d ago", group: "YESTERDAY", unread: false },
  { id: 8, type: "like" as const, userId: 3, time: "1d ago", group: "YESTERDAY", unread: false, postPreview: "Building in public has been one of the best decisions..." },
  { id: 9, type: "comment" as const, userId: 7, time: "2d ago", group: "EARLIER", unread: false, postPreview: "AI is going to redefine every industry..." },
  { id: 10, type: "follow" as const, userId: 4, time: "2d ago", group: "EARLIER", unread: false },
  { id: 11, type: "like" as const, userId: 6, time: "3d ago", group: "EARLIER", unread: false, postPreview: "Applications for YC Winter 2026 batch are now open..." },
  { id: 12, type: "mention" as const, userId: 8, time: "3d ago", group: "EARLIER", unread: false, postPreview: "Zepto becomes India's fastest unicorn..." },
  { id: 13, type: "follow" as const, userId: 2, time: "4d ago", group: "EARLIER", unread: false },
  { id: 14, type: "like_story" as const, userId: 3, time: "5d ago", group: "EARLIER", unread: false },
  { id: 15, type: "like" as const, userId: 4, time: "5d ago", group: "EARLIER", unread: false, postPreview: "SpaceX Starship completes first successful orbital flight..." },
];

const conversations = [
  {
    id: 1,
    userId: 3, // Nikhil Kamath
    lastMessage: "Let's discuss the term sheet......",
    time: "3:14 PM",
    unreadCount: 2,
    online: true,
    messages: [
      { id: 1, fromMe: false, text: "Hey Jessin, great seeing you at the summit yesterday.", time: "2:45 PM" },
      { id: 2, fromMe: true, text: "Thanks Nikhil! It was a pleasure to meet you.", time: "2:48 PM" },
      { id: 3, fromMe: false, text: "I've been looking at Example.com and I think there's a huge opportunity here.", time: "3:01 PM" },
      { id: 4, fromMe: true, text: "That means a lot coming from you. We're growing 40% month over month.", time: "3:05 PM" },
      { id: 5, fromMe: false, text: "Impressive. I'd love to chat about a potential investment.", time: "3:10 PM" },
      { id: 6, fromMe: false, text: "Let's discuss the term sheet......", time: "3:14 PM" },
    ],
  },
  {
    id: 2,
    userId: 7, // Satya Nadella
    lastMessage: "Hai Jessin!",
    time: "Yesterday",
    unreadCount: 0,
    online: false,
    messages: [
      { id: 1, fromMe: false, text: "Hi Jessin, congratulations on the funding round!", time: "10:30 AM" },
      { id: 2, fromMe: true, text: "Thank you Satya! Really appreciate the kind words.", time: "11:15 AM" },
      { id: 3, fromMe: false, text: "Have you considered integrating with Azure for your infrastructure?", time: "11:45 AM" },
      { id: 4, fromMe: true, text: "We're actually evaluating cloud partners right now. Would love to learn more.", time: "12:30 PM" },
      { id: 5, fromMe: false, text: "Hai Jessin!", time: "3:00 PM" },
    ],
  },
  {
    id: 3,
    userId: 4, // Elon Musk
    lastMessage: "Mars colony needs a social network too 😄",
    time: "2d ago",
    unreadCount: 0,
    online: true,
    messages: [
      { id: 1, fromMe: false, text: "Your platform is interesting. Different from what's out there.", time: "9:00 AM" },
      { id: 2, fromMe: true, text: "Thanks Elon! We're focused on meaningful business connections.", time: "9:30 AM" },
      { id: 3, fromMe: false, text: "Mars colony needs a social network too 😄", time: "10:00 AM" },
    ],
  },
  {
    id: 4,
    userId: 2, // Open AI
    lastMessage: "We'd love to feature Example.com as a case study.",
    time: "3d ago",
    unreadCount: 0,
    online: true,
    messages: [
      { id: 1, fromMe: false, text: "Hi Jessin! We noticed Example.com is using our API extensively.", time: "2:00 PM" },
      { id: 2, fromMe: true, text: "Yes, GPT powers our content recommendations. It's been great.", time: "2:30 PM" },
      { id: 3, fromMe: false, text: "We'd love to feature Example.com as a case study.", time: "3:00 PM" },
    ],
  },
  {
    id: 5,
    userId: 8, // Aadit Palicha
    lastMessage: "Quick commerce and social media — there's a play here.",
    time: "5d ago",
    unreadCount: 0,
    online: false,
    messages: [
      { id: 1, fromMe: true, text: "Hey Aadit, congrats on the unicorn milestone!", time: "11:00 AM" },
      { id: 2, fromMe: false, text: "Thanks Jessin! It's been a wild ride.", time: "11:30 AM" },
      { id: 3, fromMe: false, text: "Quick commerce and social media — there's a play here.", time: "11:45 AM" },
    ],
  },
  {
    id: 6,
    userId: 6, // Y Combinator
    lastMessage: "Your application for the next batch is strong.",
    time: "1w ago",
    unreadCount: 0,
    online: false,
    messages: [
      { id: 1, fromMe: false, text: "Hi Jessin, thanks for applying to YC.", time: "4:00 PM" },
      { id: 2, fromMe: true, text: "Thank you for considering us!", time: "4:15 PM" },
      { id: 3, fromMe: false, text: "Your application for the next batch is strong.", time: "4:30 PM" },
    ],
  },
];

const messageTabs = ["All", "Unread", "Instagram", "Facebook", "LinkedIn"];

const savedTabs = ["All", "News", "Profiles", "Circle posts", "Media", "Others"];

const savedCollections = [
  { id: 1, name: "Technology", count: 10, image: "https://picsum.photos/seed/coll-tech/100" },
  { id: 2, name: "AI", count: 5, image: "https://picsum.photos/seed/coll-ai/100" },
  { id: 3, name: "Finance", count: 12, image: "https://picsum.photos/seed/coll-finance/100" },
  { id: 4, name: "Startups", count: 8, image: "https://picsum.photos/seed/coll-startups/100" },
  { id: 5, name: "News", count: 15, image: "https://picsum.photos/seed/coll-news/100" },
];

const quickFolders = [
  { name: "Technology", count: 10 },
  { name: "Finance", count: 12 },
  { name: "AI", count: 5 },
  { name: "Fintech", count: 18 },
  { name: "Important news", count: 2 },
];

// Recently saved items reference existing posts by ID
const recentlySavedPostIds = [2, 1, 3, 5, 7, 8];

const analyticsTabs = ["Overview", "Posts", "Profile"];

const analyticsStats = [
  { label: "Total view", value: "45,210", change: 12.4, up: true, sparkline: [20, 35, 28, 45, 38, 55, 48, 62, 58, 72, 65, 78] },
  { label: "Profile visits", value: "1,284", change: 3.2, up: false, sparkline: [50, 48, 45, 47, 42, 40, 38, 41, 36, 35, 37, 34] },
  { label: "Circle actions", value: "432", change: 24.1, up: true, sparkline: [15, 22, 18, 30, 25, 38, 32, 45, 42, 55, 50, 62] },
];

const viewsOverTime = [
  { date: "01 OCT", value: 120 },
  { date: "04 OCT", value: 280 },
  { date: "08 OCT", value: 180 },
  { date: "11 OCT", value: 350 },
  { date: "15 OCT", value: 220 },
  { date: "18 OCT", value: 420 },
  { date: "22 OCT", value: 310 },
  { date: "25 OCT", value: 520 },
  { date: "28 OCT", value: 480 },
  { date: "30 OCT", value: 680 },
];

const topPosts = [
  { id: 1, title: "Building the...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post1/100" },
  { id: 2, title: "10 Tips for...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post2/100" },
  { id: 3, title: "Why Founders...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post3/100" },
  { id: 4, title: "Why Founders...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post4/100" },
];

const quickSnapshot = [
  { label: "Views today", value: "1,402" },
  { label: "New followers", value: "+25" },
  { label: "Circle requests", value: "5" },
  { label: "Engagement rate", value: "24%" },
];

const settingsTabs = ["Account", "Profile & Circle", "Privacy & Safety", "Notifications", "Billing", "Security"];

const accountInfo = [
  { label: "Email", value: "jessin@tecnots.com" },
  { label: "Username", value: "jessinsam" },
  { label: "Phone", value: "+91 7902839978" },
];

const languageRegion = [
  { label: "Language", value: "English (US)" },
  { label: "Time Zone", value: "(GMT-08:00) Pacific Time" },
  { label: "Currency", value: "USD ($)" },
];

const navItems = [
  { icon: Activity, label: "Activities" },
  { icon: Search, label: "Explore" },
  { icon: Users, label: "Circle" },
  { icon: Bell, label: "Notifications" },
  { icon: Mail, label: "Messages" },
  { icon: Bookmark, label: "Saved" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Settings, label: "Settings" },
  { icon: User, label: "Profile" },
];

const users = generateUsers();
const posts = generatePosts();

// Generate article body content
const generateArticleContent = (postId: number) => {
  const contents: Record<number, string[]> = {
    2: [
      "In a recent press conference, former President Donald Trump made headlines once again by discussing telecommunications technology in ways that left many experts scratching their heads.",
      "\"We're going to have 6G, maybe even 7G,\" Trump declared confidently. \"Nobody knows what it means, but we're going to have it before anyone else. China thinks they're ahead, but they're not. We're going to be so far ahead, it's going to be incredible.\"",
      "The comments came during a discussion about American technological competitiveness, where Trump attempted to position himself as a champion of innovation. However, telecommunications experts were quick to point out that 6G standards don't yet exist, and the technology is still largely theoretical.",
      "\"6G is not something you can just declare into existence,\" explained Dr. Sarah Chen, a telecommunications researcher at MIT. \"It requires years of research, standardization, and infrastructure development. We're still in the early stages of 5G deployment globally.\"",
      "This isn't the first time business leaders and politicians have used technical buzzwords without fully understanding their meaning. The phenomenon has become so common that it has its own name among tech circles: \"buzzword bingo.\"",
    ],
    3: [
      "OpenAI has officially announced GPT-5, marking what the company calls \"the most significant leap in AI capability since the introduction of GPT-4.\"",
      "The new model demonstrates unprecedented reasoning capabilities, with the ability to solve complex multi-step problems that previously stumped AI systems. In internal testing, GPT-5 achieved near-human performance on graduate-level examinations across multiple disciplines.",
      "\"We've fundamentally reimagined how AI systems approach reasoning,\" said OpenAI CEO Sam Altman. \"GPT-5 doesn't just pattern match—it genuinely thinks through problems in ways that mirror human cognition.\"",
      "Key improvements include enhanced mathematical reasoning, better understanding of nuanced context, and significantly improved factual accuracy. The model also shows remarkable improvements in coding tasks, with early testers reporting that it can architect and implement complex software systems with minimal human guidance.",
      "The announcement has sent ripples through the tech industry, with competitors scrambling to respond. Google, Anthropic, and Meta are all reportedly accelerating their own AI development timelines.",
    ],
    5: [
      "In a historic moment for space exploration, SpaceX's Starship rocket has completed its first fully successful orbital flight, marking a major milestone in humanity's quest to become a multi-planetary species.",
      "The massive rocket, standing at nearly 400 feet tall, launched from SpaceX's Starbase facility in Boca Chica, Texas, at 7:23 AM local time. It successfully reached orbit, completed multiple revolutions around Earth, and executed a controlled reentry and landing.",
      "\"This is the day we've been working toward for over a decade,\" said Elon Musk, visibly emotional at the post-flight press conference. \"Starship is the vehicle that will take humanity to Mars, and today we proved it can work.\"",
      "The successful flight validates years of iterative testing, including multiple explosive failures that critics had pointed to as evidence of SpaceX's overly aggressive approach. But the company's \"fail fast, learn faster\" methodology has now proven its worth.",
      "NASA has already contracted Starship for lunar landing missions as part of the Artemis program. With today's success, those missions are now one step closer to reality.",
    ],
    7: [
      "Microsoft has unveiled its next-generation AI chips, codenamed 'Maia,' designed to compete directly with Nvidia's dominant GPU offerings in the artificial intelligence market.",
      "The custom silicon represents a major strategic shift for Microsoft, which has traditionally relied on third-party hardware for its Azure cloud infrastructure. The move comes as AI workloads have exploded in demand, creating supply constraints and driving up costs.",
      "\"We need to control our own destiny when it comes to AI infrastructure,\" explained Microsoft CEO Satya Nadella. \"Maia gives us that control while delivering better performance per dollar for our customers.\"",
      "Early benchmarks suggest the chips offer competitive performance to Nvidia's H100 GPUs while consuming significantly less power. Microsoft plans to begin deploying Maia in its data centers by mid-2026.",
      "The announcement puts additional pressure on Nvidia, which has enjoyed near-monopoly status in the AI chip market. Other tech giants, including Google and Amazon, have also developed custom AI chips.",
    ],
    8: [
      "Zepto, the quick commerce startup that promises 10-minute grocery deliveries, has achieved unicorn status faster than any company in Indian startup history, reaching a $5 billion valuation.",
      "Founded by Stanford dropouts Aadit Palicha and Kaivalya Vohra in 2021, Zepto has rapidly expanded to cover major metropolitan areas across India. The company operates a network of \"dark stores\"—small warehouses strategically located in residential neighborhoods.",
      "\"We're not just delivering groceries—we're redefining convenience,\" said co-founder Aadit Palicha. \"In urban India, time is the ultimate luxury, and we're giving people their time back.\"",
      "The latest funding round was led by StepStone Group, with participation from existing investors including Glade Brook Capital and Nexus Venture Partners. The funds will be used to expand into new cities and deepen coverage in existing markets.",
      "Critics have questioned the sustainability of the quick commerce model, citing thin margins and high operational costs. But Zepto claims it has achieved profitability in several mature markets.",
    ],
    9: [
      "Tesla has begun real-world factory trials of its Optimus humanoid robot, marking a significant step toward the company's vision of affordable robotic labor.",
      "The robots are currently performing basic assembly tasks at Tesla's Fremont, California factory, including picking up parts and placing them in designated locations. While the tasks are simple, they represent an important proof of concept.",
      "\"Optimus is not science fiction anymore,\" Elon Musk posted on X. \"It's working alongside humans on a real factory floor. This is just the beginning.\"",
      "Tesla claims Optimus could eventually handle any repetitive physical task that humans currently perform, from factory work to household chores. The company has set an ambitious target price of $20,000 per unit at scale.",
      "The implications for the labor market are profound. While proponents argue robots will free humans from dangerous and monotonous work, critics worry about widespread job displacement without adequate social safety nets.",
    ],
    10: [
      "Anthropic's Claude 4 has achieved unprecedented scores on AI safety benchmarks while maintaining—and in some cases exceeding—the helpfulness of previous models.",
      "The new model demonstrates a sophisticated ability to understand context and intent, refusing harmful requests even when they're disguised as legitimate queries. At the same time, it provides more comprehensive assistance for benign tasks than its predecessors.",
      "\"We've proven that safety and capability aren't trade-offs,\" said Anthropic CEO Dario Amodei. \"Claude 4 is both our safest and our most capable model to date.\"",
      "Key innovations include improved reasoning about potential harms, better recognition of manipulation attempts, and enhanced ability to ask clarifying questions when requests are ambiguous. The model also shows remarkable consistency in its safety behaviors across different contexts.",
      "The achievement is significant for the broader AI industry, which has often treated safety as an obstacle to progress. Anthropic's success suggests a path forward where AI systems can be both powerful and trustworthy.",
    ],
    11: [
      "The U.S. government has announced sweeping new restrictions on semiconductor exports, expanding controls to additional countries and tightening existing rules around advanced chip technology.",
      "The new regulations target AI chips and the equipment used to manufacture them, with the stated goal of preventing adversaries from acquiring technology that could enhance their military capabilities or enable human rights abuses.",
      "\"Advanced semiconductors are foundational to national security,\" said Commerce Secretary Gina Raimondo. \"We're taking necessary steps to prevent our cutting-edge technology from being used against our interests.\"",
      "The restrictions are expected to significantly impact global tech supply chains. Companies like Nvidia and AMD will face new compliance requirements, while international chip manufacturers must navigate an increasingly complex regulatory landscape.",
      "China has condemned the move as \"technological hegemony,\" vowing to accelerate its domestic chip development efforts. Industry analysts warn of potential retaliation that could further fragment the global technology market.",
    ],
    12: [
      "The Indian stock market has reached a historic milestone, with the BSE Sensex crossing 85,000 points for the first time as foreign investors pour billions into the country's equities.",
      "The rally has been driven by strong corporate earnings, a resilient domestic economy, and growing optimism about India's long-term growth prospects. Foreign institutional investors have been net buyers for twelve consecutive months.",
      "\"India is becoming the world's most attractive investment destination,\" said Nikhil Kamath, co-founder of Zerodha. \"The combination of demographics, digital infrastructure, and economic reforms creates a unique opportunity.\"",
      "Key sectors driving the gains include banking, technology, and consumer goods. The IT sector has particularly benefited from the global AI boom, with Indian software companies winning major contracts from international clients.",
      "Analysts caution that valuations are stretched by historical standards, but remain bullish on India's long-term trajectory. Many predict the Sensex could reach 100,000 within the next two years if current trends continue.",
    ],
  };
  return contents[postId] || [
    "This article contains important insights about current developments in the industry.",
    "Experts have weighed in on the implications of these changes for businesses and consumers alike.",
    "The coming months will be crucial in determining how these trends play out in the broader market.",
  ];
};

function AlbizLogo({ size = 40 }: { size?: number }) {
  const scale = size / 121;
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

function ContrastIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" fill="currentColor" />
    </svg>
  );
}

function MobileHeader({ isMenuOpen, onMenuClick }: { isMenuOpen: boolean; onMenuClick: () => void }) {
  const currentUser = users[0];
  
  return (
    <header className="md:hidden sticky top-0 z-50 bg-white border-b border-[#e5e5e5] px-4 py-3 relative flex items-center justify-between">
      <button onClick={onMenuClick} className="z-10">
        <div className={`w-9 h-9 rounded-full overflow-hidden ring-2 ${isMenuOpen ? 'ring-[#F44444]' : 'ring-transparent'} transition-all`}>
          <Image
            src={currentUser.avatar}
            alt={currentUser.name}
            width={36}
            height={36}
            className="object-cover w-full h-full"
          />
        </div>
      </button>
      <div className="absolute left-1/2 -translate-x-1/2">
        <AlbizLogo size={32} />
      </div>
      <div className="flex items-center gap-2 z-10">
        <button className="p-2 hover:bg-[#f5f5f5] rounded-lg">
          <Search className="w-5 h-5 text-[#525252]" />
        </button>
        <button className="p-2 hover:bg-[#f5f5f5] rounded-lg">
          <Bell className="w-5 h-5 text-[#525252]" />
        </button>
      </div>
    </header>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const currentUser = users[0];
  const { setIsOpen: setCreatePostOpen } = useContext(CreatePostContext);
  const { setIsOpen: setCreateStoryOpen } = useContext(CreateStoryContext);
  const { activeView, setActiveView } = useContext(NavContext);
  const { userRole } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE";
  const navigableLabels = ["Activities", "Explore", "Circle", "Notifications", "Messages", "Saved", "Analytics", "Settings"];
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`md:hidden fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      {/* Dropdown Menu */}
      <div 
        className={`md:hidden fixed left-4 top-[72px] z-50 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#e5e5e5] overflow-hidden transition-all duration-200 origin-top-left ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* User Profile Section */}
        <div className="p-4 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image
                src={currentUser.avatar}
                alt={currentUser.name}
                width={48}
                height={48}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{currentUser.name}</span>
                <VerifiedBadge />
              </div>
              <span className="text-[#737373] text-xs truncate block">{currentUser.title}</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 max-h-[280px] overflow-y-auto">
          {navItems.map((item) => {
            if (!isCircle && (item.label === "Messages" || item.label === "Profile" || item.label === "Analytics" || item.label === "Notifications")) return null;
            const isActive = item.label === activeView;
            const isNavigable = navigableLabels.includes(item.label);
            return item.label === "Profile" ? (
              <Link
                key={item.label}
                href="/profile"
                onClick={onClose}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[#f5f5f5] text-[#0a0a0a]"
                    : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            ) : (
              <button
                key={item.label}
                onClick={() => { if (isNavigable) setActiveView(item.label); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[#f5f5f5] text-[#0a0a0a]"
                    : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Buttons — only for Circle users */}
        {isCircle && (
          <div className="p-3 border-t border-[#e5e5e5] flex gap-2">
            <button 
              onClick={() => { onClose(); setCreateStoryOpen(true); }}
              className="flex-1 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium text-sm hover:bg-[#fafafa] transition-colors cursor-pointer"
            >
              Story
            </button>
            <button 
              onClick={() => { onClose(); setCreatePostOpen(true); }}
              className="flex-1 py-2 rounded-full bg-[#F44444] text-white font-medium text-sm hover:bg-[#d64d3c] transition-colors cursor-pointer"
            >
              Post
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function LeftSidebar() {
  const currentUser = users[0];
  const { setIsOpen } = useContext(CreatePostContext);
  const { setIsOpen: setStoryOpen } = useContext(CreateStoryContext);
  const { activeView, setActiveView } = useContext(NavContext);
  const { isSignedIn, userRole, openAuthModal } = useContext(AuthContext);
  const collapsed = activeView === "Messages";
  const isCircle = userRole === "CIRCLE";
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0 });

  useEffect(() => {
    if (!showCreateMenu) return;
    function handleClick(e: MouseEvent | TouchEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [showCreateMenu]);
  
  return (
    <aside className={`hidden md:flex h-screen sticky top-0 flex-col items-center px-2 py-4 border-r border-[#e5e5e5] overflow-y-auto bg-white transition-all duration-300 ease-out ${
      collapsed ? "w-20" : "md:w-20 lg:w-72 lg:items-stretch lg:px-4"
    }`}>
      {isSignedIn ? (
        <>
          <div className="flex flex-col items-center mb-4">
            <div className="relative mb-2">
              <div className={`w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white transition-all duration-300 ${
                collapsed ? "" : "lg:w-24 lg:h-24"
              }`}>
                <Image
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                />
              </div>
              {!collapsed && (
                <button className="hidden lg:flex absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#F44444] items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            {!collapsed && (
              <>
                <div className="hidden lg:flex items-center gap-1.5">
                  <span className="font-semibold">{currentUser.name}</span>
                  <VerifiedBadge />
                </div>
                <span className="hidden lg:block text-[#737373] text-sm">{currentUser.title}</span>
              </>
            )}
          </div>

          {!collapsed && (
            <div className="hidden lg:flex justify-center gap-4 mb-4">
              <button className="text-[#F44444] text-sm font-medium">Premium</button>
              <button className="text-sm text-[#737373]">My Stories</button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center mb-4">
          <div className="relative mb-2">
            <div className={`w-12 h-12 rounded-full bg-[#f0f0f0] ring-2 ring-[#e5e5e5] ring-offset-2 ring-offset-white transition-all duration-300 flex items-center justify-center ${
              collapsed ? "" : "lg:w-24 lg:h-24"
            }`}>
              <User className={`text-[#a3a3a3] ${collapsed ? "w-5 h-5" : "w-5 h-5 lg:w-10 lg:h-10"}`} />
            </div>
          </div>
          {!collapsed && (
            <>
              <div className="hidden lg:flex flex-col items-center gap-2 mt-1">
                <span className="text-sm text-[#737373]">Not signed in</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openAuthModal("signin")}
                    className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => openAuthModal("signup")}
                    className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#0a0a0a] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer"
                  >
                    Sign up
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <nav className="flex flex-col items-center space-y-1">
        {navItems.map((item) => {
          // Hide Messages and Profile for non-circle users
          if (!isCircle && (item.label === "Messages" || item.label === "Profile" || item.label === "Analytics" || item.label === "Notifications")) return null;
          const isActive = item.label === activeView;
          const navigable = item.label === "Activities" || item.label === "Explore" || item.label === "Circle" || item.label === "Notifications" || item.label === "Messages" || item.label === "Saved" || item.label === "Analytics" || item.label === "Settings";
          return item.label === "Profile" ? (
            <Link
              key={item.label}
              href="/profile"
              className={`w-10 flex items-center justify-center gap-3 p-2 rounded-full transition-all duration-200 ${
                collapsed ? "" : "lg:w-40 lg:justify-start lg:px-4 lg:py-2"
              } ${
                isActive
                  ? "bg-[#f0f0f0] text-[#0a0a0a]"
                  : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="hidden lg:block font-medium">{item.label}</span>}
            </Link>
          ) : (
            <button
              key={item.label}
              onClick={navigable ? () => setActiveView(item.label) : undefined}
              className={`w-10 flex items-center justify-center gap-3 p-2 rounded-full transition-all duration-200 cursor-pointer ${
                collapsed ? "" : "lg:w-40 lg:justify-start lg:px-4 lg:py-2"
              } ${
                isActive
                  ? "bg-[#f0f0f0] text-[#0a0a0a]"
                  : "text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a]"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="hidden lg:block font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {isCircle && <div className="flex flex-col items-center space-y-2 mt-4">
        {!collapsed && (
          <button 
            onClick={() => setStoryOpen(true)}
            className="hidden lg:block w-40 py-2 rounded-full border border-[#e5e5e5] text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors cursor-pointer"
          >
            Story
          </button>
        )}
        {collapsed ? (
          <div ref={createMenuRef}>
            {typeof document !== "undefined" && createPortal(
              <AnimatePresence>
                {showCreateMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ type: "spring", duration: 0.15, bounce: 0.15 }}
                    className="fixed z-[9999] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[140px]"
                    style={{ bottom: menuPos.bottom, left: menuPos.left }}
                  >
                    <button
                      onClick={() => { setShowCreateMenu(false); setIsOpen(true); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                    >
                      <PenLine className="w-[18px] h-[18px] text-[#737373]" />
                      <span className="text-sm font-medium">Post</span>
                    </button>
                    {isCircle && (
                      <>
                        <div className="h-px bg-[#f0f0f0]" />
                        <button
                          onClick={() => { setShowCreateMenu(false); setStoryOpen(true); }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                        >
                          <CircleDashed className="w-[18px] h-[18px] text-[#737373]" />
                          <span className="text-sm font-medium">Story</span>
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
            <button 
              ref={createBtnRef}
              onClick={() => {
                if (createBtnRef.current) {
                  const rect = createBtnRef.current.getBoundingClientRect();
                  setMenuPos({
                    bottom: window.innerHeight - rect.top + 12,
                    left: rect.left,
                  });
                }
                setShowCreateMenu(prev => !prev);
              }}
              className="w-10 h-10 rounded-full bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-all duration-300 flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsOpen(true)}
            className="w-10 h-10 lg:w-40 lg:h-auto lg:py-2 rounded-full bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-all duration-300 flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-5 h-5 lg:hidden" />
            <span className="hidden lg:block">Post</span>
          </button>
        )}
      </div>}

      <div className="flex-1" />

      <div className="flex justify-center flex-shrink-0">
        <AlbizLogo size={40} />
      </div>
    </aside>
  );
}

const contentTopics = [
  { id: "tech", label: "Technology", selected: true },
  { id: "business", label: "Business", selected: true },
  { id: "ai", label: "AI & ML", selected: true },
  { id: "startups", label: "Startups", selected: false },
  { id: "finance", label: "Finance", selected: true },
  { id: "crypto", label: "Crypto", selected: false },
  { id: "science", label: "Science", selected: false },
  { id: "politics", label: "Politics", selected: true },
];

function FeedHeader({ activeTab, setActiveTab }: { activeTab: number; setActiveTab: (tab: number) => void }) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreferences, setShowPreferences] = useState(false);
  const [topics, setTopics] = useState(contentTopics);
  
  const toggleTopic = (id: string) => {
    setTopics(topics.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };
  
  return (
    <div className="sticky top-[57px] md:top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
      <div className="flex items-center justify-between mb-4">
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
              />
            </div>
            <button 
              onClick={() => { setShowSearch(false); setSearchQuery(""); }}
              className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Activities</h1>
            <div className="hidden sm:flex items-center gap-2">
              <button 
                onClick={() => setShowSearch(true)}
                className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors" 
                title="Search"
              >
                <Search className="w-5 h-5 text-[#737373]" />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowPreferences(!showPreferences)}
                  className={`p-2 rounded-lg transition-colors ${showPreferences ? 'bg-[#f5f5f5]' : 'hover:bg-[#f5f5f5]'}`}
                  title="Content Preferences"
                >
                  <SlidersHorizontal className="w-5 h-5 text-[#737373]" />
                </button>
                {showPreferences && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#e5e5e5] py-2 z-30">
                    <div className="px-3 py-2 text-xs text-[#737373] font-medium border-b border-[#e5e5e5] mb-1">Content Preferences</div>
                    {topics.map((topic) => (
                      <button 
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#f5f5f5] flex items-center justify-between"
                      >
                        <span className={topic.selected ? "text-[#0a0a0a]" : "text-[#737373]"}>{topic.label}</span>
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${
                          topic.selected ? "bg-[#F44444]" : "border border-[#e5e5e5]"
                        }`}>
                          {topic.selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    ))}
                    <div className="px-3 pt-2 mt-1 border-t border-[#e5e5e5]">
                      <button className="w-full py-1.5 text-xs text-[#F44444] font-medium hover:underline">
                        Manage all preferences
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
        {filterTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              i === activeTab
                ? "bg-[#F44444] text-white"
                : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

function ArticleDetailView({ postId }: { postId: number }) {
  const { setSelectedArticle } = useContext(ArticleContext);
  const { following, toggleFollow } = useContext(FollowingContext);
  const post = posts.find(p => p.id === postId)!;
  const user = users.find(u => u.id === post.userId)!;
  const isFollowing = following.has(user.id);
  const isCurrentUser = user.id === 1;
  const content = generateArticleContent(postId);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleShare = async () => {
    console.log("Share button clicked");
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      console.log("URL:", url);
      const title = post.title || "Check out this article";
      const text = `${title} - ${url}`;

      if (navigator.share) {
        console.log("Using native share");
        await navigator.share({ title, text, url });
      } else {
        console.log("Using clipboard fallback");
        navigator.clipboard.writeText(url).then(() => {
          alert("Link copied to clipboard!");
        }).catch(() => {
          prompt("Copy this link:", url);
        });
      }
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const handleCopyLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      alert("Link copied to clipboard!");
    }).catch(() => {
      prompt("Copy this link:", url);
    });
  };

  // Get related articles (same tags, different post)
  const relatedArticles = posts
    .filter(p => p.type === "article" && p.id !== postId && p.tags?.some(t => post.tags?.includes(t)))
    .slice(0, 3);

  return (
    <main className="flex-1 min-w-0 bg-white animate-fade-in relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#f0f0f0]">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <button 
            onClick={() => setSelectedArticle(null)}
            className="p-2 -ml-2 hover:bg-[#f5f5f5] rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsLiked(!isLiked)}
              className={`p-2 rounded-lg transition-colors ${isLiked ? 'text-[#F44444]' : 'text-[#737373] hover:bg-[#f5f5f5]'}`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </button>
            <button 
              onClick={() => setIsSaved(!isSaved)}
              className={`p-2 rounded-lg transition-colors ${isSaved ? 'text-[#F44444]' : 'text-[#737373] hover:bg-[#f5f5f5]'}`}
            >
              <BookmarkPlus className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
            <button onClick={handleCopyLink} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]">
              <Link2 className="w-4 h-4" />
            </button>
            <button onClick={handleShare} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373] relative z-10">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="px-4 sm:px-6 py-8 max-w-2xl">
        {/* Tags and Date */}
        <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
          {post.tags?.map((tag, i) => (
            <span key={tag}>
              <span className="text-[#F44444] font-medium">{tag}</span>
              {i < post.tags!.length - 1 && <span className="text-[#d5d5d5] ml-2">•</span>}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0a0a0a] leading-tight mb-6">
          {post.title}
        </h1>

        {/* Author Section */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image
                src={user.avatar}
                alt={user.name}
                width={48}
                height={48}
                className="object-cover w-full h-full"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#0a0a0a]">{user.name}</span>
                <VerifiedBadge />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#737373]">
                <span>{user.title}</span>
              </div>
            </div>
          </div>
          {!isCurrentUser && (
            <button 
              onClick={() => toggleFollow(user.id)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-out ${
                isFollowing 
                  ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]" 
                  : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
              } active:scale-95`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-sm text-[#737373] mb-6">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{post.date}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            <span>{post.stats.views} views</span>
          </div>
        </div>

        {/* Featured Image */}
        {post.image && (
          <div className="rounded-2xl overflow-hidden mb-8">
            <Image
              src={post.image}
              alt={post.title || "Article image"}
              width={800}
              height={450}
              className="object-cover w-full"
            />
          </div>
        )}

        {/* Article Body */}
        <div className="prose prose-lg max-w-none mb-10">
          {content.map((paragraph, i) => (
            <p key={i} className="text-[#262626] leading-relaxed mb-5 text-base sm:text-lg">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Engagement Stats */}
        <div className="flex items-center justify-between py-4 border-t border-b border-[#e5e5e5] mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsLiked(!isLiked)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
                isLiked ? 'bg-[#F44444]/10 text-[#F44444]' : 'hover:bg-[#f5f5f5] text-[#737373]'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{post.stats.likes}</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{post.stats.comments}</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-[#f5f5f5] text-[#737373] transition-colors">
              <Share2 className="w-5 h-5" />
              <span className="text-sm font-medium">{post.stats.shares}</span>
            </button>
          </div>
          <button 
            onClick={() => setIsSaved(!isSaved)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
              isSaved ? 'bg-[#F44444]/10 text-[#F44444]' : 'hover:bg-[#f5f5f5] text-[#737373]'
            }`}
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium hidden sm:inline">Save</span>
          </button>
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-[#0a0a0a] mb-4">Related Stories</h2>
            <div className="space-y-4">
              {relatedArticles.map(article => {
                const articleUser = users.find(u => u.id === article.userId)!;
                return (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article.id)}
                    className="w-full flex gap-4 p-3 rounded-xl hover:bg-[#f5f5f5] transition-colors text-left"
                  >
                    <div className="w-24 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={article.image!}
                        alt={article.title!}
                        width={96}
                        height={80}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[#F44444] mb-1">
                        {article.tags?.slice(0, 2).join(" • ")}
                      </div>
                      <h3 className="font-medium text-sm text-[#0a0a0a] line-clamp-2 mb-1">{article.title}</h3>
                      <span className="text-xs text-[#737373]">{articleUser.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Author Card */}
        <div className="bg-[#fafafa] rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-[#fafafa] flex-shrink-0">
              <Image
                src={user.avatar}
                alt={user.name}
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-semibold text-lg text-[#0a0a0a]">{user.name}</span>
                <VerifiedBadge />
              </div>
              <p className="text-sm text-[#737373] mb-3">{user.title}</p>
              {!isCurrentUser && (
                <button 
                  onClick={() => toggleFollow(user.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-out ${
                    isFollowing 
                      ? "bg-white text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#f5f5f5]" 
                      : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                  } active:scale-95`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}

function CreatePostModal() {
  const { isOpen, setIsOpen } = useContext(CreatePostContext);
  const currentUser = users[0];
  const [postContent, setPostContent] = useState("Exploring the new brand guidelines for Albiz Media today. Really loving the direction we're taking with the new interface!");
  const [visibility, setVisibility] = useState<"public" | "circle">("public");
  const [uploadedImages, setUploadedImages] = useState([
    "https://picsum.photos/seed/space-post/400/300",
    "https://picsum.photos/seed/team-post/400/300",
  ]);
  
  const maxChars = 1000;
  const maxFiles = 10;
  
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />
      <div className="relative bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-5 border-b border-[#f0f0f0]">
          <h2 className="text-lg md:text-xl font-semibold text-[#0a0a0a]">Create Post</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#737373]" />
          </button>
        </div>
        
        {/* User Info */}
        <div className="flex items-center justify-between px-3 md:px-5 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image
                src={currentUser.avatar}
                alt={currentUser.name}
                width={48}
                height={48}
                className="object-cover w-full h-full"
              />
            </div>
            <span className="font-semibold text-sm md:text-base text-[#0a0a0a]">{currentUser.name}</span>
          </div>
          <button className="text-[#F44444] font-medium text-xs md:text-sm hover:underline">
            Drafts
          </button>
        </div>
        
        {/* Formatting Toolbar */}
        <div className="px-3 md:px-5 pb-2">
          <div className="flex items-center gap-0.5 md:gap-1">
            {[
              { icon: Bold, label: "Bold" },
              { icon: Italic, label: "Italic" },
              { icon: LinkIcon, label: "Link" },
              { icon: List, label: "Bullet List" },
              { icon: ListOrdered, label: "Numbered List" },
            ].map((tool) => (
              <button
                key={tool.label}
                className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]"
                title={tool.label}
              >
                <tool.icon className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            ))}
          </div>
        </div>
        
        {/* Text Input */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="bg-[#f5f5f5] rounded-xl p-3 md:p-4 min-h-[100px] md:min-h-[120px]">
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value.slice(0, maxChars))}
              placeholder="What's on your mind?"
              className="w-full bg-transparent text-[#262626] text-sm md:text-base resize-none outline-none min-h-[80px] md:min-h-[100px]"
            />
          </div>
        </div>
        
        {/* Image Upload Section */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="flex gap-2 md:gap-3 flex-wrap">
            {uploadedImages.map((img, index) => (
              <div key={index} className="relative w-24 h-20 md:w-32 md:h-28 rounded-xl overflow-hidden">
                <Image
                  src={img}
                  alt={`Upload ${index + 1}`}
                  width={128}
                  height={112}
                  className="object-cover w-full h-full"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 md:top-2 md:right-2 w-5 h-5 md:w-6 md:h-6 bg-[#525252] hover:bg-[#737373] rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
                </button>
              </div>
            ))}
            {uploadedImages.length < maxFiles && (
              <button className="w-24 h-20 md:w-32 md:h-28 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-1 text-[#737373]">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[10px] md:text-xs">Add More</span>
              </button>
            )}
          </div>
          <p className="text-[10px] md:text-xs text-[#737373] mt-2">{uploadedImages.length}/{maxFiles} files added</p>
        </div>
        
        {/* Action Icons */}
        <div className="px-3 md:px-5 pb-3 md:pb-4">
          <div className="flex items-center gap-1 md:gap-2">
            {[
              { icon: Smile, label: "Emoji" },
              { icon: MapPin, label: "Location" },
              { icon: Hash, label: "Hashtag" },
              { icon: AtSign, label: "Mention" },
            ].map((action) => (
              <button
                key={action.label}
                className="p-2 md:p-2.5 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#737373]"
                title={action.label}
              >
                <action.icon className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 md:px-5 py-3 md:py-4 border-t border-[#f0f0f0]">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <button
              onClick={() => setVisibility("public")}
              className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${
                visibility === "public"
                  ? "bg-[#F44444] text-white"
                  : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"
              }`}
            >
              Public
            </button>
            <button
              onClick={() => setVisibility("circle")}
              className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all ${
                visibility === "circle"
                  ? "bg-[#F44444] text-white"
                  : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"
              }`}
            >
              Circle only
            </button>
          </div>
          
          <div className="flex items-center justify-center sm:justify-end gap-2 md:gap-3">
            <span className="text-xs md:text-sm text-[#737373]">{postContent.length}/{maxChars}</span>
            <button className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors">
              Save draft
            </button>
            <button className="px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d64d3c] transition-colors">
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateStoryModal() {
  const { isOpen, setIsOpen } = useContext(CreateStoryContext);
  const currentUser = users[0];
  const [visibility, setVisibility] = useState<"public" | "circle">("public");
  const [textOverlay, setTextOverlay] = useState("");
  const [textStyle, setTextStyle] = useState({ bold: false, italic: false, align: "center" as "left" | "center" | "right" });
  const [textColor, setTextColor] = useState("#ffffff");
  const [uploadedMedia, setUploadedMedia] = useState([
    "https://picsum.photos/seed/story-media-1/400/600",
  ]);
  const [activeStickers, setActiveStickers] = useState<string[]>([]);
  
  // Draggable element positions (percentage based)
  const [elementPositions, setElementPositions] = useState<Record<string, { x: number; y: number; scale: number }>>({
    text: { x: 50, y: 85, scale: 1 },
    poll: { x: 50, y: 30, scale: 1 },
    question: { x: 50, y: 30, scale: 1 },
    location: { x: 20, y: 75, scale: 1 },
    hashtag: { x: 80, y: 70, scale: 1 },
    time: { x: 85, y: 8, scale: 1 },
    mention: { x: 50, y: 50, scale: 1 },
    link: { x: 50, y: 60, scale: 1 },
    music: { x: 15, y: 90, scale: 1 },
  });
  const [dragging, setDragging] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const previewRef = useState<HTMLDivElement | null>(null);
  
  const removeMedia = (index: number) => {
    setUploadedMedia(prev => prev.filter((_, i) => i !== index));
  };
  
  const toggleSticker = (sticker: string) => {
    setActiveStickers(prev => 
      prev.includes(sticker) ? prev.filter(s => s !== sticker) : [...prev, sticker]
    );
  };
  
  const handleDragStart = (elementId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDragging(elementId);
    setSelectedElement(elementId);
  };
  
  const handleDrag = (e: React.MouseEvent | React.TouchEvent, containerRef: HTMLDivElement | null) => {
    if (!dragging || !containerRef) return;
    
    const rect = containerRef.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    
    setElementPositions(prev => ({
      ...prev,
      [dragging]: { ...prev[dragging], x, y }
    }));
  };
  
  const handleDragEnd = () => {
    setDragging(null);
  };
  
  const adjustScale = (elementId: string, delta: number) => {
    setElementPositions(prev => ({
      ...prev,
      [elementId]: { 
        ...prev[elementId], 
        scale: Math.max(0.5, Math.min(2, (prev[elementId]?.scale || 1) + delta))
      }
    }));
  };
  
  const textColors = ["#ffffff", "#0a0a0a", "#F44444", "#FFD700", "#00D4FF", "#9B59B6"];
  
  const stickers = [
    { id: "poll", label: "Poll", icon: BarChart3 },
    { id: "question", label: "Question", icon: MessageCircle },
    { id: "mention", label: "Mention", icon: AtSign },
    { id: "hashtag", label: "Hashtag", icon: Hash },
    { id: "location", label: "Location", icon: MapPin },
    { id: "link", label: "Link", icon: Link2 },
    { id: "time", label: "Time", icon: Clock },
    { id: "music", label: "Music", icon: Activity },
  ];
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />
      <div className="relative bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-5 border-b border-[#f0f0f0]">
          <h2 className="text-lg md:text-xl font-semibold text-[#0a0a0a]">Create Story</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 md:p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#737373]" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Story Preview */}
          <div className="w-full md:w-[320px] lg:w-[360px] flex-shrink-0 p-4 md:p-6">
            <div 
              className="relative w-full max-w-[280px] md:max-w-none mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-gradient-to-br from-[#667eea] via-[#64b3f4] to-[#f093fb] select-none"
              onMouseMove={(e) => handleDrag(e, e.currentTarget)}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchMove={(e) => handleDrag(e, e.currentTarget)}
              onTouchEnd={handleDragEnd}
              onClick={() => setSelectedElement(null)}
            >
              {/* Background Media */}
              {uploadedMedia.length > 0 && (
                <Image
                  src={uploadedMedia[0]}
                  alt="Story background"
                  fill
                  className="object-cover pointer-events-none"
                />
              )}
              
              {/* User Info Overlay */}
              <div className="absolute top-2 md:top-4 left-2 md:left-4 flex items-center gap-1.5 md:gap-2 z-10 pointer-events-none">
                <div className="w-7 h-7 md:w-10 md:h-10 rounded-full overflow-hidden ring-2 ring-white/50">
                  <Image
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-0.5 md:gap-1">
                    <span className="text-white text-[10px] md:text-sm font-semibold drop-shadow-md">{currentUser.name}</span>
                    <VerifiedBadge className="scale-50 md:scale-75" />
                  </div>
                  <span className="text-white/80 text-[8px] md:text-xs drop-shadow-md">{currentUser.title}</span>
                </div>
              </div>
              
              {/* Draggable Stickers */}
              {activeStickers.includes("poll") && (
                <div 
                  className={`absolute bg-white/90 backdrop-blur-sm rounded-lg md:rounded-xl p-2 md:p-3 z-20 cursor-move transition-shadow ${selectedElement === 'poll' ? 'ring-2 ring-[#F44444] shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.poll?.x || 50}%`, 
                    top: `${elementPositions.poll?.y || 30}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.poll?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('poll', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('poll', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] md:text-sm font-medium text-[#0a0a0a] mb-1.5 md:mb-2">What do you think?</p>
                  <div className="space-y-1 md:space-y-2">
                    <div className="bg-[#f5f5f5] rounded-md md:rounded-lg px-2 md:px-3 py-1 md:py-2 text-[10px] md:text-sm">Option 1</div>
                    <div className="bg-[#f5f5f5] rounded-md md:rounded-lg px-2 md:px-3 py-1 md:py-2 text-[10px] md:text-sm">Option 2</div>
                  </div>
                </div>
              )}
              
              {activeStickers.includes("question") && (
                <div 
                  className={`absolute bg-white/90 backdrop-blur-sm rounded-lg md:rounded-xl p-2 md:p-3 z-20 cursor-move transition-shadow ${selectedElement === 'question' ? 'ring-2 ring-[#F44444] shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.question?.x || 50}%`, 
                    top: `${elementPositions.question?.y || 30}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.question?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('question', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('question', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] md:text-sm font-medium text-[#0a0a0a] mb-1.5 md:mb-2">Ask me anything</p>
                  <div className="bg-[#f5f5f5] rounded-md md:rounded-lg px-2 md:px-3 py-1 md:py-2 text-[10px] md:text-sm text-[#737373]">Type your question...</div>
                </div>
              )}
              
              {activeStickers.includes("location") && (
                <div 
                  className={`absolute bg-white/90 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5 flex items-center gap-1 md:gap-1.5 z-20 cursor-move transition-shadow ${selectedElement === 'location' ? 'ring-2 ring-[#F44444] shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.location?.x || 20}%`, 
                    top: `${elementPositions.location?.y || 75}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.location?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('location', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('location', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin className="w-3 h-3 md:w-4 md:h-4 text-[#F44444]" />
                  <span className="text-[10px] md:text-sm font-medium">San Francisco, CA</span>
                </div>
              )}
              
              {activeStickers.includes("time") && (
                <div 
                  className={`absolute bg-black/50 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5 z-20 cursor-move transition-shadow ${selectedElement === 'time' ? 'ring-2 ring-[#F44444] shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.time?.x || 85}%`, 
                    top: `${elementPositions.time?.y || 8}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.time?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('time', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('time', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-white text-[10px] md:text-sm font-medium">12:30 PM</span>
                </div>
              )}
              
              {activeStickers.includes("hashtag") && (
                <div 
                  className={`absolute bg-[#F44444] rounded-full px-2 md:px-3 py-1 md:py-1.5 z-20 cursor-move transition-shadow ${selectedElement === 'hashtag' ? 'ring-2 ring-white shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.hashtag?.x || 80}%`, 
                    top: `${elementPositions.hashtag?.y || 70}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.hashtag?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('hashtag', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('hashtag', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-white text-[10px] md:text-sm font-medium">#trending</span>
                </div>
              )}
              
              {activeStickers.includes("mention") && (
                <div 
                  className={`absolute bg-white/90 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5 z-20 cursor-move transition-shadow ${selectedElement === 'mention' ? 'ring-2 ring-[#F44444] shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.mention?.x || 50}%`, 
                    top: `${elementPositions.mention?.y || 50}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.mention?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('mention', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('mention', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] md:text-sm font-medium text-[#0a0a0a]">@username</span>
                </div>
              )}
              
              {activeStickers.includes("link") && (
                <div 
                  className={`absolute bg-white/90 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5 flex items-center gap-1 md:gap-1.5 z-20 cursor-move transition-shadow ${selectedElement === 'link' ? 'ring-2 ring-[#F44444] shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.link?.x || 50}%`, 
                    top: `${elementPositions.link?.y || 60}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.link?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('link', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('link', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link2 className="w-3 h-3 md:w-4 md:h-4 text-[#F44444]" />
                  <span className="text-[10px] md:text-sm font-medium text-[#0a0a0a]">Link</span>
                </div>
              )}
              
              {activeStickers.includes("music") && (
                <div 
                  className={`absolute bg-black/60 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5 flex items-center gap-1 md:gap-1.5 z-20 cursor-move transition-shadow ${selectedElement === 'music' ? 'ring-2 ring-[#F44444] shadow-lg' : ''}`}
                  style={{ 
                    left: `${elementPositions.music?.x || 15}%`, 
                    top: `${elementPositions.music?.y || 90}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.music?.scale || 1})`,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('music', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('music', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Activity className="w-3 h-3 md:w-4 md:h-4 text-white" />
                  <span className="text-[10px] md:text-sm font-medium text-white">Song Name</span>
                </div>
              )}
              
              {/* Draggable Text Overlay */}
              {textOverlay && (
                <div 
                  className={`absolute z-20 cursor-move transition-shadow px-1.5 md:px-2 py-0.5 md:py-1 rounded ${selectedElement === 'text' ? 'ring-2 ring-white/50 bg-black/20' : ''}`}
                  style={{ 
                    left: `${elementPositions.text?.x || 50}%`, 
                    top: `${elementPositions.text?.y || 85}%`,
                    transform: `translate(-50%, -50%) scale(${elementPositions.text?.scale || 1})`,
                    textAlign: textStyle.align,
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDragStart('text', e); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleDragStart('text', e); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p 
                    className={`text-sm md:text-lg drop-shadow-lg whitespace-nowrap ${textStyle.bold ? 'font-bold' : 'font-medium'} ${textStyle.italic ? 'italic' : ''}`}
                    style={{ color: textColor }}
                  >
                    {textOverlay}
                  </p>
                </div>
              )}
              
              {/* Scale Controls for Selected Element */}
              {selectedElement && (
                <div className="absolute bottom-1.5 md:bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 md:gap-2 bg-black/60 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5 z-30">
                  <button 
                    onClick={(e) => { e.stopPropagation(); adjustScale(selectedElement, -0.1); }}
                    className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-white hover:bg-white/20 rounded-full"
                  >
                    <span className="text-sm md:text-lg font-bold">−</span>
                  </button>
                  <span className="text-white text-[10px] md:text-xs font-medium w-8 md:w-12 text-center">
                    {Math.round((elementPositions[selectedElement]?.scale || 1) * 100)}%
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); adjustScale(selectedElement, 0.1); }}
                    className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-white hover:bg-white/20 rounded-full"
                  >
                    <span className="text-sm md:text-lg font-bold">+</span>
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-[#737373] text-center mt-2">Drag elements to reposition</p>
          </div>
          
          {/* Editing Panel */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto border-t md:border-t-0 md:border-l border-[#f0f0f0]">
            {/* Media Section */}
            <div className="mb-4 md:mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-2 md:mb-3">Media</h3>
              <div className="flex gap-2 md:gap-3 flex-wrap">
                <button className="w-20 h-18 md:w-28 md:h-24 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-1 text-[#737373] cursor-pointer">
                  <ImagePlus className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="text-[10px] md:text-xs text-center">Add media</span>
                </button>
                {uploadedMedia.map((media, index) => (
                  <div key={index} className="relative w-20 h-18 md:w-28 md:h-24 rounded-xl overflow-hidden ring-2 ring-[#F44444]">
                    <Image
                      src={media}
                      alt={`Media ${index + 1}`}
                      width={112}
                      height={96}
                      className="object-cover w-full h-full"
                    />
                    <button
                      onClick={() => removeMedia(index)}
                      className="absolute top-1 right-1 w-5 h-5 bg-[#525252] hover:bg-[#737373] rounded-full flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Text Overlay Section */}
            <div className="mb-4 md:mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-2 md:mb-3">Text Overlay</h3>
              
              {/* Text Tools */}
              <div className="flex items-center gap-1 mb-2 md:mb-3 overflow-x-auto pb-1">
                <button
                  onClick={() => setTextStyle(s => ({ ...s, bold: !s.bold }))}
                  className={`p-1.5 md:p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.bold ? 'bg-[#F44444] text-white' : 'hover:bg-[#f5f5f5] text-[#525252]'}`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTextStyle(s => ({ ...s, italic: !s.italic }))}
                  className={`p-1.5 md:p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.italic ? 'bg-[#F44444] text-white' : 'hover:bg-[#f5f5f5] text-[#525252]'}`}
                >
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-px h-5 md:h-6 bg-[#e5e5e5] mx-0.5 md:mx-1 flex-shrink-0" />
                <button
                  onClick={() => setTextStyle(s => ({ ...s, align: "left" }))}
                  className={`p-1.5 md:p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.align === "left" ? 'bg-[#F44444] text-white' : 'hover:bg-[#f5f5f5] text-[#525252]'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTextStyle(s => ({ ...s, align: "center" }))}
                  className={`p-1.5 md:p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.align === "center" ? 'bg-[#F44444] text-white' : 'hover:bg-[#f5f5f5] text-[#525252]'}`}
                >
                  <Menu className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTextStyle(s => ({ ...s, align: "right" }))}
                  className={`p-1.5 md:p-2 rounded-lg transition-colors flex-shrink-0 ${textStyle.align === "right" ? 'bg-[#F44444] text-white' : 'hover:bg-[#f5f5f5] text-[#525252]'}`}
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <div className="w-px h-5 md:h-6 bg-[#e5e5e5] mx-0.5 md:mx-1 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {textColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setTextColor(color)}
                      className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-all flex-shrink-0 ${textColor === color ? 'border-[#F44444] scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color, boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #e5e5e5" : undefined }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="bg-[#f8f9fa] rounded-xl p-3 md:p-4">
                <textarea
                  value={textOverlay}
                  onChange={(e) => setTextOverlay(e.target.value)}
                  placeholder="Add text to your story..."
                  className="w-full bg-transparent text-[#262626] text-sm resize-none outline-none min-h-[60px] md:min-h-[80px]"
                />
              </div>
            </div>
            
            {/* Stickers & Elements Section */}
            <div className="mb-4 md:mb-6">
              <h3 className="text-sm font-semibold text-[#0a0a0a] mb-2 md:mb-3">Stickers & Elements</h3>
              <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                {stickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => toggleSticker(sticker.id)}
                    className={`flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-lg md:rounded-xl transition-all cursor-pointer ${
                      activeStickers.includes(sticker.id) 
                        ? 'bg-[#F44444] text-white' 
                        : 'bg-[#f8f9fa] text-[#525252] hover:bg-[#f0f0f0]'
                    }`}
                  >
                    <sticker.icon className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-[10px] md:text-xs font-medium">{sticker.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-t border-[#f0f0f0]">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <button
              onClick={() => setVisibility("public")}
              className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all cursor-pointer ${
                visibility === "public"
                  ? "bg-[#F44444] text-white"
                  : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"
              }`}
            >
              Public
            </button>
            <button
              onClick={() => setVisibility("circle")}
              className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-full transition-all cursor-pointer ${
                visibility === "circle"
                  ? "bg-[#F44444] text-white"
                  : "bg-white text-[#525252] border border-[#e5e5e5] hover:bg-[#f5f5f5]"
              }`}
            >
              Circle only
            </button>
          </div>
          
          <div className="flex items-center justify-center sm:justify-end gap-2 md:gap-3">
            <button className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#f5f5f5] transition-colors cursor-pointer">
              Save draft
            </button>
            <button className="px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium bg-[#F44444] text-white rounded-full hover:bg-[#d64d3c] transition-colors cursor-pointer">
              Post Story
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ post }: { post: (typeof posts)[0] }) {
  const user = users.find((u) => u.id === post.userId)!;
  const { setSelectedArticle } = useContext(ArticleContext);
  
  return (
    <div 
      onClick={() => setSelectedArticle(post.id)}
      className="bg-white rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-200 animate-fade-in cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        <div className="w-full sm:w-40 h-48 sm:h-auto flex-shrink-0 rounded-lg overflow-hidden">
          <Image
            src={post.image!}
            alt={post.title!}
            width={160}
            height={200}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {post.tags?.map((tag, i) => (
                <span key={tag}>
                  <span className="text-[#F44444]">{tag}</span>
                  {i < post.tags!.length - 1 && <span className="text-[#a3a3a3] ml-2">•</span>}
                </span>
              ))}
              <span className="text-[#a3a3a3]">•</span>
              <span className="text-[#737373]">{post.date}</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); }}
              className="p-1 hover:bg-[#f5f5f5] rounded transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-[#737373]" />
            </button>
          </div>
          <h3 className="text-base font-semibold mb-1.5 leading-tight text-[#0a0a0a]">{post.title}</h3>
          <p className="text-[#525252] text-xs mb-3 line-clamp-2">{post.description}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#737373]">{user.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); }}
                className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4 text-[#737373]" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); }}
                className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
              >
                <Bookmark className="w-4 h-4 text-[#737373]" />
              </button>
              <ReadButton onRead={(postId) => setSelectedArticle(postId)} postId={post.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: (typeof posts)[0] }) {
  const user = users.find((u) => u.id === post.userId)!;
  const { following, toggleFollow } = useContext(FollowingContext);
  const isFollowing = following.has(user.id);
  const isCurrentUser = user.id === 1; // Jessin Sam S is the current user
  
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-200 animate-fade-in">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
            <Image
              src={user.avatar}
              alt={user.name}
              width={36}
              height={36}
              className="object-cover w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-sm text-[#0a0a0a]">{user.name}</span>
              <VerifiedBadge />
              <span className="text-[#a3a3a3]">•</span>
              <span className="text-[#737373] text-xs">{post.date}</span>
              {post.time && (
                <>
                  <span className="text-[#a3a3a3] hidden sm:inline">•</span>
                  <span className="text-[#737373] text-xs hidden sm:inline">{post.time}</span>
                </>
              )}
            </div>
            <span className="text-[#737373] text-xs truncate block">{user.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isCurrentUser && (
            <button 
              onClick={() => toggleFollow(user.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ease-out ${
                isFollowing 
                  ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb] hover:border-[#d5d5d5] scale-100" 
                  : "bg-[#F44444] text-white border border-transparent hover:bg-[#d64d3c] scale-100"
              } active:scale-95`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
          <button className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
            <MoreVertical className="w-4 h-4 text-[#737373]" />
          </button>
        </div>
      </div>
      
      <p className="text-[#262626] text-sm mb-3">{post.content}</p>
      
      {post.image && (
        <div className="rounded-lg overflow-hidden">
          <Image
            src={post.image}
            alt="Post image"
            width={800}
            height={500}
            className="object-cover w-full"
          />
        </div>
      )}
      
      <div className="flex items-center justify-between pt-3 mt-3 text-[#737373]">
        <div className="flex items-center">
          <button className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
            <Eye className="w-4 h-4" />
            <span className="text-xs">{post.stats.views}</span>
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
            <ThumbsUp className="w-4 h-4" />
            <span className="text-xs">{post.stats.likes}</span>
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs">{post.stats.comments}</span>
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
            <Share2 className="w-4 h-4" />
            <span className="text-xs">{post.stats.shares}</span>
          </button>
        </div>
        <button className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-[#f5f5f5] transition-colors">
          <Bookmark className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">1k</span>
        </button>
      </div>
    </div>
  );
}

function CenterFeed() {
  const [activeTab, setActiveTab] = useState(0);
  const { following } = useContext(FollowingContext);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Filter posts based on active tab
  const getFilteredPosts = () => {
    const tabName = filterTabs[activeTab];
    
    switch (tabName) {
      case "Following":
        return posts.filter(post => following.has(post.userId) || post.userId === 1);
      case "News":
        return posts.filter(post => post.tags?.includes("News"));
      case "AI":
        return posts.filter(post => post.tags?.includes("AI"));
      case "Technology":
        return posts.filter(post => post.tags?.includes("Technology"));
      case "Trending":
        // Sort by engagement (likes + comments + shares as numbers)
        return [...posts].sort((a, b) => {
          const parseNum = (s: string) => parseFloat(s.replace('k', '000').replace('.', ''));
          const engagementA = parseNum(a.stats.likes) + parseNum(a.stats.comments);
          const engagementB = parseNum(b.stats.likes) + parseNum(b.stats.comments);
          return engagementB - engagementA;
        });
      default: // "For You"
        return posts;
    }
  };
  
  const filteredPosts = getFilteredPosts();
  
  // Create a key based on the filtered post IDs to trigger re-animation
  const feedKey = `${activeTab}-${Array.from(following).sort().join(',')}`;
  
  const handleTabChange = (tab: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };
  
  return (
    <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white">
      <FeedHeader activeTab={activeTab} setActiveTab={handleTabChange} />
      <div 
        key={feedKey}
        className={`space-y-3 pt-4 pb-6 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 animate-fade-in">
            <p className="text-[#737373] text-sm">No posts to show. Follow some people to see their posts here.</p>
          </div>
        ) : (
          filteredPosts.map((post, index) =>
            post.type === "article" ? (
              <ArticleCard key={`${feedKey}-${post.id}`} post={post} />
            ) : (
              <PostCard key={`${feedKey}-${post.id}`} post={post} />
            )
          )
        )}
      </div>
    </main>
  );
}

function ExploreView() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { following, toggleFollow } = useContext(FollowingContext);

  // Mix articles, posts, and people for the explore feed
  const getExploreContent = () => {
    const tabName = exploreTabs[activeTab];
    let filtered = [...posts];
    switch (tabName) {
      case "Trending":
        filtered = [...posts].sort((a, b) => {
          const parseNum = (s: string) => parseFloat(s.replace("k", "000").replace(".", ""));
          return (parseNum(b.stats.likes) + parseNum(b.stats.comments)) - (parseNum(a.stats.likes) + parseNum(a.stats.comments));
        });
        break;
      case "News":
        filtered = posts.filter(p => p.tags?.includes("News"));
        break;
      case "Founders":
        filtered = posts.filter(p => p.tags?.some(t => ["Business", "Startups"].includes(t)));
        break;
      case "Companies":
        filtered = posts.filter(p => p.tags?.some(t => ["Technology", "AI", "Business"].includes(t)));
        break;
      case "Circle":
        filtered = posts.filter(p => following.has(p.userId));
        break;
    }

    const subTabName = exploreSubTabs[activeSubTab];
    if (subTabName === "Latest") {
      filtered = [...filtered].reverse();
    } else if (subTabName === "People") {
      return { type: "people" as const, items: filtered };
    } else if (subTabName === "Companies") {
      filtered = filtered.filter(p => {
        const u = users.find(u => u.id === p.userId);
        return u && ["Open AI", "Y Combinator"].includes(u.name);
      });
    }
    return { type: "posts" as const, items: filtered };
  };

  const content = getExploreContent();
  const featuredPeople = users.slice(1, 6);

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white">
      {/* Header */}
      <div className="sticky top-[57px] md:top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
        <div className="flex items-center justify-between mb-4">
          {showSearch ? (
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search explore..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-4 py-2 rounded-full bg-[#f5f5f5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                />
              </div>
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#737373]" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Explore</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
                >
                  <Search className="w-5 h-5 text-[#737373]" />
                </button>
                <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                  <Filter className="w-5 h-5 text-[#737373]" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
          {exploreTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === activeTab
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 pb-6 space-y-5">
        {/* Trending Now */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">Trending Now</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4">
            {trendingTopics.map((topic) => (
              <div
                key={topic.id}
                className="flex items-center gap-3 min-w-[180px] p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors cursor-pointer flex-shrink-0"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={topic.image}
                    alt={topic.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{topic.name}</p>
                  <p className="text-xs text-[#737373] truncate">{topic.posts}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1.5">
          {exploreSubTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === activeSubTab
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {content.type === "people" ? (
          <div className="space-y-2">
            {featuredPeople.map((user, idx) => {
              const isFollowing = following.has(user.id);
              return (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors">
                  <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ${
                    user.hasStory
                      ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white"
                      : "ring-1 ring-[#e5e5e5]"
                  }`}>
                    <Image src={user.avatar} alt={user.name} width={44} height={44} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm text-[#0a0a0a]">{user.name}</span>
                      {user.verified && <VerifiedBadge className="scale-90" />}
                      {idx === 0 && (
                        <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold">
                          <AlbizLogo size={12} /> #{String(idx + 1).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#737373] block truncate">{user.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">
                      View
                    </button>
                    <button
                      onClick={() => toggleFollow(user.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                        isFollowing
                          ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                          : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                      }`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {content.items.map((post) =>
              post.type === "article" ? (
                <ArticleCard key={post.id} post={post} />
              ) : (
                <PostCard key={post.id} post={post} />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function CircleMemberAvatar({ member, size = 44 }: { member: typeof circleMembers[0]; size?: number }) {
  if (member.hasInitial) {
    return (
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
        style={{ backgroundColor: member.initialBg, width: size, height: size, fontSize: size * 0.4 }}
      >
        {member.initial}
      </div>
    );
  }
  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]" style={{ width: size, height: size }}>
      <Image src={member.avatar} alt={member.name} width={size} height={size} className="object-cover w-full h-full" />
    </div>
  );
}

function CircleProfileRow({ member, isFollowed, onToggleFollow }: {
  member: typeof circleMembers[0];
  isFollowed: boolean;
  onToggleFollow: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors">
      <CircleMemberAvatar member={member} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-medium text-sm text-[#0a0a0a] truncate">{member.name}</span>
          {member.verified && <VerifiedBadge className="scale-90" />}
        </div>
        <span className="text-xs text-[#737373] block truncate">{member.title}</span>
      </div>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold flex-shrink-0">
        <AlbizLogo size={12} />
        #{String(member.rank).padStart(2, "0")}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">
          {isFollowed ? "Message" : "View"}
        </button>
        <button
          onClick={onToggleFollow}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
            isFollowed
              ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
              : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
          }`}
        >
          {isFollowed ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}

function CirclePostCard({ member, post, isFollowed, onToggleFollow }: {
  member: typeof circleMembers[0];
  post: typeof circlePosts[0];
  isFollowed: boolean;
  onToggleFollow: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors overflow-hidden">
      {/* Profile header */}
      <div className="flex items-center gap-3 p-3">
        <CircleMemberAvatar member={member} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm text-[#0a0a0a] truncate">{member.name}</span>
            {member.verified && <VerifiedBadge className="scale-90" />}
            <span className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#F44444] text-[10px] font-semibold">
              <AlbizLogo size={10} />
              #{String(member.rank).padStart(2, "0")}
            </span>
          </div>
          <span className="text-xs text-[#737373] block truncate">{member.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggleFollow}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
              isFollowed
                ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
            }`}
          >
            {isFollowed ? "Following" : "Follow"}
          </button>
        </div>
      </div>

      {/* Post content */}
      <div className="px-3 pb-3">
        <p className="text-sm text-[#262626] leading-relaxed">{post.content}</p>
      </div>

      {/* Post image */}
      {post.image && (
        <div className="mx-3 mb-3 rounded-lg overflow-hidden">
          <Image
            src={post.image}
            alt=""
            width={800}
            height={400}
            className="object-cover w-full h-auto"
          />
        </div>
      )}

      {/* Post stats */}
      <div className="flex items-center gap-4 px-3 pb-3 border-t border-[#f0f0f0] pt-2.5">
        <button className="flex items-center gap-1.5 text-[#737373] hover:text-[#F44444] transition-colors">
          <Heart className="w-4 h-4" />
          <span className="text-xs">{post.stats.likes}</span>
        </button>
        <button className="flex items-center gap-1.5 text-[#737373] hover:text-[#0a0a0a] transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">{post.stats.comments}</span>
        </button>
        <button className="flex items-center gap-1.5 text-[#737373] hover:text-[#0a0a0a] transition-colors">
          <Share2 className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button className="text-[#737373] hover:text-[#0a0a0a] transition-colors">
          <Bookmark className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CircleView() {
  const [activeTab, setActiveTab] = useState(0); // "For You" tab active by default
  const [circleFollowing, setCircleFollowing] = useState<Set<number>>(() => {
    return new Set(circleMembers.slice(1).map(m => m.id));
  });

  const toggleCircleFollow = (memberId: number) => {
    setCircleFollowing(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const getFilteredMembers = () => {
    const tab = circleTabs[activeTab];
    switch (tab) {
      case "Following":
        return circleMembers.filter(m => circleFollowing.has(m.id));
      case "My Circle":
        return circleMembers.filter(m => circleFollowing.has(m.id));
      case "Suggested":
        return circleMembers.filter(m => !circleFollowing.has(m.id));
      case "Founders":
        return circleMembers.filter(m => !m.hasInitial);
      case "Companies":
        return circleMembers.filter(m => m.hasInitial);
      default:
        return circleMembers;
    }
  };

  const filtered = getFilteredMembers();
  const tabLabel = circleTabs[activeTab];
  const isMixedFeed = tabLabel === "For You" || tabLabel === "Following";
  const isFollowingTab = tabLabel === "Following";

  // Build mixed feed - interleave profiles and profile+post cards
  const postLookup = new Map(circlePosts.map(p => [p.memberId, p]));

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white">
      {/* Header */}
      <div className="sticky top-[57px] md:top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Circle</h1>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <Search className="w-5 h-5 text-[#737373]" />
            </button>
            <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <Filter className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
          {circleTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === activeTab
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 pb-6">
        {!isMixedFeed && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-[#0a0a0a]">{tabLabel}</span>
              <span className="text-sm text-[#737373]">{filtered.length > 999 ? "1M+" : filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Search className="w-4 h-4 text-[#737373]" />
              </button>
              <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-[#737373]" />
              </button>
            </div>
          </div>
        )}

        <div className={isMixedFeed ? "space-y-3" : "space-y-1"}>
          {filtered.map((member) => {
            const isFollowed = circleFollowing.has(member.id);
            const memberPost = isMixedFeed ? postLookup.get(member.id) : undefined;

            // Following tab: only show members that have posts
            if (isFollowingTab && !memberPost) return null;

            if (memberPost) {
              return (
                <CirclePostCard
                  key={member.id}
                  member={member}
                  post={memberPost}
                  isFollowed={isFollowed}
                  onToggleFollow={() => toggleCircleFollow(member.id)}
                />
              );
            }

            return (
              <CircleProfileRow
                key={member.id}
                member={member}
                isFollowed={isFollowed}
                onToggleFollow={() => toggleCircleFollow(member.id)}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}

function MessagesView() {
  const [activeConvo, setActiveConvo] = useState(conversations[0].id);
  const [activeTab, setActiveTab] = useState(0);
  const [messageInput, setMessageInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedConvo = conversations.find(c => c.id === activeConvo)!;
  const selectedUser = users.find(u => u.id === selectedConvo.userId)!;

  const filteredConvos = activeTab === 1
    ? conversations.filter(c => c.unreadCount > 0)
    : conversations;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo]);

  const handleSelectConvo = (id: number) => {
    setActiveConvo(id);
    setShowChat(true);
  };

  return (
    <div className="flex-1 flex min-w-0 h-[calc(100vh-57px)] md:h-screen sticky top-[57px] md:top-0">
      {/* Conversation list panel - full width on mobile, fixed width on md+ */}
      <div className={`flex-shrink-0 border-r border-[#e5e5e5] flex flex-col h-full bg-white overflow-hidden ${
        showChat ? "hidden md:flex md:w-80" : "w-full md:w-80"
      }`}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold">Messages</h1>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Search className="w-5 h-5 text-[#737373]" />
              </button>
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-[#737373]" />
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {messageTabs.map((tab, i) => (
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

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvos.map(convo => {
            const convoUser = users.find(u => u.id === convo.userId);
            if (!convoUser) return null;
            const isActive = convo.id === activeConvo;
            return (
              <button
                key={convo.id}
                onClick={() => handleSelectConvo(convo.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  isActive
                    ? "bg-[#f5f5f5]"
                    : "hover:bg-[#fafafa]"
                }`}
              >
                <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                  <Image
                    src={convoUser.avatar}
                    alt={convoUser.name}
                    width={44}
                    height={44}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-sm truncate ${convo.unreadCount > 0 ? "font-semibold text-[#0a0a0a]" : "font-medium text-[#0a0a0a]"}`}>
                        {convoUser.name}
                      </span>
                      {convoUser.verified && <VerifiedBadge className="scale-75 flex-shrink-0" />}
                    </div>
                    <span className="text-[11px] text-[#a3a3a3] flex-shrink-0 ml-2">{convo.time}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-xs truncate ${convo.unreadCount > 0 ? "text-[#525252] font-medium" : "text-[#737373]"}`}>
                      {convo.lastMessage}
                    </span>
                    {convo.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#F44444] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0 ml-2">
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat panel - hidden on mobile when showChat is false */}
      <div className={`flex-1 flex-col h-full bg-[#fafafa] min-w-0 ${
        showChat ? "flex" : "hidden md:flex"
      }`}>
        {/* Chat header */}
        <div className="flex items-center justify-between px-3 md:px-5 py-3 bg-white border-b border-[#e5e5e5] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChat(false)}
              className="md:hidden p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#525252]" />
            </button>
            <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-[#e5e5e5]">
              <Image
                src={selectedUser.avatar}
                alt={selectedUser.name}
                width={44}
                height={44}
                className="object-cover w-full h-full"
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm">{selectedUser.name}</span>
                {selectedUser.verified && <VerifiedBadge className="scale-90" />}
              </div>
              {selectedConvo.online ? (
                <span className="text-xs text-[#22c55e] font-medium">Online</span>
              ) : (
                <span className="text-xs text-[#a3a3a3]">Offline</span>
              )}
            </div>
          </div>
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <Search className="w-5 h-5 text-[#737373]" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex justify-center mb-6">
            <span className="px-3 py-1 rounded-full bg-[#e5e5e5] text-[11px] text-[#737373] font-medium">Today</span>
          </div>
          <div className="space-y-3">
            {selectedConvo.messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.fromMe
                      ? "bg-[#FFF0F0] text-[#0a0a0a] rounded-br-md"
                      : "bg-white text-[#0a0a0a] rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Message input */}
        <div className="px-4 py-3 bg-white border-t border-[#e5e5e5] flex items-center gap-3 flex-shrink-0">
          <button className="p-2 hover:bg-[#f5f5f5] rounded-full transition-colors flex-shrink-0">
            <Plus className="w-5 h-5 text-[#737373]" />
          </button>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-[#f5f5f5] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
          />
          <button className="p-2 hover:bg-[#f5f5f5] rounded-full transition-colors flex-shrink-0">
            <Mic className="w-5 h-5 text-[#737373]" />
          </button>
          <button className="w-10 h-10 rounded-full bg-[#F44444] flex items-center justify-center flex-shrink-0 hover:bg-[#d64d3c] transition-colors">
            <ArrowUp className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, color = "#F44444", width = 80, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

function ViewsChart() {
  const [chartTab, setChartTab] = useState(0);
  const chartTabs = ["Posts", "Profile", "All"];
  const max = Math.max(...viewsOverTime.map(d => d.value));
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const w = 400;
  const h = 200;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;

  const points = viewsOverTime.map((d, i) => {
    const x = padding.left + (i / (viewsOverTime.length - 1)) * innerW;
    const y = padding.top + innerH - (d.value / max) * innerH;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  const xLabels = ["01 OCT", "08 OCT", "15 OCT", "22 OCT", "30 OCT"];

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-[#0a0a0a]">Views over time</span>
        <div className="flex gap-1">
          {chartTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setChartTab(i)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                i === chartTab
                  ? "bg-[#f5f5f5] text-[#0a0a0a]"
                  : "text-[#737373] hover:text-[#0a0a0a]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F44444" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#F44444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chartGrad)" />
        <path d={linePath} fill="none" stroke="#F44444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#F44444" />
        ))}
        {xLabels.map((label, i) => {
          const x = padding.left + (i / (xLabels.length - 1)) * innerW;
          return (
            <text key={i} x={x} y={h - 6} textAnchor="middle" className="fill-[#a3a3a3]" style={{ fontSize: "9px" }}>
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function SettingsView() {
  const [activeTab, setActiveTab] = useState(0);
  const { signOut } = useContext(AuthContext);
  const { setActiveView } = useContext(NavContext);

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white">
      {/* Header */}
      <div className="sticky top-[57px] md:top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Settings</h1>
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <Search className="w-5 h-5 text-[#737373]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
          {settingsTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === activeTab
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6 pb-6 space-y-6">
        {/* Account info */}
        <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">Account info</span>
          </div>
          {accountInfo.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center justify-between px-5 py-4 ${
                i < accountInfo.length - 1 ? "border-b border-[#f0f0f0]" : ""
              }`}
            >
              <div className="flex items-center gap-6">
                <span className="text-sm text-[#737373] w-20">{item.label}</span>
                <span className="text-sm text-[#0a0a0a]">{item.value}</span>
              </div>
              <button className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors">
                Edit
              </button>
            </div>
          ))}
        </div>

        {/* Language & Region */}
        <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">Language & Region</span>
          </div>
          {languageRegion.map((item, i) => (
            <div
              key={item.label}
              className={`px-5 py-4 ${
                i < languageRegion.length - 1 ? "border-b border-[#f0f0f0]" : ""
              }`}
            >
              <span className="text-xs text-[#737373] block mb-1.5">{item.label}</span>
              <div className="flex items-center justify-between bg-[#fafafa] rounded-lg px-4 py-2.5 border border-[#e5e5e5]">
                <span className="text-sm text-[#0a0a0a]">{item.value}</span>
                <ChevronDown className="w-4 h-4 text-[#737373]" />
              </div>
            </div>
          ))}
        </div>

        {/* Account Management */}
        <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e5e5]">
            <span className="text-sm font-semibold text-[#0a0a0a]">Account Management</span>
          </div>
          <div className="px-5 py-5 bg-[#FFF5F5]">
            <p className="text-sm text-[#525252]">Temporary deactivate or permanently delete your account</p>
            <button className="text-sm text-[#F44444] font-medium mt-2 hover:text-[#d64d3c] transition-colors flex items-center gap-1">
              Deactivate or Delete Account
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={() => {
            signOut();
            setActiveView("Activities");
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] hover:text-[#0a0a0a] transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
    </main>
  );
}

function AnalyticsView() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white">
      {/* Header */}
      <div className="sticky top-[57px] md:top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <Search className="w-5 h-5 text-[#737373]" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {analyticsTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  i === activeTab
                    ? "bg-[#F44444] text-white"
                    : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-[#fafafa] transition-colors">
              Last 30 days
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <Filter className="w-4 h-4 text-[#737373]" />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 pb-6 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {analyticsStats.map(stat => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#e5e5e5] p-4"
            >
              <p className="text-xs text-[#737373] mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#0a0a0a]">{stat.value}</span>
                  <span className={`text-[11px] font-medium flex items-center gap-0.5 ${stat.up ? "text-[#22c55e]" : "text-[#F44444]"}`}>
                    {stat.up ? "▲" : "▼"} {stat.change}%
                  </span>
                </div>
                <Sparkline
                  data={stat.sparkline}
                  color={stat.up ? "#F44444" : "#a3a3a3"}
                  width={60}
                  height={24}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Chart + Top Posts row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <ViewsChart />

          {/* Top posts */}
          <div className="rounded-xl border border-[#e5e5e5] p-4 sm:w-56 sm:flex-shrink-0">
            <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Top posts</span>
            <div className="space-y-3">
              {topPosts.map(tp => (
                <div key={tp.id} className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={tp.image}
                      alt={tp.title}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#0a0a0a] truncate">{tp.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-[10px] text-[#737373]">
                        <Eye className="w-3 h-3" /> {tp.views}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-[#737373]">
                        <ThumbsUp className="w-3 h-3" /> {tp.likes}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-3 py-1.5 text-xs font-medium text-[#525252] border border-[#e5e5e5] rounded-full hover:bg-[#fafafa] transition-colors">
              View all
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function AnalyticsRightSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 h-screen sticky top-0 overflow-y-auto px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
      {/* Quick snapshot */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[#0a0a0a] mb-4">Quick snapshot</h2>
        <div className="space-y-1">
          {quickSnapshot.map(item => (
            <div
              key={item.label}
              className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#fafafa] transition-colors"
            >
              <span className="text-sm text-[#0a0a0a]">{item.label}</span>
              <span className="text-sm font-medium text-[#0a0a0a]">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <SuggestedProfiles />
    </aside>
  );
}

function SavedView() {
  const [activeTab, setActiveTab] = useState(0);
  const { setSelectedArticle } = useContext(ArticleContext);

  const savedPosts = recentlySavedPostIds
    .map(id => posts.find(p => p.id === id))
    .filter(Boolean) as typeof posts;

  const getFilteredSaved = () => {
    const tab = savedTabs[activeTab];
    switch (tab) {
      case "News":
        return savedPosts.filter(p => p.tags?.includes("News"));
      case "Profiles":
        return [];
      case "Circle posts":
        return savedPosts.filter(p => p.type === "post");
      case "Media":
        return savedPosts.filter(p => "image" in p && p.image);
      case "Others":
        return [];
      default:
        return savedPosts;
    }
  };

  const filtered = getFilteredSaved();

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white">
      {/* Header */}
      <div className="sticky top-[57px] md:top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Saved</h1>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <Search className="w-5 h-5 text-[#737373]" />
            </button>
            <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <Plus className="w-5 h-5 text-[#737373]" />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
          {savedTabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === activeTab
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 pb-6 space-y-6">
        {/* My Collections */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase">My Collections</p>
            <button className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors">View all</button>
          </div>
          <div className="space-y-1">
            {savedCollections.slice(0, 3).map(collection => (
              <div
                key={collection.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={collection.image}
                    alt={collection.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                </div>
                <span className="flex-1 text-sm font-medium text-[#0a0a0a]">{collection.name}</span>
                <span className="text-sm text-[#737373]">{collection.count}</span>
                <button className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
                  <MoreVertical className="w-4 h-4 text-[#737373]" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recently Saved */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">Recently Saved</p>
          <div className="space-y-3">
            {filtered.map(post => {
              const postUser = users.find(u => u.id === post.userId);
              if (!postUser) return null;

              if (post.type === "article") {
                return (
                  <div
                    key={post.id}
                    className="rounded-xl border border-[#e5e5e5] overflow-hidden hover:border-[#d5d5d5] transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {"image" in post && post.image && (
                        <div className="w-full h-40 sm:w-48 sm:h-auto sm:flex-shrink-0">
                          <Image
                            src={post.image}
                            alt={post.title || ""}
                            width={192}
                            height={160}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {post.tags?.map(tag => (
                            <span key={tag} className="text-[11px] text-[#F44444] font-medium">{tag}</span>
                          ))}
                          {post.tags && post.tags.length > 0 && (
                            <span className="text-[11px] text-[#a3a3a3]">{post.date}</span>
                          )}
                          <div className="flex-1" />
                          <button className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
                            <MoreVertical className="w-4 h-4 text-[#737373]" />
                          </button>
                        </div>
                        {"title" in post && (
                          <h3 className="font-semibold text-[#0a0a0a] mb-1 line-clamp-2">{post.title}</h3>
                        )}
                        {"description" in post && (
                          <p className="text-xs text-[#737373] line-clamp-2 mb-3">{post.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full overflow-hidden">
                              <Image
                                src={postUser.avatar}
                                alt={postUser.name}
                                width={20}
                                height={20}
                                className="object-cover w-full h-full"
                              />
                            </div>
                            <span className="text-xs text-[#737373]">{postUser.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                              <Share2 className="w-4 h-4 text-[#737373]" />
                            </button>
                            <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                              <Bookmark className="w-4 h-4 text-[#F44444] fill-[#F44444]" />
                            </button>
                            <button
                              onClick={() => setSelectedArticle(post.id)}
                              className="px-3 py-1.5 bg-[#F44444] text-white text-xs font-medium rounded-full hover:bg-[#d64d3c] transition-colors"
                            >
                              Read Story
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Regular post
              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-[#e5e5e5] p-4 hover:border-[#d5d5d5] transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                      <Image
                        src={postUser.avatar}
                        alt={postUser.name}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-sm text-[#0a0a0a]">{postUser.name}</span>
                        {postUser.verified && <VerifiedBadge className="scale-90" />}
                        <span className="text-[#a3a3a3] text-xs ml-1">{post.date} · {post.time}</span>
                      </div>
                      <span className="text-xs text-[#737373]">{postUser.title}</span>
                    </div>
                    <button className="p-1 hover:bg-[#f5f5f5] rounded transition-colors">
                      <MoreVertical className="w-4 h-4 text-[#737373]" />
                    </button>
                  </div>
                  <p className="text-sm text-[#262626] mb-3">{post.content}</p>
                  {"image" in post && post.image && (
                    <div className="rounded-xl overflow-hidden mb-3">
                      <Image
                        src={post.image}
                        alt="Post"
                        width={800}
                        height={400}
                        className="object-cover w-full"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-[#737373]">
                    <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                      <Bookmark className="w-4 h-4 text-[#F44444] fill-[#F44444]" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-[#737373]">Nothing saved in this category yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function SavedRightSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 h-screen sticky top-0 overflow-y-auto px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
      {/* Quick Folders */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[#0a0a0a] mb-4">Quick Folders</h2>
        <div className="space-y-1">
          {quickFolders.map(folder => (
            <button
              key={folder.name}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#fafafa] transition-colors text-left"
            >
              <span className="text-sm text-[#0a0a0a]">{folder.name}</span>
              <span className="text-sm text-[#737373]">{folder.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Profiles — reuse the existing component */}
      <SuggestedProfiles />
    </aside>
  );
}

function NotificationsView() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifState, setNotifState] = useState(notifications);
  const { following, toggleFollow } = useContext(FollowingContext);

  const markAllRead = () => {
    setNotifState(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const filtered = filter === "unread"
    ? notifState.filter(n => n.unread)
    : notifState;

  const groups = filtered.reduce<Record<string, typeof notifState>>((acc, n) => {
    if (!acc[n.group]) acc[n.group] = [];
    acc[n.group].push(n);
    return acc;
  }, {});

  const groupOrder = ["TODAY", "YESTERDAY", "EARLIER"];

  const getNotifText = (n: typeof notifState[0]) => {
    const user = users.find(u => u.id === n.userId);
    if (!user) return "";
    switch (n.type) {
      case "follow":
        return "started following you";
      case "like":
        return `liked your post`;
      case "like_story":
        return "liked your story";
      case "comment":
        return "commented on your post";
      case "mention":
        return "mentioned you in a post";
      default:
        return "";
    }
  };

  return (
    <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white">
      {/* Header */}
      <div className="sticky top-[57px] md:top-0 bg-white z-30 py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Notifications</h1>
          <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-[#737373]" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === "unread"
                  ? "bg-[#F44444] text-white"
                  : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
              }`}
            >
              Unread
            </button>
          </div>
          <button
            onClick={markAllRead}
            className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="pt-4 pb-6 space-y-6">
        {groupOrder.map(group => {
          const items = groups[group];
          if (!items || items.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-[10px] font-semibold tracking-widest text-[#737373] uppercase mb-3">{group}</p>
              <div className="space-y-1">
                {items.map(notif => {
                  const user = users.find(u => u.id === notif.userId);
                  if (!user) return null;
                  const isFollowingUser = following.has(user.id);
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        notif.unread
                          ? "bg-[#FFF5F5] border border-[#FFD4D4]"
                          : "border border-[#e5e5e5] hover:border-[#d5d5d5]"
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ${
                        user.hasStory
                          ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white"
                          : "ring-1 ring-[#e5e5e5]"
                      }`}>
                        <Image
                          src={user.avatar}
                          alt={user.name}
                          width={44}
                          height={44}
                          className="object-cover w-full h-full"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0a0a0a]">
                          <span className="font-semibold">{user.name}</span>
                          {user.verified && (
                            <span className="inline-flex items-center align-middle ml-1">
                              <VerifiedBadge className="scale-90" />
                            </span>
                          )}
                          <span className="text-[#525252]">{" "}{getNotifText(notif)}</span>
                        </p>
                        {notif.postPreview && notif.type !== "like" && (
                          <p className="text-xs text-[#737373] mt-0.5 truncate">&quot;{notif.postPreview}&quot;</p>
                        )}
                        <span className="text-xs text-[#a3a3a3] mt-0.5 block">{notif.time}</span>
                      </div>

                      {/* Right side: follow button, post thumbnail, or unread dot */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {notif.type === "follow" && (
                          <button
                            onClick={() => toggleFollow(user.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                              isFollowingUser
                                ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb]"
                                : "bg-[#F44444] text-white hover:bg-[#d64d3c]"
                            }`}
                          >
                            {isFollowingUser ? "Following" : "Follow back"}
                          </button>
                        )}
                        {notif.postImage && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden">
                            <Image
                              src={notif.postImage}
                              alt="Post"
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        )}
                        {notif.unread && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#F44444] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#737373] text-sm">No notifications to show.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function RecentStories() {
  const storyUsers = [users[1], users[2], users[3]];
  
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold mb-3 text-[#0a0a0a]">Recent Stories</h2>
      <div className="flex gap-3">
        {storyUsers.map((user) => (
          <div key={user.id} className="flex flex-col items-center gap-1.5">
            <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#F44444] ring-offset-2 ring-offset-white">
              <Image
                src={user.avatar}
                alt={user.name}
                width={56}
                height={56}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-xs text-[#525252] truncate max-w-14">{user.name.split(" ")[0]}</span>
              <VerifiedBadge className="scale-75" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestedProfiles() {
  const suggestions = users.slice(3);
  const { following, toggleFollow } = useContext(FollowingContext);
  
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[#0a0a0a]">Suggested Profiles</h2>
        <button className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors">View all</button>
      </div>
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {suggestions.map((user) => {
          const isFollowing = following.has(user.id);
          return (
            <div key={user.id} className="flex items-center gap-2.5 p-3">
              <div className={`w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ${
                user.hasStory 
                  ? "ring-2 ring-[#F44444] ring-offset-2 ring-offset-white" 
                  : "ring-1 ring-[#e5e5e5]"
              }`}>
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={44}
                  height={44}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm truncate text-[#0a0a0a]">{user.name}</span>
                  <VerifiedBadge className="scale-90" />
                </div>
                <span className="text-xs text-[#737373] truncate block">{user.title}</span>
              </div>
              <button 
                onClick={() => toggleFollow(user.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ease-out flex-shrink-0 ${
                  isFollowing 
                    ? "bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:bg-[#ebebeb] hover:border-[#d5d5d5] scale-100" 
                    : "bg-[#F44444] text-white border border-transparent hover:bg-[#d64d3c] scale-100"
                } active:scale-95`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdCard() {
  return (
    <div className="rounded-2xl overflow-hidden relative flex-1">
      <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/50 rounded text-xs text-white z-10">
        Ad
      </div>
      <Image
        src="https://picsum.photos/seed/ad-startup/400/600"
        alt="Advertisement"
        width={400}
        height={600}
        className="object-cover w-full h-full"
      />
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-[#F44444] font-semibold text-lg">inito</span>
        <p className="text-sm text-white mt-1">
          At-home diagnostics startup Inito raises $29 million from BII, Fireside Ventures
        </p>
      </div>
    </div>
  );
}

function RightSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-80 h-screen sticky top-0 overflow-y-auto px-4 xl:px-6 py-6 border-l border-[#e5e5e5] bg-white">
      <RecentStories />
      <SuggestedProfiles />
      <div className="flex-1 flex flex-col min-h-0">
        <AdCard />
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const { setIsOpen: setPostOpen } = useContext(CreatePostContext);
  const { setIsOpen: setStoryOpen } = useContext(CreateStoryContext);
  const { activeView, setActiveView } = useContext(NavContext);
  const { userRole } = useContext(AuthContext);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreateMenu) return;
    function handleTap(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap);
    return () => {
      document.removeEventListener("mousedown", handleTap);
      document.removeEventListener("touchstart", handleTap);
    };
  }, [showCreateMenu]);

  const isCircle = userRole === "CIRCLE";
  const mobileNavItems = [
    { icon: Activity, label: "Feed", view: "Activities" },
    { icon: Search, label: "Explore", view: "Explore" },
    ...(isCircle ? [{ icon: Plus, label: "Create", accent: true }] : []),
    ...(isCircle ? [{ icon: Mail, label: "Messages", view: "Messages" }] : [{ icon: Bookmark, label: "Saved", view: "Saved" }]),
    ...(isCircle ? [{ icon: User, label: "Profile", href: "/profile" }] : [{ icon: Users, label: "Circle", view: "Circle" }]),
  ];
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5e5] px-4 py-2 z-40">
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = item.view ? activeView === item.view : false;
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center gap-1 p-2 transition-all duration-200 text-[#737373]"
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          ) : (
            <div key={item.label} className="relative">
              {item.accent && (
                <AnimatePresence>
                  {showCreateMenu && (
                    <div ref={menuRef}>
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ type: "spring", duration: 0.15, bounce: 0.15 }}
                        className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#f0f0f0] overflow-hidden min-w-[140px]"
                      >
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            setPostOpen(true);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                        >
                          <PenLine className="w-[18px] h-[18px] text-[#737373]" />
                          <span className="text-sm font-medium">Post</span>
                        </button>
                        {isCircle && (
                          <>
                            <div className="h-px bg-[#f0f0f0]" />
                            <button
                              onClick={() => {
                                setShowCreateMenu(false);
                                setStoryOpen(true);
                              }}
                              className="flex items-center gap-3 w-full px-4 py-3 text-[#0a0a0a] hover:bg-[#fafafa] transition-colors cursor-pointer"
                            >
                              <CircleDashed className="w-[18px] h-[18px] text-[#737373]" />
                              <span className="text-sm font-medium">Story</span>
                            </button>
                          </>
                        )}
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              )}
              <button
                onClick={
                  item.accent
                    ? () => setShowCreateMenu(prev => !prev)
                    : item.view
                    ? () => setActiveView(item.view!)
                    : undefined
                }
                className={`flex flex-col items-center gap-1 p-2 transition-all duration-200 ${
                  item.accent
                    ? "bg-[#F44444] rounded-full p-3 -mt-4 shadow-lg"
                    : isActive
                    ? "text-[#F44444]"
                    : "text-[#737373]"
                }`}
              >
                <item.icon className={`w-5 h-5 ${item.accent ? "text-white" : ""}`} />
                {!item.accent && <span className="text-xs">{item.label}</span>}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function SignInModal({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const account = demoAccounts.find(a => a.email === email && a.password === password);
    if (account) {
      signIn(account.role as "CIRCLE" | "NORMAL");
      onClose();
    } else {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        <div className="px-8 pt-8 pb-6">
          <div className="flex justify-center mb-6">
            <AlbizLogo size={48} />
          </div>
          <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Welcome back</h2>
          <p className="text-sm text-[#737373] text-center mb-6">Sign in to your Albiz account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 focus:border-[#F44444]/40 transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 focus:border-[#F44444]/40 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[#F44444] text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
            >
              Sign in
            </button>
          </form>
          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-[#e5e5e5]"></div>
            <span className="px-3 text-xs text-[#a3a3a3] font-medium">OR</span>
            <div className="flex-1 h-px bg-[#e5e5e5]"></div>
          </div>
          <button type="button" onClick={() => {}} className="w-full py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors cursor-pointer flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => { setEmail("jessinsam@demo.albiz.com"); setPassword("demo123"); }}
              className="w-full px-4 py-3 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] hover:border-[#F44444]/40 hover:bg-[#FFF8F8] transition-all cursor-pointer text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-[#737373]">Circle user</p>
                <span className="text-[10px] font-medium text-[#F44444] bg-[#FFF0F0] px-1.5 py-0.5 rounded">CIRCLE</span>
              </div>
              <p className="text-xs text-[#0a0a0a] font-medium">jessinsam@demo.albiz.com</p>
              <p className="text-xs text-[#737373]">Password: demo123</p>
            </button>
            <button
              type="button"
              onClick={() => { setEmail("priyasharma@demo.albiz.com"); setPassword("demo123"); }}
              className="w-full px-4 py-3 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] hover:border-[#525252]/30 hover:bg-[#fafafa] transition-all cursor-pointer text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-[#737373]">Normal user</p>
                <span className="text-[10px] font-medium text-[#525252] bg-[#f0f0f0] px-1.5 py-0.5 rounded">NORMAL</span>
              </div>
              <p className="text-xs text-[#0a0a0a] font-medium">priyasharma@demo.albiz.com</p>
              <p className="text-xs text-[#737373]">Password: demo123</p>
            </button>
          </div>
        </div>

        <div className="px-8 py-4 bg-[#fafafa] border-t border-[#e5e5e5] text-center">
          <span className="text-sm text-[#737373]">Don&apos;t have an account? </span>
          <button onClick={onSwitch} className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors cursor-pointer">
            Sign up
          </button>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#737373]" />
        </button>
      </div>
    </div>
  );
}

function SignUpModal({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signIn } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    // Demo: sign up creates a normal user
    signIn("NORMAL");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        <div className="px-8 pt-8 pb-6">
          <div className="flex justify-center mb-6">
            <AlbizLogo size={48} />
          </div>
          <h2 className="text-xl font-bold text-center text-[#0a0a0a] mb-1">Create your account</h2>
          <p className="text-sm text-[#737373] text-center mb-6">Join the Albiz community</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 focus:border-[#F44444]/40 transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 focus:border-[#F44444]/40 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 focus:border-[#F44444]/40 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[#F44444] text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
            >
              Create account
            </button>
          </form>
          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-[#e5e5e5]"></div>
            <span className="px-3 text-xs text-[#a3a3a3] font-medium">OR</span>
            <div className="flex-1 h-px bg-[#e5e5e5]"></div>
          </div>
          <button type="button" onClick={() => {}} className="w-full py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors cursor-pointer flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <p className="text-[11px] text-[#a3a3a3] text-center mt-4">
            By signing up, you agree to our Terms and Privacy Policy.
          </p>
        </div>

        <div className="px-8 py-4 bg-[#fafafa] border-t border-[#e5e5e5] text-center">
          <span className="text-sm text-[#737373]">Already have an account? </span>
          <button onClick={onSwitch} className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors cursor-pointer">
            Sign in
          </button>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#737373]" />
        </button>
      </div>
    </div>
  );
}

export function TemplatePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [userRole, setUserRole] = useState<"CIRCLE" | "NORMAL" | null>("CIRCLE");
  const [authModal, setAuthModal] = useState<"signin" | "signup" | null>(null);
  // Initialize with some users already followed (Open AI and Nikhil Kamath)
  const [following, setFollowing] = useState<Set<number>>(new Set([2, 3]));
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);
  const [createPostOpen, setCreatePostOpen] = useState(() => {
    if (typeof window !== "undefined") return new URLSearchParams(window.location.search).get("action") === "post";
    return false;
  });
  const [createStoryOpen, setCreateStoryOpen] = useState(() => {
    if (typeof window !== "undefined") return new URLSearchParams(window.location.search).get("action") === "story";
    return false;
  });
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("view") || "Activities";
    }
    return "Activities";
  });
  
  const toggleFollow = (userId: number) => {
    setFollowing(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSetActiveView = (view: string) => {
    setActiveView(view);
    setSelectedArticle(null);
  };
  
  const renderCenterContent = () => {
    if (selectedArticle) return <ArticleDetailView postId={selectedArticle} />;
    if (activeView === "Explore") return <ExploreView />;
    if (activeView === "Circle") return <CircleView />;
    if (activeView === "Notifications") return <NotificationsView />;
    if (activeView === "Messages") return <MessagesView />;
    if (activeView === "Saved") return <SavedView />;
    if (activeView === "Analytics") return <AnalyticsView />;
    if (activeView === "Settings") return <SettingsView />;
    return <CenterFeed />;
  };

  const authValue = {
    isSignedIn,
    userRole,
    signOut: () => { setIsSignedIn(false); setUserRole(null); },
    signIn: (role: "CIRCLE" | "NORMAL" = "CIRCLE") => { setIsSignedIn(true); setUserRole(role); },
    openAuthModal: (mode: "signin" | "signup") => setAuthModal(mode),
  };

  return (
    <AuthContext.Provider value={authValue}>
      <FollowingContext.Provider value={{ following, toggleFollow }}>
        <ArticleContext.Provider value={{ selectedArticle, setSelectedArticle }}>
          <CreatePostContext.Provider value={{ isOpen: createPostOpen, setIsOpen: setCreatePostOpen }}>
            <CreateStoryContext.Provider value={{ isOpen: createStoryOpen, setIsOpen: setCreateStoryOpen }}>
              <NavContext.Provider value={{ activeView, setActiveView: handleSetActiveView }}>
                <div className="min-h-screen pb-16 md:pb-0 md:px-4 lg:px-8 xl:px-16 bg-white">
                  <MobileHeader isMenuOpen={mobileMenuOpen} onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
                  <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
                  <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row">
                    <LeftSidebar />
                    {renderCenterContent()}
                    {activeView === "Saved" ? <SavedRightSidebar /> : (activeView === "Analytics" || activeView === "Settings") ? <AnalyticsRightSidebar /> : activeView !== "Messages" && <RightSidebar />}
                  </div>
                  <MobileBottomNav />
                  <CreatePostModal />
                  <CreateStoryModal />
                  {authModal === "signin" && (
                    <SignInModal
                      onClose={() => setAuthModal(null)}
                      onSwitch={() => setAuthModal("signup")}
                    />
                  )}
                  {authModal === "signup" && (
                    <SignUpModal
                      onClose={() => setAuthModal(null)}
                      onSwitch={() => setAuthModal("signin")}
                    />
                  )}
                </div>
              </NavContext.Provider>
            </CreateStoryContext.Provider>
          </CreatePostContext.Provider>
        </ArticleContext.Provider>
      </FollowingContext.Provider>
    </AuthContext.Provider>
  );
}
