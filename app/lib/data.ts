import {
  Activity, Search, Users, Bell, Mail, Bookmark, BarChart3, Settings, User, Play,
} from "lucide-react";

// ─── Demo Accounts ───
export const demoAccounts: { id: number; email: string; password: string; name: string; role: string }[] = [];

// ─── Users ───
export const generateUsers = () => [] as any[];

export const users = generateUsers();

// ─── Posts ───
export const generatePosts = () => [] as any[];

export const posts = generatePosts();

// ─── Tabs ───
export const filterTabs = ["For You", "Local", "Following", "Trending", "News", "AI", "Technology"];
export const exploreTabs = ["All", "Creators", "Investor & Entrepreneur", "CEO", "Other", "Followed"];
export const exploreSubTabs = ["Top", "Latest", "People", "Companies"];
export const circleTabs = ["For You", "Following", "Trending", "Explore", "Suggested", "Founders", "Companies"];
export const messageTabs = ["All", "Unread", "WhatsApp", "Instagram", "Messenger", "Facebook", "LinkedIn"];
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
export const generateCircleMembers = () => [] as any[];

export const circleMembers = generateCircleMembers();

export const circlePosts: any[] = [];

// ─── Notifications ───
export const notifications: any[] = [];

// ─── Conversations ───
export const conversations: any[] = [];

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
export const newsAuthors: any[] = [];

// ─── News Articles (written by invited authors) ───
export const generateNewsArticles = () => [] as any[];
/* REMOVED_NEWS_ARTICLES_PLACEHOLDER
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
*/

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
export const generateSponsoredPosts = () => [] as any[];

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
