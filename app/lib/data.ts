import {
  Activity, Search, Users, Bell, Mail, Bookmark, BarChart3, Settings, User,
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
export const messageTabs = ["All", "Unread", "Instagram", "Facebook", "LinkedIn"];
export const savedTabs = ["All", "News", "Profiles", "Circle posts", "Media", "Others"];
export const analyticsTabs = ["Overview", "Posts", "Profile"];
export const settingsTabs = ["Account", "Profile & Circle", "Privacy & Safety", "Notifications", "Billing", "Security"];

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

// ─── Nav Items ───
export const navItems = [
  { icon: Activity, label: "Activities", href: "/" },
  { icon: Search, label: "Explore", href: "/explore" },
  { icon: Users, label: "Circle", href: "/circle" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Mail, label: "Messages", href: "/messages" },
  { icon: Bookmark, label: "Saved", href: "/saved" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: User, label: "Profile", href: "/profile" },
];

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
