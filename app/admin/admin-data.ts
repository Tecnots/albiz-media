// ─── Admin Demo Data ───

const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Blake", "Drew", "Skyler", "Reese", "Jamie", "Dakota", "Rowan", "Sage", "Emery", "Finley", "Harley", "Kai", "Parker", "Spencer", "Cameron", "Logan", "Hayden", "Charlie", "Peyton", "Phoenix", "River", "Eden", "Shay", "Micah", "Arden", "Baylor", "Cyan", "Devon", "Ellis", "Frankie", "Gray", "Haven", "Ira", "Jules", "Karter", "Lane", "Milan", "Nico", "Ocean", "Pax", "Remy", "Sutton"];
const lastNames = ["Chen", "Patel", "Kim", "Williams", "Garcia", "Martinez", "Lee", "Robinson", "Walker", "Hall", "Young", "Allen", "King", "Wright", "Lopez", "Hill", "Scott", "Green", "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Torres", "Reed", "Bell", "Cook", "Morgan", "Bailey", "Rivera", "Cooper", "Cox", "Howard", "Ward", "Brooks", "Gray", "James", "Watson", "Price", "Bennett", "Wood", "Barnes", "Ross", "Coleman", "Jenkins", "Perry", "Powell", "Long", "Hughes", "Flores"];
const titles = ["Full-Stack Developer", "Product Manager", "UX Designer", "Data Scientist", "Marketing Lead", "DevOps Engineer", "Startup Founder", "Freelance Writer", "Growth Hacker", "Investor", "Content Creator", "AI Researcher", "Mobile Developer", "CTO", "VP Engineering", "Product Designer", "Frontend Engineer", "Backend Engineer", "Technical Writer", "Community Manager"];

// ─── Platform Stats ───
export const platformStats = [
  { label: "Total Users", value: "12,847", change: 8.2, up: true, sparkline: [80, 85, 82, 90, 88, 95, 92, 100, 98, 108, 105, 115] },
  { label: "Total Posts", value: "3,421", change: 15.3, up: true, sparkline: [40, 45, 42, 50, 55, 52, 60, 58, 65, 70, 68, 78] },
  { label: "Active Users (24h)", value: "2,156", change: 3.1, up: true, sparkline: [60, 58, 62, 55, 59, 63, 57, 61, 64, 60, 62, 65] },
  { label: "New Signups (7d)", value: "342", change: 22.4, up: true, sparkline: [15, 20, 18, 25, 22, 30, 28, 35, 32, 40, 38, 45] },
];

// ─── Quick Stats ───
export const quickStats = [
  { label: "Circle Members", value: "842" },
  { label: "Pending Approvals", value: "0" },
  { label: "Flagged Content", value: "0" },
  { label: "Articles Published", value: "156" },
  { label: "Active Conversations", value: "1,284" },
];

// ─── Platform Activity Chart ───
export const platformActivityData = [
  { date: "01 Feb", value: 320 },
  { date: "04 Feb", value: 480 },
  { date: "07 Feb", value: 380 },
  { date: "10 Feb", value: 550 },
  { date: "13 Feb", value: 420 },
  { date: "16 Feb", value: 620 },
  { date: "19 Feb", value: 510 },
  { date: "22 Feb", value: 720 },
  { date: "25 Feb", value: 680 },
  { date: "28 Feb", value: 850 },
];

// ─── Recent Activity Log ───
export const generateActivityLog = () => {
  const actions = [
    { type: "signup", text: "signed up" },
    { type: "post", text: "published a post" },
    { type: "article", text: "published an article" },
    { type: "flag", text: "reported content" },
    { type: "circle", text: "requested Circle access" },
    { type: "verify", text: "requested verification" },
  ];

  return Array.from({ length: 15 }, (_, i) => {
    const action = actions[i % actions.length];
    return {
      id: i + 1,
      userName: `${firstNames[i]} ${lastNames[i]}`,
      avatar: `https://picsum.photos/seed/activity-${i}/200`,
      action: action.text,
      type: action.type,
      time: i < 3 ? `${(i + 1) * 5}m ago` : i < 8 ? `${i}h ago` : `${i - 7}d ago`,
    };
  });
};

// ─── Admin Users (50 users) ───
export const generateAdminUsers = () => {
  // First 8 match the existing app users
  const existingUsers = [
    { id: 1, name: "Jessin Sam S", handle: "jessinsam", email: "jessinsam@demo.albiz.com", avatar: "/Jess-profile.jpg", role: "CIRCLE" as const, verified: true, isPremium: true, title: "Founder @ Example.com", joinDate: "Jan 2023", followers: "150k", status: "active" as const },
    { id: 2, name: "Open AI", handle: "openai", email: "openai@demo.albiz.com", avatar: "https://picsum.photos/seed/openai/200", role: "CIRCLE" as const, verified: true, isPremium: false, title: "ChatGPT Creators", joinDate: "Mar 2023", followers: "2.8M", status: "active" as const },
    { id: 3, name: "Nikhil Kamath", handle: "nikhilkamath", email: "nikhilkamath@demo.albiz.com", avatar: "https://picsum.photos/seed/nikhil/200", role: "CIRCLE" as const, verified: true, isPremium: false, title: "Investor & Entrepreneur", joinDate: "Feb 2023", followers: "890k", status: "active" as const },
    { id: 4, name: "Elon Musk", handle: "elonmusk", email: "elonmusk@demo.albiz.com", avatar: "https://picsum.photos/seed/elon/200", role: "CIRCLE" as const, verified: true, isPremium: false, title: "CEO @ Tesla, SpaceX", joinDate: "Jan 2023", followers: "5.2M", status: "active" as const },
    { id: 5, name: "Donald J. Trump", handle: "realdonaldtrump", email: "realdonaldtrump@demo.albiz.com", avatar: "https://picsum.photos/seed/trump/200", role: "NORMAL" as const, verified: true, isPremium: false, title: "US President 2026", joinDate: "Jun 2023", followers: "4.1M", status: "active" as const },
    { id: 6, name: "Y Combinator", handle: "ycombinator", email: "ycombinator@demo.albiz.com", avatar: "https://picsum.photos/seed/yc/200", role: "CIRCLE" as const, verified: true, isPremium: false, title: "Help founders make something...", joinDate: "Jan 2023", followers: "1.1M", status: "active" as const },
    { id: 7, name: "Satya Nadella", handle: "satyanadella", email: "satyanadella@demo.albiz.com", avatar: "https://picsum.photos/seed/satya/200", role: "CIRCLE" as const, verified: true, isPremium: false, title: "Chairman and CEO at Microsoft", joinDate: "Mar 2023", followers: "3.4M", status: "active" as const },
    { id: 8, name: "Aadit Palicha", handle: "aaditpalicha", email: "aaditpalicha@demo.albiz.com", avatar: "https://picsum.photos/seed/aadit/200", role: "CIRCLE" as const, verified: true, isPremium: false, title: "Co-founder/CEO @ZeptoNow", joinDate: "Apr 2023", followers: "420k", status: "active" as const },
  ];

  const generated = Array.from({ length: 42 }, (_, i) => {
    const idx = i + 8;
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    return {
      id: idx + 1,
      name: `${fn} ${ln}`,
      handle: `${fn.toLowerCase()}${ln.toLowerCase()}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
      avatar: `https://picsum.photos/seed/admin-user-${idx}/200`,
      role: (i < 4 ? "CIRCLE" : "NORMAL") as "CIRCLE" | "NORMAL",
      verified: i < 8,
      isPremium: i < 2,
      title: titles[i % titles.length],
      joinDate: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i % 12]} 2024`,
      followers: `${Math.floor((i + 1) * 127)}`,
      status: (i === 15 || i === 23 ? "banned" : "active") as "active" | "banned",
    };
  });

  return [...existingUsers, ...generated];
};

// ─── Admin Posts (content management) ───
export const generateAdminPosts = () => {
  const posts = [
    { id: 1, userId: 2, userName: "Open AI", type: "POST" as const, content: "Happy to share that Example.com has secured $10M from the top investors.", date: "Dec 12th 2025", image: "https://picsum.photos/seed/funding-announce/800/500", tags: ["Business", "Startups"], views: "1k", likes: "1k", comments: "1k" },
    { id: 2, userId: 1, userName: "Jessin Sam S", type: "ARTICLE" as const, title: "Donald Trump reminds the entire world he has no idea what 6G means", content: "When business leaders spout buzzwords...", date: "Dec 12th 2025", image: "https://picsum.photos/seed/trump-article/400/300", tags: ["News", "Policy"], views: "2.3k", likes: "1.2k", comments: "342" },
    { id: 3, userId: 2, userName: "Open AI", type: "ARTICLE" as const, title: "OpenAI announces GPT-5: The most capable AI model yet", content: "The new model shows unprecedented reasoning capabilities...", date: "Dec 12th 2025", image: "https://picsum.photos/seed/gpt5-announce/400/300", tags: ["AI", "Technology"], views: "45k", likes: "32k", comments: "5.2k" },
    { id: 4, userId: 3, userName: "Nikhil Kamath", type: "POST" as const, content: "The best time to start investing was yesterday. The second best time is today.", date: "Dec 11th 2025", tags: ["Finance", "Investing"], views: "5.2k", likes: "2.1k", comments: "456" },
    { id: 5, userId: 4, userName: "Elon Musk", type: "ARTICLE" as const, title: "SpaceX Starship completes first successful orbital flight", content: "After years of development and testing...", date: "Dec 10th 2025", image: "https://picsum.photos/seed/spacex/400/300", tags: ["Technology", "Space"], views: "12k", likes: "8.5k", comments: "1.2k" },
    { id: 6, userId: 6, userName: "Y Combinator", type: "POST" as const, content: "Applications for YC Winter 2026 batch are now open.", date: "Dec 9th 2025", tags: ["Startups", "Business"], views: "8.3k", likes: "3.2k", comments: "892" },
    { id: 7, userId: 7, userName: "Satya Nadella", type: "ARTICLE" as const, title: "Microsoft unveils next-gen AI chips to compete with Nvidia", content: "The tech giant is betting big on custom silicon...", date: "Dec 8th 2025", image: "https://picsum.photos/seed/ms-chips/400/300", tags: ["Technology", "AI"], views: "15k", likes: "6.7k", comments: "1.1k" },
    { id: 8, userId: 8, userName: "Aadit Palicha", type: "ARTICLE" as const, title: "Zepto becomes India's fastest unicorn with $5B valuation", content: "The quick commerce startup has disrupted...", date: "Dec 7th 2025", image: "https://picsum.photos/seed/zepto-unicorn/400/300", tags: ["News", "Business"], views: "22k", likes: "11k", comments: "2.3k" },
    { id: 9, userId: 4, userName: "Elon Musk", type: "ARTICLE" as const, title: "Tesla's Optimus robot begins factory trials", content: "The humanoid robot is now performing basic assembly tasks...", date: "Dec 6th 2025", image: "https://picsum.photos/seed/optimus-robot/400/300", tags: ["Technology", "AI"], views: "35k", likes: "18k", comments: "3.2k" },
    { id: 10, userId: 2, userName: "Open AI", type: "ARTICLE" as const, title: "Claude 4 sets new benchmarks in AI safety research", content: "Anthropic's latest model demonstrates unprecedented ability...", date: "Dec 5th 2025", image: "https://picsum.photos/seed/claude4-safety/400/300", tags: ["AI", "Technology"], views: "28k", likes: "15k", comments: "2.8k" },
    { id: 11, userId: 5, userName: "Donald J. Trump", type: "ARTICLE" as const, title: "US announces new semiconductor export restrictions", content: "The Biden administration expands chip export controls...", date: "Dec 4th 2025", image: "https://picsum.photos/seed/chip-policy/400/300", tags: ["News", "Policy"], views: "18k", likes: "4.2k", comments: "2.1k" },
    { id: 12, userId: 3, userName: "Nikhil Kamath", type: "ARTICLE" as const, title: "Indian stock market hits all-time high amid foreign investment surge", content: "Sensex crosses 85,000 for the first time...", date: "Dec 3rd 2025", image: "https://picsum.photos/seed/sensex-high/400/300", tags: ["News", "Finance"], views: "42k", likes: "21k", comments: "4.5k" },
  ];

  return posts.map((post, i) => ({
    ...post,
    avatar: post.userId === 1 ? "/Jess-profile.jpg" : `https://picsum.photos/seed/${["openai", "nikhil", "elon", "trump", "yc", "satya", "aadit"][post.userId - 2] || "user"}/200`,
    featured: i === 0 || i === 2,
    pinned: i === 0,
    flagged: i === 3 || i === 7,
    flagReason: i === 3 ? "Misleading information" : i === 7 ? "Spam reported by 3 users" : null,
    status: (i === 3 || i === 7 ? "flagged" : "published") as "published" | "flagged",
  }));
};

// ─── Circle Requests ───
export const generateCircleRequests = () =>
  Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `${firstNames[i + 20]} ${lastNames[i + 20]}`,
    handle: `${firstNames[i + 20].toLowerCase()}${lastNames[i + 20].toLowerCase()}`,
    avatar: `https://picsum.photos/seed/circle-req-${i}/200`,
    title: titles[i + 5],
    followers: `${(i + 1) * 340}`,
    requestDate: `${i + 1}d ago`,
    reason: [
      "Active content creator with 50+ posts",
      "Industry leader in fintech space",
      "Growing audience with high engagement",
      "Verified professional background",
      "Frequent contributor to discussions",
      "Recommended by 3 Circle members",
      "Published author and thought leader",
      "Startup founder with notable traction",
    ][i],
  }));

// ─── Verification Requests ───
export const generateVerificationRequests = () =>
  Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `${firstNames[i + 30]} ${lastNames[i + 30]}`,
    handle: `${firstNames[i + 30].toLowerCase()}${lastNames[i + 30].toLowerCase()}`,
    avatar: `https://picsum.photos/seed/verify-req-${i}/200`,
    title: titles[i + 10],
    followers: `${(i + 2) * 1200}`,
    accountAge: `${(i + 3) * 2} months`,
    requestDate: `${i + 1}d ago`,
  }));

// ─── Flagged Content ───
export const generateFlaggedContent = () => [
  { id: 1, type: "post" as const, userName: "Alex Chen", avatar: "https://picsum.photos/seed/flag-1/200", content: "This is misleading investment advice that could harm users...", reason: "Misleading information", reportCount: 5, reportedAt: "2h ago" },
  { id: 2, type: "article" as const, userName: "Jordan Patel", avatar: "https://picsum.photos/seed/flag-2/200", content: "Unverified health claims about a new supplement...", reason: "False health claims", reportCount: 8, reportedAt: "5h ago" },
  { id: 3, type: "post" as const, userName: "Taylor Kim", avatar: "https://picsum.photos/seed/flag-3/200", content: "Spam promotional content with suspicious links...", reason: "Spam", reportCount: 12, reportedAt: "1d ago" },
  { id: 4, type: "post" as const, userName: "Morgan Williams", avatar: "https://picsum.photos/seed/flag-4/200", content: "Harassment directed at another user in comments...", reason: "Harassment", reportCount: 3, reportedAt: "1d ago" },
  { id: 5, type: "article" as const, userName: "Casey Garcia", avatar: "https://picsum.photos/seed/flag-5/200", content: "Copied content from another platform without attribution...", reason: "Plagiarism", reportCount: 2, reportedAt: "2d ago" },
  { id: 6, type: "post" as const, userName: "Riley Martinez", avatar: "https://picsum.photos/seed/flag-6/200", content: "Inappropriate content that violates community guidelines...", reason: "Inappropriate content", reportCount: 7, reportedAt: "3d ago" },
  { id: 7, type: "article" as const, userName: "Avery Lee", avatar: "https://picsum.photos/seed/flag-7/200", content: "Promotion of unauthorized financial products...", reason: "Unauthorized promotion", reportCount: 4, reportedAt: "3d ago" },
];

// ─── Admin News Articles ───
export const generateAdminNews = () => [];

// ─── Authors / Journalists ───
export type AuthorStatus = "active" | "invited" | "inactive";
export type ArticleWorkflowStatus = "draft" | "submitted" | "under_review" | "revision_requested" | "approved" | "published" | "rejected";

export const generateAuthors = () => [];

export const generateEditorialQueue = () => [];

// ─── Platform Analytics ───
export const analyticsOverviewStats = [
  { label: "Daily Active Users", value: "2,156", change: 5.4, up: true, sparkline: [50, 52, 48, 55, 53, 58, 56, 60, 58, 62, 60, 65] },
  { label: "Posts per Day", value: "127", change: 12.1, up: true, sparkline: [30, 35, 32, 40, 38, 42, 45, 43, 48, 50, 47, 55] },
  { label: "Avg. Session", value: "18m 32s", change: 2.3, up: true, sparkline: [40, 42, 41, 43, 42, 44, 43, 45, 44, 46, 45, 47] },
  { label: "Engagement Rate", value: "24.1%", change: 1.8, up: false, sparkline: [28, 27, 26, 27, 25, 26, 25, 24, 25, 24, 24, 24] },
];

export const userGrowthData = [
  { date: "01 Jan", value: 8200 },
  { date: "15 Jan", value: 8800 },
  { date: "01 Feb", value: 9500 },
  { date: "15 Feb", value: 10200 },
  { date: "01 Mar", value: 10800 },
  { date: "15 Mar", value: 11400 },
  { date: "01 Apr", value: 11900 },
  { date: "15 Apr", value: 12300 },
  { date: "01 May", value: 12600 },
  { date: "15 May", value: 12847 },
];

export const contentProductionData = [
  { date: "Week 1", posts: 85, articles: 32 },
  { date: "Week 2", posts: 92, articles: 28 },
  { date: "Week 3", posts: 78, articles: 35 },
  { date: "Week 4", posts: 105, articles: 40 },
  { date: "Week 5", posts: 95, articles: 38 },
  { date: "Week 6", posts: 110, articles: 42 },
  { date: "Week 7", posts: 120, articles: 45 },
  { date: "Week 8", posts: 127, articles: 48 },
];

export const topPerformingPosts = [
  { id: 1, title: "OpenAI announces GPT-5", views: "45k", likes: "32k", author: "Open AI", avatar: "https://picsum.photos/seed/openai/200" },
  { id: 2, title: "Indian stock market hits all-time high", views: "42k", likes: "21k", author: "Nikhil Kamath", avatar: "https://picsum.photos/seed/nikhil/200" },
  { id: 3, title: "Tesla's Optimus robot begins trials", views: "35k", likes: "18k", author: "Elon Musk", avatar: "https://picsum.photos/seed/elon/200" },
  { id: 4, title: "Claude 4 sets new benchmarks", views: "28k", likes: "15k", author: "Open AI", avatar: "https://picsum.photos/seed/openai/200" },
  { id: 5, title: "Zepto becomes India's fastest unicorn", views: "22k", likes: "11k", author: "Aadit Palicha", avatar: "https://picsum.photos/seed/aadit/200" },
];

// ─── Site-wide Traffic Analytics ───
export const siteTrafficStats = [
  { label: "Page Views", value: "1.2M", change: 14.2, up: true, sparkline: [80, 90, 85, 100, 95, 110, 105, 120, 115, 130, 125, 140] },
  { label: "Unique Visitors", value: "284k", change: 11.8, up: true, sparkline: [40, 45, 42, 50, 48, 55, 52, 60, 58, 65, 62, 70] },
  { label: "Avg. Session", value: "4m 32s", change: 8.1, up: true, sparkline: [30, 32, 31, 34, 33, 36, 35, 38, 37, 40, 39, 42] },
  { label: "Bounce Rate", value: "32.4%", change: 2.1, up: false, sparkline: [35, 34, 36, 33, 35, 32, 34, 31, 33, 30, 32, 32] },
];

export const pageViewsOverTime = [
  { date: "01 Feb", value: 38200 }, { date: "03 Feb", value: 41500 }, { date: "05 Feb", value: 39800 },
  { date: "07 Feb", value: 44100 }, { date: "09 Feb", value: 42300 }, { date: "11 Feb", value: 46700 },
  { date: "13 Feb", value: 43900 }, { date: "15 Feb", value: 48200 }, { date: "17 Feb", value: 45600 },
  { date: "19 Feb", value: 50100 }, { date: "21 Feb", value: 47800 }, { date: "23 Feb", value: 52400 },
  { date: "25 Feb", value: 49700 }, { date: "27 Feb", value: 54200 },
];

export const trafficSources = [
  { source: "Direct", visits: "412k", pct: 34 },
  { source: "Organic Search", visits: "312k", pct: 26 },
  { source: "Social Media", visits: "204k", pct: 17 },
  { source: "Referral", visits: "156k", pct: 13 },
  { source: "Email", visits: "72k", pct: 6 },
  { source: "Paid Search", visits: "48k", pct: 4 },
];

export const topPages = [
  { path: "/", name: "Home / Feed", views: "342k", avgTime: "3m 12s" },
  { path: "/explore", name: "Explore", views: "189k", avgTime: "2m 45s" },
  { path: "/circle", name: "Circle", views: "134k", avgTime: "4m 18s" },
  { path: "/messages", name: "Messages", views: "98k", avgTime: "6m 42s" },
  { path: "/profile", name: "Profile Pages", views: "87k", avgTime: "1m 55s" },
  { path: "/analytics", name: "Analytics", views: "45k", avgTime: "3m 30s" },
  { path: "/saved", name: "Saved", views: "32k", avgTime: "2m 10s" },
  { path: "/settings", name: "Settings", views: "21k", avgTime: "1m 45s" },
];

export const deviceBreakdown = [
  { device: "Mobile", pct: 58, sessions: "164k" },
  { device: "Desktop", pct: 34, sessions: "96k" },
  { device: "Tablet", pct: 8, sessions: "23k" },
];

export const geoData = [
  { country: "India", visitors: "98k", pct: 34 },
  { country: "United States", visitors: "72k", pct: 25 },
  { country: "United Kingdom", visitors: "28k", pct: 10 },
  { country: "UAE", visitors: "21k", pct: 7 },
  { country: "Canada", visitors: "18k", pct: 6 },
  { country: "Germany", visitors: "14k", pct: 5 },
  { country: "Others", visitors: "33k", pct: 13 },
];

export const userBehaviorFlow = [
  { step: "Landing", users: 284000, dropoff: 0 },
  { step: "Browse Feed", users: 198000, dropoff: 30 },
  { step: "View Post", users: 142000, dropoff: 28 },
  { step: "Engage (Like/Comment)", users: 68000, dropoff: 52 },
  { step: "Follow / Circle", users: 34000, dropoff: 50 },
  { step: "Message / DM", users: 12000, dropoff: 65 },
];

export const realtimeStats = {
  activeNow: 1247,
  pageViewsPerMin: 342,
  activePages: [
    { page: "Home / Feed", users: 523 },
    { page: "Explore", users: 312 },
    { page: "Circle", users: 189 },
    { page: "Messages", users: 134 },
    { page: "Profile", users: 89 },
  ],
};

export const engagementMetrics = {
  totalLikes: "2.4M",
  totalComments: "856k",
  totalShares: "412k",
  totalSaves: "234k",
  avgLikesPerPost: "342",
  avgCommentsPerPost: "89",
  viralCoefficient: "1.24",
  retentionRate: "72%",
};

export const retentionData = [
  { day: "Day 1", pct: 100 }, { day: "Day 2", pct: 72 }, { day: "Day 3", pct: 58 },
  { day: "Day 7", pct: 42 }, { day: "Day 14", pct: 34 }, { day: "Day 30", pct: 28 },
];

// ─── Ad Campaigns ───
export const adCampaigns = [
  { id: 1, name: "Inito Diagnostics", advertiser: "Inito Health", status: "active" as const, budget: "$5,000", spent: "$3,240", impressions: "245k", clicks: "8.2k", ctr: "3.35%", cpc: "$0.39", startDate: "Feb 1, 2026", endDate: "Mar 1, 2026", placement: "feed", image: "https://picsum.photos/seed/ad-inito/400/200" },
  { id: 2, name: "YC W26 Applications", advertiser: "Y Combinator", status: "active" as const, budget: "$12,000", spent: "$7,820", impressions: "520k", clicks: "18.4k", ctr: "3.54%", cpc: "$0.42", startDate: "Jan 15, 2026", endDate: "Mar 15, 2026", placement: "sidebar", image: "https://picsum.photos/seed/ad-yc/400/200" },
  { id: 3, name: "Microsoft Azure AI", advertiser: "Microsoft", status: "active" as const, budget: "$25,000", spent: "$14,600", impressions: "890k", clicks: "24.1k", ctr: "2.71%", cpc: "$0.61", startDate: "Feb 10, 2026", endDate: "Apr 10, 2026", placement: "feed", image: "https://picsum.photos/seed/ad-azure/400/200" },
  { id: 4, name: "Zepto Quick Commerce", advertiser: "Zepto", status: "paused" as const, budget: "$8,000", spent: "$4,100", impressions: "312k", clicks: "11.2k", ctr: "3.59%", cpc: "$0.37", startDate: "Jan 20, 2026", endDate: "Feb 20, 2026", placement: "stories", image: "https://picsum.photos/seed/ad-zepto/400/200" },
  { id: 5, name: "Tesla Cybertruck", advertiser: "Tesla", status: "completed" as const, budget: "$15,000", spent: "$15,000", impressions: "1.2M", clicks: "42.8k", ctr: "3.57%", cpc: "$0.35", startDate: "Dec 1, 2025", endDate: "Jan 31, 2026", placement: "feed", image: "https://picsum.photos/seed/ad-tesla/400/200" },
  { id: 6, name: "Stripe Payments", advertiser: "Stripe", status: "scheduled" as const, budget: "$10,000", spent: "$0", impressions: "0", clicks: "0", ctr: "0%", cpc: "$0", startDate: "Mar 1, 2026", endDate: "Apr 1, 2026", placement: "sidebar", image: "https://picsum.photos/seed/ad-stripe/400/200" },
];

export const adRevenueStats = [
  { label: "Total Revenue", value: "$48,760", change: 22.4, up: true, sparkline: [20, 28, 25, 35, 32, 40, 38, 48, 45, 52, 50, 58] },
  { label: "Active Campaigns", value: "3", change: 0, up: true, sparkline: [3, 3, 4, 4, 3, 3, 3, 4, 3, 3, 3, 3] },
  { label: "Avg. CTR", value: "3.24%", change: 0.8, up: true, sparkline: [28, 30, 29, 31, 30, 32, 31, 33, 32, 34, 33, 32] },
  { label: "Total Impressions", value: "3.2M", change: 18.1, up: true, sparkline: [40, 48, 45, 55, 52, 62, 58, 70, 65, 78, 72, 85] },
];

export const adRevenueOverTime = [
  { date: "Jan", value: 12400 }, { date: "Feb", value: 15800 }, { date: "Mar", value: 18200 },
  { date: "Apr", value: 14600 }, { date: "May", value: 21500 }, { date: "Jun", value: 19800 },
  { date: "Jul", value: 24100 }, { date: "Aug", value: 22800 }, { date: "Sep", value: 28400 },
  { date: "Oct", value: 26200 }, { date: "Nov", value: 32600 }, { date: "Dec", value: 35400 },
];

export const adPlacementPerformance = [
  { placement: "Feed", impressions: "2.1M", clicks: "72k", ctr: "3.43%", revenue: "$31,200" },
  { placement: "Sidebar", impressions: "680k", clicks: "18k", ctr: "2.65%", revenue: "$12,400" },
  { placement: "Stories", impressions: "420k", clicks: "14k", ctr: "3.33%", revenue: "$5,160" },
];
