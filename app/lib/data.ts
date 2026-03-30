import {
  Activity, Search, Users, Bell, Mail, Bookmark, BarChart3, Settings, User, Play,
} from "lucide-react";

// ─── Demo Accounts ───
export const demoAccounts = [
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
  { id: 13, email: "support@tecnots.com", password: "C0mplex@#408", name: "Albiz Admin", role: "ADMIN" },
  { id: 14, email: "author@demo.albiz.com", password: "demo123", name: "Maya Johnson", role: "AUTHOR" },
];

// ─── Users ───
export const generateUsers = () => [
  { id: 1, name: "Jessin Sam S", handle: "jessinsam", title: "Founder @ Example.com", avatar: "/Jess-profile.jpg", verified: true, isPremium: true, hasStory: true, role: "CIRCLE" as const, followers: "150k" },
  { id: 2, name: "Open AI", handle: "openai", title: "ChatGPT Creators", avatar: "https://picsum.photos/seed/openai/200", verified: true, hasStory: true, role: "CIRCLE" as const, followers: "2.8M" },
  { id: 3, name: "Nikhil Kamath", handle: "nikhilkamath", title: "Investor & Entrepreneur", avatar: "https://picsum.photos/seed/nikhil/200", verified: true, hasStory: true, role: "CIRCLE" as const, followers: "890k" },
  { id: 4, name: "Elon Musk", handle: "elonmusk", title: "CEO @ Tesla, SpaceX", avatar: "https://picsum.photos/seed/elon/200", verified: true, hasStory: true, role: "CIRCLE" as const, followers: "5.2M" },
  { id: 5, name: "Donald J. Trump", handle: "realdonaldtrump", title: "US President 2026", avatar: "https://picsum.photos/seed/trump/200", verified: true, role: "NORMAL" as const, followers: "4.1M" },
  { id: 6, name: "Y Combinator", handle: "ycombinator", title: "Help founders make something...", avatar: "https://picsum.photos/seed/yc/200", verified: true, hasStory: true, role: "CIRCLE" as const, followers: "1.1M" },
  { id: 7, name: "Satya Nadella", handle: "satyanadella", title: "Chairman and CEO at Microsoft", avatar: "https://picsum.photos/seed/satya/200", verified: true, role: "CIRCLE" as const, followers: "3.4M" },
  { id: 8, name: "Aadit Palicha", handle: "aaditpalicha", title: "Co-founder/CEO @ZeptoNow", avatar: "https://picsum.photos/seed/aadit/200", verified: true, hasStory: true, role: "CIRCLE" as const, followers: "420k" },
  { id: 13, name: "Albiz Admin", handle: "albizadmin", title: "Platform Administrator", avatar: "https://picsum.photos/seed/admin-albiz/200", verified: true, role: "ADMIN" as const, followers: "0" },
  { id: 14, name: "Maya Johnson", handle: "mayajohnson", title: "Invited Author & Tech Writer", avatar: "https://picsum.photos/seed/maya-author/200", verified: true, hasStory: true, role: "AUTHOR" as const, followers: "12k" },
];

export const users = generateUsers();

// ─── Posts ───
export const generatePosts = () => [
  { id: 1, userId: 2, type: "post" as const, content: "Happy to share that Example.com has secured $10M from the top investors. Thank you all for being a part of it.", date: "Dec 12th 2025", time: "1:56 PM", image: "https://picsum.photos/seed/funding-announce/800/500", tags: ["Business", "Startups"], stats: { views: "1k", likes: "1k", comments: "1k", shares: "1k" } },
  { id: 2, userId: 1, type: "article" as const, title: "Donald Trump reminds the entire world he has no idea what 6G means", description: "When business leaders spout buzzwords like \"AI,\" \"8K\" and \"5G,\" sometimes in the same sentence, we often get a sneaking suspicion they don't know what they mean!", tags: ["News", "Policy", "Tech"], date: "Dec 12th 2025", image: "https://picsum.photos/seed/trump-article/400/300", stats: { views: "2.3k", likes: "1.2k", comments: "342", shares: "89" } },
  { id: 3, userId: 2, type: "article" as const, title: "OpenAI announces GPT-5: The most capable AI model yet", description: "The new model shows unprecedented reasoning capabilities and can now handle complex multi-step tasks with human-like accuracy.", tags: ["AI", "Technology", "News"], date: "Dec 12th 2025", image: "https://picsum.photos/seed/gpt5-announce/400/300", stats: { views: "45k", likes: "32k", comments: "5.2k", shares: "12k" } },
  { id: 4, userId: 3, type: "post" as const, content: "The best time to start investing was yesterday. The second best time is today. Start small, stay consistent.", date: "Dec 11th 2025", time: "10:30 AM", tags: ["Finance", "Investing"], stats: { views: "5.2k", likes: "2.1k", comments: "456", shares: "234" } },
  { id: 5, userId: 4, type: "article" as const, title: "SpaceX Starship completes first successful orbital flight", description: "After years of development and testing, SpaceX has achieved a major milestone in space exploration.", tags: ["Technology", "Space", "News"], date: "Dec 10th 2025", image: "https://picsum.photos/seed/spacex/400/300", stats: { views: "12k", likes: "8.5k", comments: "1.2k", shares: "3.4k" } },
  { id: 6, userId: 6, type: "post" as const, content: "Applications for YC Winter 2026 batch are now open. Apply now at ycombinator.com/apply", date: "Dec 9th 2025", time: "2:00 PM", tags: ["Startups", "Business"], stats: { views: "8.3k", likes: "3.2k", comments: "892", shares: "1.5k" } },
  { id: 7, userId: 7, type: "article" as const, title: "Microsoft unveils next-gen AI chips to compete with Nvidia", description: "The tech giant is betting big on custom silicon to power its Azure AI infrastructure and reduce dependency on third-party hardware.", tags: ["Technology", "AI", "Business"], date: "Dec 8th 2025", image: "https://picsum.photos/seed/ms-chips/400/300", stats: { views: "15k", likes: "6.7k", comments: "1.1k", shares: "2.3k" } },
  { id: 8, userId: 8, type: "article" as const, title: "Zepto becomes India's fastest unicorn with $5B valuation", description: "The quick commerce startup has disrupted the grocery delivery market with 10-minute deliveries across major Indian cities.", tags: ["News", "Business", "Startups"], date: "Dec 7th 2025", image: "https://picsum.photos/seed/zepto-unicorn/400/300", stats: { views: "22k", likes: "11k", comments: "2.3k", shares: "4.1k" } },
  { id: 9, userId: 4, type: "article" as const, title: "Tesla's Optimus robot begins factory trials", description: "The humanoid robot is now performing basic assembly tasks at Tesla's Fremont factory, marking a new era in manufacturing automation.", tags: ["Technology", "AI", "News"], date: "Dec 6th 2025", image: "https://picsum.photos/seed/optimus-robot/400/300", stats: { views: "35k", likes: "18k", comments: "3.2k", shares: "8.5k" } },
  { id: 10, userId: 2, type: "article" as const, title: "Claude 4 sets new benchmarks in AI safety research", description: "Anthropic's latest model demonstrates unprecedented ability to refuse harmful requests while maintaining helpfulness.", tags: ["AI", "Technology", "News"], date: "Dec 5th 2025", image: "https://picsum.photos/seed/claude4-safety/400/300", stats: { views: "28k", likes: "15k", comments: "2.8k", shares: "6.2k" } },
  { id: 11, userId: 5, type: "article" as const, title: "US announces new semiconductor export restrictions", description: "The Biden administration expands chip export controls to additional countries, impacting global tech supply chains.", tags: ["News", "Policy", "Technology"], date: "Dec 4th 2025", image: "https://picsum.photos/seed/chip-policy/400/300", stats: { views: "18k", likes: "4.2k", comments: "2.1k", shares: "3.8k" } },
  { id: 12, userId: 3, type: "article" as const, title: "Indian stock market hits all-time high amid foreign investment surge", description: "Sensex crosses 85,000 for the first time as global investors pour billions into Indian equities.", tags: ["News", "Finance", "Business"], date: "Dec 3rd 2025", image: "https://picsum.photos/seed/sensex-high/400/300", stats: { views: "42k", likes: "21k", comments: "4.5k", shares: "9.2k" } },
];

export const posts = generatePosts();

// ─── Tabs ───
export const filterTabs = ["For You", "Following", "Trending", "News", "AI", "Technology"];
export const exploreTabs = ["For You", "Trending", "Circle", "News", "Founders", "Companies"];
export const exploreSubTabs = ["Top", "Latest", "People", "Companies"];
export const circleTabs = ["For You", "Following", "My Circle", "Explore", "Suggested", "Founders", "Companies"];
export const messageTabs = ["All", "Unread", "Instagram", "Messenger", "Facebook", "LinkedIn"];
export const savedTabs = ["All", "News", "Profiles", "Circle posts", "Media", "Others"];
export const analyticsTabs = ["Overview", "Posts", "Profile"];
export const settingsTabs = ["Account", "Personalization", "Profile & Circle", "Privacy & Safety", "Connected Accounts", "Notifications", "Billing", "Security"];

// ─── Trending Topics ───
export const trendingTopics = [
  { id: 1, name: "AI & SaaS", posts: "2.1k posts this week", image: "https://picsum.photos/seed/ai-saas/200/200" },
  { id: 2, name: "UAE Startup", posts: "1.8k posts", image: "https://picsum.photos/seed/uae-startup/200/200" },
  { id: 3, name: "Fintech", posts: "1k posts", image: "https://picsum.photos/seed/fintech-topic/200/200" },
  { id: 4, name: "Web3", posts: "890 posts", image: "https://picsum.photos/seed/web3-topic/200/200" },
  { id: 5, name: "Climate Tech", posts: "670 posts", image: "https://picsum.photos/seed/climate-tech/200/200" },
];

// ─── Circle Members ───
export const generateCircleMembers = () => {
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
  return names.map((person, i) => ({ id: 100 + i, ...person, verified: true, rank: i + 1 }));
};

export const circleMembers = generateCircleMembers();

export const circlePosts = [
  { memberId: 100, content: "Just closed a $200M fund focused on deep tech and climate. The next decade belongs to founders solving hard problems.", image: "https://picsum.photos/seed/nikhil-post/800/400", stats: { likes: "4.2k", comments: "312" } },
  { memberId: 102, content: "AI is going to redefine every industry. At Microsoft, we're building the infrastructure to make that happen responsibly.", stats: { likes: "18k", comments: "2.1k" } },
  { memberId: 103, content: "The next generation of AI won't just answer questions — it will reason, plan, and act. GPT-5 is a step in that direction.", image: "https://picsum.photos/seed/sam-post/800/400", stats: { likes: "32k", comments: "5.8k" } },
  { memberId: 105, content: "Search is being completely reimagined. What we're building at Google is going to change how people interact with information forever.", stats: { likes: "12k", comments: "1.4k" } },
  { memberId: 107, content: "Software is eating the world, but AI is eating software. Every company needs to figure out their AI strategy now, not next year.", image: "https://picsum.photos/seed/marc-post/800/400", stats: { likes: "8.5k", comments: "923" } },
  { memberId: 110, content: "The future of hospitality is personal. We're investing heavily in AI-powered experiences that make every trip unique.", stats: { likes: "6.1k", comments: "445" } },
  { memberId: 113, content: "Constitutional AI is not just a technique — it's a philosophy. Building safe AI systems requires rethinking how we train models from the ground up.", image: "https://picsum.photos/seed/dario-post/800/400", stats: { likes: "15k", comments: "1.8k" } },
  { memberId: 115, content: "Commerce is going through its biggest transformation since the internet. Shopify merchants processed $1B in a single day last quarter.", stats: { likes: "9.3k", comments: "678" } },
];

// ─── Notifications ───
export const notifications = [
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

// ─── Conversations ───
export const conversations = [
  { id: 1, userId: 3, lastMessage: "Let's discuss the term sheet......", time: "3:14 PM", unreadCount: 2, online: true, messages: [
    { id: 1, fromMe: false, text: "Hey Jessin, great seeing you at the summit yesterday.", time: "2:45 PM" },
    { id: 2, fromMe: true, text: "Thanks Nikhil! It was a pleasure to meet you.", time: "2:48 PM" },
    { id: 3, fromMe: false, text: "I've been looking at Example.com and I think there's a huge opportunity here.", time: "3:01 PM" },
    { id: 4, fromMe: true, text: "That means a lot coming from you. We're growing 40% month over month.", time: "3:05 PM" },
    { id: 5, fromMe: false, text: "Impressive. I'd love to chat about a potential investment.", time: "3:10 PM" },
    { id: 6, fromMe: false, text: "Let's discuss the term sheet......", time: "3:14 PM" },
  ]},
  { id: 2, userId: 7, lastMessage: "Hai Jessin!", time: "Yesterday", unreadCount: 0, online: false, messages: [
    { id: 1, fromMe: false, text: "Hi Jessin, congratulations on the funding round!", time: "10:30 AM" },
    { id: 2, fromMe: true, text: "Thank you Satya! Really appreciate the kind words.", time: "11:15 AM" },
    { id: 3, fromMe: false, text: "Have you considered integrating with Azure for your infrastructure?", time: "11:45 AM" },
    { id: 4, fromMe: true, text: "We're actually evaluating cloud partners right now. Would love to learn more.", time: "12:30 PM" },
    { id: 5, fromMe: false, text: "Hai Jessin!", time: "3:00 PM" },
  ]},
  { id: 3, userId: 4, lastMessage: "Mars colony needs a social network too", time: "2d ago", unreadCount: 0, online: true, messages: [
    { id: 1, fromMe: false, text: "Your platform is interesting. Different from what's out there.", time: "9:00 AM" },
    { id: 2, fromMe: true, text: "Thanks Elon! We're focused on meaningful business connections.", time: "9:30 AM" },
    { id: 3, fromMe: false, text: "Mars colony needs a social network too", time: "10:00 AM" },
  ]},
  { id: 4, userId: 2, lastMessage: "We'd love to feature Example.com as a case study.", time: "3d ago", unreadCount: 0, online: true, messages: [
    { id: 1, fromMe: false, text: "Hi Jessin! We noticed Example.com is using our API extensively.", time: "2:00 PM" },
    { id: 2, fromMe: true, text: "Yes, GPT powers our content recommendations. It's been great.", time: "2:30 PM" },
    { id: 3, fromMe: false, text: "We'd love to feature Example.com as a case study.", time: "3:00 PM" },
  ]},
  { id: 5, userId: 8, lastMessage: "Quick commerce and social media — there's a play here.", time: "5d ago", unreadCount: 0, online: false, messages: [
    { id: 1, fromMe: true, text: "Hey Aadit, congrats on the unicorn milestone!", time: "11:00 AM" },
    { id: 2, fromMe: false, text: "Thanks Jessin! It's been a wild ride.", time: "11:30 AM" },
    { id: 3, fromMe: false, text: "Quick commerce and social media — there's a play here.", time: "11:45 AM" },
  ]},
  { id: 6, userId: 6, lastMessage: "Your application for the next batch is strong.", time: "1w ago", unreadCount: 0, online: false, messages: [
    { id: 1, fromMe: false, text: "Hi Jessin, thanks for applying to YC.", time: "4:00 PM" },
    { id: 2, fromMe: true, text: "Thank you for considering us!", time: "4:15 PM" },
    { id: 3, fromMe: false, text: "Your application for the next batch is strong.", time: "4:30 PM" },
  ]},
];

// ─── Saved ───
export const savedCollections = [
  { id: 1, name: "Technology", count: 10, image: "https://picsum.photos/seed/coll-tech/100" },
  { id: 2, name: "AI", count: 5, image: "https://picsum.photos/seed/coll-ai/100" },
  { id: 3, name: "Finance", count: 12, image: "https://picsum.photos/seed/coll-finance/100" },
  { id: 4, name: "Startups", count: 8, image: "https://picsum.photos/seed/coll-startups/100" },
  { id: 5, name: "News", count: 15, image: "https://picsum.photos/seed/coll-news/100" },
];

export const quickFolders = [
  { name: "Technology", count: 10 },
  { name: "Finance", count: 12 },
  { name: "AI", count: 5 },
  { name: "Fintech", count: 18 },
  { name: "Important news", count: 2 },
];

export const recentlySavedPostIds = [2, 1, 3, 5, 7, 8];

// ─── Analytics ───
export const analyticsStats = [
  { label: "Total view", value: "45,210", change: 12.4, up: true, sparkline: [20, 35, 28, 45, 38, 55, 48, 62, 58, 72, 65, 78] },
  { label: "Profile visits", value: "1,284", change: 3.2, up: false, sparkline: [50, 48, 45, 47, 42, 40, 38, 41, 36, 35, 37, 34] },
  { label: "Circle actions", value: "432", change: 24.1, up: true, sparkline: [15, 22, 18, 30, 25, 38, 32, 45, 42, 55, 50, 62] },
];

export const viewsOverTime = [
  { date: "01 OCT", value: 120 }, { date: "04 OCT", value: 280 }, { date: "08 OCT", value: 180 },
  { date: "11 OCT", value: 350 }, { date: "15 OCT", value: 220 }, { date: "18 OCT", value: 420 },
  { date: "22 OCT", value: 310 }, { date: "25 OCT", value: 520 }, { date: "28 OCT", value: 480 },
  { date: "30 OCT", value: 680 },
];

export const topPosts = [
  { id: 1, title: "Building the...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post1/100" },
  { id: 2, title: "10 Tips for...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post2/100" },
  { id: 3, title: "Why Founders...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post3/100" },
  { id: 4, title: "Why Founders...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post4/100" },
];

export const quickSnapshot = [
  { label: "Views today", value: "1,402" },
  { label: "New followers", value: "+25" },
  { label: "Circle requests", value: "5" },
  { label: "Engagement rate", value: "24%" },
];

// ─── Settings ───
export const accountInfo = [
  { label: "Email", value: "jessin@tecnots.com" },
  { label: "Username", value: "jessinsam" },
  { label: "Phone", value: "+91 7902839978" },
];

export const languageRegion = [
  { label: "Language", value: "English (US)" },
  { label: "Time Zone", value: "(GMT-08:00) Pacific Time" },
  { label: "Currency", value: "USD ($)" },
];

// ─── Custom Domain ───
export const domainConfig = {
  mainDomain: "albizmedia.com",
  cnameTarget: "cname.albizmedia.com",
  dnsInstructions: [
    { type: "CNAME", host: "@", value: "cname.albizmedia.com", ttl: "3600" },
    { type: "TXT", host: "@", value: "albiz-verify=", ttl: "3600" },
  ],
};

// ─── Nav Items ───
export const navItems = [
  { icon: Activity, label: "Activities", href: "/" },
  { icon: Search, label: "Explore", href: "/explore" },
  { icon: Play, label: "Shorts", href: "/shorts" },
  { icon: Users, label: "Circle", href: "/circle" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Mail, label: "Messages", href: "/messages" },
  { icon: Bookmark, label: "Saved", href: "/saved" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: User, label: "Profile", href: "/profile" },
];

// ─── News Authors (Journalists invited via admin panel) ───
export const newsAuthors = [
  {
    id: 1, name: "Sarah Mitchell", handle: "sarahmitchell", email: "sarah.mitchell@techjournal.com",
    avatar: "https://picsum.photos/seed/author-sarah/200", coverPhoto: "https://picsum.photos/seed/cover-sarah/1200/400",
    role: "Senior Journalist", org: "Tech Journal", status: "active" as const,
    bio: "Technology and AI reporter with 8 years of experience covering Silicon Valley. Previously at TechCrunch and The Information.",
    location: "San Francisco, CA",
    socials: { twitter: "sarahmitchell", linkedin: "sarahmitchelltech", website: "sarahmitchell.com" },
    articles: 12, published: 9, joinedDate: "Jan 15, 2026", followers: "45k",
  },
  {
    id: 2, name: "Arun Mehta", handle: "arunmehta", email: "arun@startupdigest.in",
    avatar: "https://picsum.photos/seed/author-arun/200", coverPhoto: "https://picsum.photos/seed/cover-arun/1200/400",
    role: "Contributing Writer", org: "Startup Digest", status: "active" as const,
    bio: "Covers Indian startup ecosystem and venture capital. Author of 'The Bangalore Blueprint'. Forbes India columnist.",
    location: "Bangalore, India",
    socials: { twitter: "arunmehta_in", linkedin: "arunmehtawriter", website: "startupdigest.in/arun" },
    articles: 8, published: 6, joinedDate: "Jan 22, 2026", followers: "28k",
  },
  {
    id: 3, name: "Emily Zhang", handle: "emilyzhang", email: "emily.z@bloomberg.com",
    avatar: "https://picsum.photos/seed/author-emily/200", coverPhoto: "https://picsum.photos/seed/cover-emily/1200/400",
    role: "Correspondent", org: "Bloomberg", status: "active" as const,
    bio: "Financial markets and fintech specialist at Bloomberg. Covering global finance, crypto regulation, and emerging market trends.",
    location: "New York, NY",
    socials: { twitter: "emilyzhangbloom", linkedin: "emilyzhangfinance", website: "bloomberg.com/authors/emily-zhang" },
    articles: 15, published: 14, joinedDate: "Dec 5, 2025", followers: "92k",
  },
  {
    id: 4, name: "James O'Brien", handle: "jamesobrien", email: "james@wired.com",
    avatar: "https://picsum.photos/seed/author-james/200", coverPhoto: "https://picsum.photos/seed/cover-james/1200/400",
    role: "Tech Editor", org: "Wired", status: "active" as const,
    bio: "Deep dives into AI, robotics, and emerging tech. Senior editor at Wired. Previously at Ars Technica and MIT Technology Review.",
    location: "London, UK",
    socials: { twitter: "jamesobrien_tech", linkedin: "jamesobrienwriter", website: "wired.com/author/james-obrien" },
    articles: 6, published: 4, joinedDate: "Feb 1, 2026", followers: "67k",
  },
];

// ─── News Articles (written by invited authors) ───
export const generateNewsArticles = () => [
  {
    id: 101, authorId: 1, type: "article" as const,
    title: "How India's UPI is reshaping global payments",
    description: "From a domestic payment system to a global standard — how India's Unified Payments Interface is being adopted by countries worldwide.",
    date: "Feb 28th 2026", image: "https://picsum.photos/seed/news-upi/800/500",
    tags: ["Fintech", "Business", "Technology"],
    stats: { views: "18k", likes: "8.2k", comments: "1.4k", shares: "3.1k" },
  },
  {
    id: 102, authorId: 4, type: "article" as const,
    title: "The silent revolution in AI chip design",
    description: "Custom silicon is changing the economics of artificial intelligence. Here's how startups are challenging Nvidia's dominance.",
    date: "Feb 27th 2026", image: "https://picsum.photos/seed/news-aichip/800/500",
    tags: ["AI", "Technology", "Business"],
    stats: { views: "32k", likes: "14k", comments: "2.8k", shares: "5.6k" },
  },
  {
    id: 103, authorId: 3, type: "article" as const,
    title: "European regulators take aim at big tech",
    description: "The EU's Digital Markets Act is forcing tech giants to open their platforms. What this means for innovation and competition.",
    date: "Feb 26th 2026", image: "https://picsum.photos/seed/news-eureg/800/500",
    tags: ["Policy", "Technology", "News"],
    stats: { views: "24k", likes: "6.5k", comments: "3.2k", shares: "4.8k" },
  },
  {
    id: 104, authorId: 1, type: "article" as const,
    title: "Startup funding winter: Is the worst over?",
    description: "After 18 months of declining venture investment, early signs suggest the market is thawing. But the recovery won't look like the boom.",
    date: "Feb 25th 2026", image: "https://picsum.photos/seed/news-funding/800/500",
    tags: ["Startups", "Finance", "Business"],
    stats: { views: "42k", likes: "19k", comments: "4.1k", shares: "7.2k" },
  },
  {
    id: 105, authorId: 2, type: "article" as const,
    title: "Zepto, Blinkit, and the future of quick commerce in India",
    description: "India's 10-minute delivery wars are reshaping retail. A deep dive into the economics, logistics, and what comes next.",
    date: "Feb 24th 2026", image: "https://picsum.photos/seed/news-qcommerce/800/500",
    tags: ["Business", "Startups", "News"],
    stats: { views: "56k", likes: "28k", comments: "5.8k", shares: "9.4k" },
  },
  {
    id: 106, authorId: 3, type: "article" as const,
    title: "Climate tech investment hits record high in 2025",
    description: "Global investment in climate technology reached $120 billion last year, driven by battery innovation and carbon capture breakthroughs.",
    date: "Feb 23rd 2026", image: "https://picsum.photos/seed/news-climate/800/500",
    tags: ["Finance", "Technology", "News"],
    stats: { views: "15k", likes: "7.8k", comments: "1.2k", shares: "3.5k" },
  },
  {
    id: 107, authorId: 4, type: "article" as const,
    title: "The rise of sovereign AI strategies",
    description: "From the US to Saudi Arabia, nations are racing to build their own AI capabilities. Inside the geopolitics of artificial intelligence.",
    date: "Feb 22nd 2026", image: "https://picsum.photos/seed/news-sovereignai/800/500",
    tags: ["AI", "Policy", "Technology"],
    stats: { views: "38k", likes: "16k", comments: "3.6k", shares: "6.1k" },
  },
  {
    id: 108, authorId: 2, type: "article" as const,
    title: "Inside Bangalore's new wave of deep tech startups",
    description: "A new generation of Indian founders is tackling hard problems in quantum computing, biotech, and advanced materials.",
    date: "Feb 21st 2026", image: "https://picsum.photos/seed/news-deeptech/800/500",
    tags: ["Startups", "Technology", "AI"],
    stats: { views: "21k", likes: "9.4k", comments: "1.8k", shares: "4.2k" },
  },
];

export const newsArticles = generateNewsArticles();

// ─── News Article Content ───
export const generateNewsArticleContent = (articleId: number) => {
  const contents: Record<number, string[]> = {
    101: [
      "India's Unified Payments Interface has gone from a domestic experiment to a global phenomenon in less than a decade.",
      "Launched in 2016 by the National Payments Corporation of India, UPI processed over 12 billion transactions in a single month last year — more than Visa and Mastercard combined in India.",
      "Now, countries from Singapore to France are adopting UPI-like frameworks, recognizing that real-time, zero-cost payments can transform financial inclusion.",
      "\"What India built with UPI is what the rest of the world is now trying to replicate,\" says Reserve Bank of India Governor Shaktikanta Das.",
      "The implications extend beyond payments — UPI's open architecture has spawned an entire ecosystem of fintech startups building lending, insurance, and investment products on top of the payment rails.",
    ],
    102: [
      "For years, Nvidia has dominated the AI chip market with near-monopoly power. But a quiet revolution in custom silicon is beginning to change the equation.",
      "Companies like Cerebras, Groq, and even tech giants like Google and Microsoft are designing purpose-built chips that challenge Nvidia's GPU-centric approach.",
      "\"The future of AI compute isn't one-size-fits-all,\" explains Dr. Andrew Feldman, CEO of Cerebras Systems. \"Different workloads need different architectures.\"",
      "The economic incentive is clear: Nvidia's H100 chips sell for $25,000-$40,000 each, and demand far outstrips supply.",
      "This chip diversity could ultimately benefit AI developers, driving down costs and enabling new types of applications that weren't economically viable before.",
    ],
    103: [
      "The European Union's Digital Markets Act represents the most ambitious attempt to regulate big tech since the breakup of AT&T in the 1980s.",
      "Under the DMA, 'gatekeeper' platforms — including Apple, Google, Meta, and Amazon — must open their ecosystems to competitors.",
      "Apple, for instance, has been forced to allow third-party app stores on iOS in Europe, fundamentally altering its walled-garden business model.",
      "\"This isn't about punishing success. It's about ensuring fair competition,\" says EU Competition Commissioner Margrethe Vestager.",
      "Critics argue the regulations could stifle innovation, but supporters point to early evidence that the DMA is already spurring new market entrants and lower prices for consumers.",
    ],
    104: [
      "After 18 months of what many call the worst funding drought in a decade, the venture capital market is showing cautious signs of recovery.",
      "Global VC investment totaled $68 billion in Q4 2025, up 23% from the previous quarter — though still well below the $120 billion quarterly peaks of 2021.",
      "The recovery is uneven: AI startups are commanding premium valuations while other sectors remain deeply discounted.",
      "\"We're seeing a bifurcation in the market,\" says Sequoia Capital partner Roelof Botha. \"The best companies can still raise, but the bar has never been higher.\"",
      "For founders, the message is clear: unit economics matter again, and the era of growth-at-all-costs is definitively over.",
    ],
    105: [
      "The battle for India's quick commerce market has intensified into a three-way war between Zepto, Blinkit, and Swiggy Instamart.",
      "Between them, these companies now operate over 3,000 'dark stores' — small warehouses in residential neighborhoods designed to fulfill orders in under 10 minutes.",
      "The economics are brutal: average order values hover around $8-12, margins are razor-thin, and the cost of maintaining thousands of micro-warehouses is enormous.",
      "Yet investors keep pouring money in. Zepto alone raised $1 billion in its last funding round, valuing the three-year-old company at $5 billion.",
      "\"Quick commerce is the next evolution of retail in India,\" says Aadit Palicha, Zepto's CEO. \"We're not just faster than supermarkets — we're making the supermarket obsolete.\"",
    ],
    106: [
      "Global investment in climate technology reached a record $120 billion in 2025, according to new data from BloombergNEF.",
      "The surge was driven by breakthroughs in battery technology, with solid-state batteries achieving commercial viability for the first time.",
      "Carbon capture and storage also saw a major influx of capital, with over $15 billion invested in direct air capture projects.",
      "\"We've passed the tipping point where climate tech is no longer just about saving the planet — it's about making money,\" says venture capitalist John Doerr.",
      "However, challenges remain: permitting bottlenecks, grid infrastructure limitations, and the need for significantly more investment in emerging markets.",
    ],
    107: [
      "The global race for AI supremacy has entered a new phase, with nations increasingly viewing artificial intelligence through the lens of national security.",
      "The United States, China, the EU, Saudi Arabia, and India have all announced comprehensive national AI strategies in the past year.",
      "Saudi Arabia's $100 billion AI fund — the largest sovereign investment in the technology — has sent shockwaves through the industry.",
      "\"AI is not just a technology. It's a geopolitical force multiplier,\" says former Google CEO Eric Schmidt.",
      "The risk of fragmentation is real: if nations pursue incompatible AI standards and regulations, the global AI ecosystem could splinter along geopolitical fault lines.",
    ],
    108: [
      "Bangalore, long known as India's Silicon Valley for its IT services industry, is reinventing itself as a hub for deep technology startups.",
      "A new wave of companies is emerging in quantum computing, synthetic biology, advanced materials, and space technology.",
      "Unlike their predecessors who focused on software and services, these startups are tackling fundamental scientific and engineering challenges.",
      "\"India has the talent and the ambition to lead in deep tech,\" says Kiran Mazumdar-Shaw, founder of Biocon. \"What we needed was the ecosystem, and that's now falling into place.\"",
      "Key to this transformation has been the growth of specialized funds like Pi Ventures and Speciale Invest, which focus exclusively on deep tech investments.",
    ],
  };
  return contents[articleId] || [
    "This article provides in-depth analysis of current industry developments.",
    "Leading experts share their perspectives on the implications and opportunities ahead.",
    "The coming months will reveal how these trends reshape the competitive landscape.",
  ];
};

// ─── Sponsored Posts (Ad articles placed by admin into feed) ───
export const generateSponsoredPosts = () => [
  {
    id: 901, authorId: 1, type: "article" as const, isSponsored: true,
    sponsor: { name: "Inito", logo: "https://picsum.photos/seed/sponsor-inito/200" },
    title: "At-home fertility diagnostics startup Inito raises $29M in Series B",
    description: "Inito's FDA-cleared device lets users track fertility hormones at home — now expanding to 12 new markets with fresh funding from BII and Fireside Ventures.",
    date: "Mar 1st 2026", image: "https://picsum.photos/seed/sp-inito/800/500",
    tags: ["Business", "Startups"],
    stats: { views: "48k", likes: "5.2k", comments: "892", shares: "2.1k" },
    placedBy: 13, // Admin userId
  },
  {
    id: 902, authorId: 3, type: "article" as const, isSponsored: true,
    sponsor: { name: "Razorpay", logo: "https://picsum.photos/seed/sponsor-razorpay/200" },
    title: "How Razorpay is powering the next wave of Indian fintech",
    description: "From payment gateway to full-stack financial platform — Razorpay's journey to becoming India's most valuable fintech company.",
    date: "Feb 28th 2026", image: "https://picsum.photos/seed/sp-razorpay/800/500",
    tags: ["Fintech", "Business", "Technology"],
    stats: { views: "62k", likes: "8.1k", comments: "1.4k", shares: "3.8k" },
    placedBy: 13,
  },
  {
    id: 903, authorId: 4, type: "article" as const, isSponsored: true,
    sponsor: { name: "AWS", logo: "https://picsum.photos/seed/sponsor-aws/200" },
    title: "Building AI infrastructure at scale: Lessons from AWS re:Invent",
    description: "AWS shares how enterprises are deploying large language models with custom training pipelines and inference optimization on its cloud platform.",
    date: "Feb 27th 2026", image: "https://picsum.photos/seed/sp-aws/800/500",
    tags: ["AI", "Technology"],
    stats: { views: "35k", likes: "4.8k", comments: "720", shares: "1.9k" },
    placedBy: 13,
  },
  {
    id: 904, authorId: 2, type: "article" as const, isSponsored: true,
    sponsor: { name: "Notion", logo: "https://picsum.photos/seed/sponsor-notion/200" },
    title: "Why top startups are replacing their entire toolstack with Notion",
    description: "From docs to databases to project management — how Notion became the operating system for over 100,000 teams worldwide.",
    date: "Feb 26th 2026", image: "https://picsum.photos/seed/sp-notion/800/500",
    tags: ["Startups", "Technology", "Business"],
    stats: { views: "29k", likes: "6.3k", comments: "1.1k", shares: "2.7k" },
    placedBy: 13,
  },
  {
    id: 905, authorId: 1, type: "article" as const, isSponsored: true,
    sponsor: { name: "Stripe", logo: "https://picsum.photos/seed/sponsor-stripe/200" },
    title: "Stripe Atlas: From idea to incorporated in 48 hours",
    description: "Stripe's startup incorporation service has now helped launch over 50,000 companies across 140 countries. Here's what founders need to know.",
    date: "Feb 25th 2026", image: "https://picsum.photos/seed/sp-stripe/800/500",
    tags: ["Startups", "Finance", "Business"],
    stats: { views: "41k", likes: "7.5k", comments: "980", shares: "3.2k" },
    placedBy: 13,
  },
];

export const sponsoredPosts = generateSponsoredPosts();

// ─── Sponsored Article Content ───
export const generateSponsoredArticleContent = (articleId: number) => {
  const contents: Record<number, string[]> = {
    901: [
      "Inito, the at-home fertility diagnostics company, has raised $29 million in a Series B round led by Fireside Ventures with participation from BII.",
      "The company's FDA-cleared device allows users to track key fertility hormones — estrogen, LH, progesterone, and FSH — from the comfort of their home using a simple urine test and smartphone app.",
      "\"We've helped over 100,000 women understand their cycles with clinical-grade accuracy,\" says Aayush Rai, CEO and co-founder of Inito.",
      "The fresh capital will be used to expand into 12 new markets across Europe and Southeast Asia, and to develop new diagnostic capabilities beyond fertility.",
      "Inito represents a broader trend in healthcare: bringing laboratory-grade diagnostics directly to consumers, reducing the friction and cost of understanding one's own health.",
    ],
    902: [
      "When Razorpay launched in 2014, online payments in India were notoriously unreliable. A decade later, the company processes over $100 billion in transactions annually.",
      "But co-founder Harshil Mathur says payments were always just the beginning. \"We wanted to build the financial infrastructure layer that every business in India needs.\"",
      "Today, Razorpay offers payroll, lending, corporate cards, and a complete banking stack — serving over 10 million businesses from street vendors to Fortune 500 companies.",
      "The company's recent expansion into Southeast Asia marks its first international play, with offices now in Singapore, Malaysia, and Indonesia.",
      "With a valuation north of $7.5 billion, Razorpay is betting that the same playbook that worked in India — combining payments with financial services — will resonate across emerging markets.",
    ],
    903: [
      "At AWS re:Invent 2025, the cloud giant unveiled a suite of new services designed to make deploying and managing AI workloads dramatically simpler.",
      "The centerpiece is Amazon Bedrock 2.0, which now supports fine-tuning of foundation models with as few as 100 examples — a fraction of what was previously required.",
      "\"Enterprises don't want to become AI companies. They want to use AI to become better at what they already do,\" said AWS CEO Matt Garman.",
      "New custom Trainium chips promise 40% better price-performance for training large language models compared to GPU-based alternatives.",
      "Early adopters like Intuit and Siemens report 3x faster deployment times and 60% lower inference costs after migrating to AWS's managed AI infrastructure.",
    ],
    904: [
      "When a YC-backed startup replaces Slack, Google Docs, Jira, and Confluence with a single tool, people notice. When a hundred of them do it, it becomes a trend.",
      "Notion has quietly become the default operating system for fast-moving teams, with its unique combination of docs, databases, and project management in one workspace.",
      "\"We don't think of ourselves as a productivity tool,\" says Ivan Zhao, Notion's co-founder. \"We're a medium for thought — like paper was, but connected.\"",
      "The company's AI features, launched last year, have accelerated adoption. Teams report writing documents 40% faster and finding information 3x more quickly.",
      "With 30 million users and a $10 billion valuation, Notion is proving that the future of work isn't about more tools — it's about fewer, better ones.",
    ],
    905: [
      "Starting a company used to require a lawyer, an accountant, and weeks of paperwork. Stripe Atlas has reduced that to a web form and 48 hours.",
      "Since launching in 2016, the incorporation service has helped over 50,000 companies get started — from solo founders to teams of 50 — across 140 countries.",
      "\"The hardest part of starting a company should be building the product, not filling out government forms,\" says Patrick Collison, Stripe's CEO.",
      "Atlas handles Delaware C-corp incorporation, IRS tax ID, a business bank account, and access to discounted services from partners like AWS and HubSpot.",
      "For international founders especially, Atlas has been transformative — providing access to the US business ecosystem without requiring physical presence or local legal counsel.",
    ],
  };
  return contents[articleId] || [
    "This sponsored article provides insights into industry developments.",
    "Leading companies are reshaping how businesses operate in their respective sectors.",
    "The opportunities ahead continue to attract significant investment and innovation.",
  ];
};

// ─── Content Topics ───
export const contentTopics = [
  { id: "tech", label: "Technology", selected: true },
  { id: "business", label: "Business", selected: true },
  { id: "ai", label: "AI & ML", selected: true },
  { id: "startups", label: "Startups", selected: false },
  { id: "finance", label: "Finance", selected: true },
  { id: "crypto", label: "Crypto", selected: false },
  { id: "science", label: "Science", selected: false },
  { id: "politics", label: "Politics", selected: true },
];

// ─── Article Content ───
export const generateArticleContent = (postId: number) => {
  const contents: Record<number, string[]> = {
    2: [
      "In a recent press conference, former President Donald Trump made headlines once again by discussing telecommunications technology in ways that left many experts scratching their heads.",
      "\"We're going to have 6G, maybe even 7G,\" Trump declared confidently. \"Nobody knows what it means, but we're going to have it before anyone else.\"",
      "The comments came during a discussion about American technological competitiveness. Telecommunications experts were quick to point out that 6G standards don't yet exist.",
      "\"6G is not something you can just declare into existence,\" explained Dr. Sarah Chen, a telecommunications researcher at MIT.",
      "This isn't the first time business leaders and politicians have used technical buzzwords without fully understanding their meaning.",
    ],
    3: [
      "OpenAI has officially announced GPT-5, marking what the company calls \"the most significant leap in AI capability since the introduction of GPT-4.\"",
      "The new model demonstrates unprecedented reasoning capabilities, with the ability to solve complex multi-step problems that previously stumped AI systems.",
      "\"We've fundamentally reimagined how AI systems approach reasoning,\" said OpenAI CEO Sam Altman.",
      "Key improvements include enhanced mathematical reasoning, better understanding of nuanced context, and significantly improved factual accuracy.",
      "The announcement has sent ripples through the tech industry, with competitors scrambling to respond.",
    ],
    5: [
      "In a historic moment for space exploration, SpaceX's Starship rocket has completed its first fully successful orbital flight.",
      "The massive rocket launched from SpaceX's Starbase facility in Boca Chica, Texas. It successfully reached orbit and executed a controlled reentry.",
      "\"This is the day we've been working toward for over a decade,\" said Elon Musk.",
      "The successful flight validates years of iterative testing, including multiple explosive failures.",
      "NASA has already contracted Starship for lunar landing missions as part of the Artemis program.",
    ],
    7: [
      "Microsoft has unveiled its next-generation AI chips, codenamed 'Maia,' designed to compete directly with Nvidia's dominant GPU offerings.",
      "The custom silicon represents a major strategic shift for Microsoft, which has traditionally relied on third-party hardware.",
      "\"We need to control our own destiny when it comes to AI infrastructure,\" explained Microsoft CEO Satya Nadella.",
      "Early benchmarks suggest the chips offer competitive performance to Nvidia's H100 GPUs while consuming significantly less power.",
      "The announcement puts additional pressure on Nvidia, which has enjoyed near-monopoly status in the AI chip market.",
    ],
    8: [
      "Zepto has achieved unicorn status faster than any company in Indian startup history, reaching a $5 billion valuation.",
      "Founded by Stanford dropouts Aadit Palicha and Kaivalya Vohra in 2021, Zepto has rapidly expanded across India.",
      "\"We're not just delivering groceries—we're redefining convenience,\" said co-founder Aadit Palicha.",
      "The latest funding round was led by StepStone Group, with participation from existing investors.",
      "Critics have questioned the sustainability of the quick commerce model, citing thin margins and high operational costs.",
    ],
    9: [
      "Tesla has begun real-world factory trials of its Optimus humanoid robot.",
      "The robots are currently performing basic assembly tasks at Tesla's Fremont, California factory.",
      "\"Optimus is not science fiction anymore,\" Elon Musk posted on X.",
      "Tesla claims Optimus could eventually handle any repetitive physical task that humans currently perform.",
      "The implications for the labor market are profound.",
    ],
    10: [
      "Anthropic's Claude 4 has achieved unprecedented scores on AI safety benchmarks.",
      "The new model demonstrates a sophisticated ability to understand context and intent.",
      "\"We've proven that safety and capability aren't trade-offs,\" said Anthropic CEO Dario Amodei.",
      "Key innovations include improved reasoning about potential harms and better recognition of manipulation attempts.",
      "The achievement is significant for the broader AI industry.",
    ],
    11: [
      "The U.S. government has announced sweeping new restrictions on semiconductor exports.",
      "The new regulations target AI chips and the equipment used to manufacture them.",
      "\"Advanced semiconductors are foundational to national security,\" said Commerce Secretary Gina Raimondo.",
      "The restrictions are expected to significantly impact global tech supply chains.",
      "China has condemned the move as \"technological hegemony.\"",
    ],
    12: [
      "The Indian stock market has reached a historic milestone, with the BSE Sensex crossing 85,000 points.",
      "The rally has been driven by strong corporate earnings and growing optimism about India's long-term growth prospects.",
      "\"India is becoming the world's most attractive investment destination,\" said Nikhil Kamath.",
      "Key sectors driving the gains include banking, technology, and consumer goods.",
      "Analysts caution that valuations are stretched by historical standards.",
    ],
  };
  return contents[postId] || [
    "This article contains important insights about current developments in the industry.",
    "Experts have weighed in on the implications of these changes for businesses and consumers alike.",
    "The coming months will be crucial in determining how these trends play out in the broader market.",
  ];
};
