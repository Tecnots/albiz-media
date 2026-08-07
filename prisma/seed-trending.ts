import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// ─── Seed Users ──────────────────────────────────────────────────────────────

const SEED_USERS = [
  { name: "Sarah Chen", handle: "sarahchen", title: "AI Research Lead", country: "US", countryCode: "US" },
  { name: "Marcus Johnson", handle: "marcusj", title: "Startup Founder", country: "US", countryCode: "US" },
  { name: "Priya Sharma", handle: "priyasharma", title: "Tech Journalist", country: "India", countryCode: "IN" },
  { name: "Omar Al-Rashid", handle: "omaralrashid", title: "VC Partner", country: "UAE", countryCode: "AE" },
  { name: "Elena Rodriguez", handle: "elenarodriguez", title: "Marketing Director", country: "Spain", countryCode: "ES" },
  { name: "David Park", handle: "davidpark", title: "Software Engineer", country: "South Korea", countryCode: "KR" },
  { name: "Fatima Hassan", handle: "fatimahassan", title: "Finance Analyst", country: "UAE", countryCode: "AE" },
  { name: "James Wright", handle: "jameswright", title: "Sports Analyst", country: "UK", countryCode: "GB" },
  { name: "Aisha Okafor", handle: "aishaokafor", title: "Health Researcher", country: "Nigeria", countryCode: "NG" },
  { name: "Lucas Müller", handle: "lucasmuller", title: "Climate Scientist", country: "Germany", countryCode: "DE" },
  { name: "Yuki Tanaka", handle: "yukitanaka", title: "Education Innovator", country: "Japan", countryCode: "JP" },
  { name: "Nina Petrova", handle: "ninapetrova", title: "Travel Photographer", country: "Russia", countryCode: "RU" },
  { name: "Raj Patel", handle: "rajpatel", title: "Blockchain Developer", country: "India", countryCode: "IN" },
  { name: "Sophie Martin", handle: "sophiemartin", title: "Entertainment Editor", country: "France", countryCode: "FR" },
  { name: "Alex Kim", handle: "alexkim", title: "Data Scientist", country: "US", countryCode: "US" },
];

// ─── Post Templates by Category ─────────────────────────────────────────────

interface PostTemplate {
  content: string;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  hoursAgo: number; // how many hours ago to set createdAt
  authorIndex: number; // index into SEED_USERS
}

function generatePosts(): PostTemplate[] {
  const posts: PostTemplate[] = [];

  // ─── AI & Technology (high engagement, many posts) ───
  const aiPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "OpenAI just released GPT-5 and the benchmarks are staggering. We're seeing 40% improvement in reasoning tasks compared to GPT-4. The gap between AI and human cognition is narrowing faster than anyone predicted. #AI #Technology #Innovation", tags: ["AI", "Technology", "Innovation"], likesCount: 245, commentsCount: 89, sharesCount: 67, viewsCount: 12400 },
    { content: "Just deployed our first production LLM pipeline. The key insight: fine-tuning on domain-specific data beats prompt engineering every time. RAG is good but nothing replaces targeted training data. #AI #MachineLearning #Engineering", tags: ["AI", "MachineLearning", "Engineering"], likesCount: 178, commentsCount: 42, sharesCount: 31, viewsCount: 8900 },
    { content: "The real AI revolution isn't chatbots. It's the thousands of companies quietly automating their back-office operations. Invoice processing, compliance checks, customer routing — boring but transformative. #AI #Business #Automation", tags: ["AI", "Business", "Automation"], likesCount: 312, commentsCount: 97, sharesCount: 85, viewsCount: 15600 },
    { content: "Interesting trend: AI startups are pivoting from horizontal platforms to vertical solutions. Healthcare AI, Legal AI, Construction AI — the money is in domain expertise, not general intelligence. #AI #Startup #Technology", tags: ["AI", "Startup", "Technology"], likesCount: 156, commentsCount: 34, sharesCount: 28, viewsCount: 7800 },
    { content: "Just published our research on multimodal learning. Combining vision, language, and audio in a single architecture. Early results show emergent capabilities we didn't train for. Paper link in bio. #AI #Research #DeepLearning", tags: ["AI", "Research", "DeepLearning"], likesCount: 423, commentsCount: 156, sharesCount: 112, viewsCount: 21500 },
    { content: "Hot take: most companies don't need AI. They need better data infrastructure. I've seen dozens of AI projects fail because the underlying data was garbage. Fix your data pipeline first. #AI #Technology #Data", tags: ["AI", "Technology", "Data"], likesCount: 567, commentsCount: 234, sharesCount: 189, viewsCount: 28400 },
    { content: "The EU AI Act is going to reshape the industry. Companies building AI need to start thinking about explainability, bias audits, and risk classification NOW. Compliance deadline is closer than you think. #AI #Regulation #Technology", tags: ["AI", "Regulation", "Technology"], likesCount: 134, commentsCount: 78, sharesCount: 45, viewsCount: 6700 },
  ];
  aiPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 3 + 1, authorIndex: [0, 2, 4, 14, 0, 5, 2][i] }));

  // ─── Business & Startups ───
  const bizPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Raised our Series B at $80M valuation. The key wasn't the product — it was proving unit economics at scale. Revenue per employee matters more than growth rate at this stage. #Startup #Business #Fundraising", tags: ["Startup", "Business", "Fundraising"], likesCount: 389, commentsCount: 112, sharesCount: 76, viewsCount: 19500 },
    { content: "After 3 years of building, our B2B SaaS hit $10M ARR. The inflection point came when we stopped chasing enterprise deals and focused on mid-market. Faster sales cycles, better retention. #Business #SaaS #Growth", tags: ["Business", "SaaS", "Growth"], likesCount: 267, commentsCount: 89, sharesCount: 54, viewsCount: 13400 },
    { content: "The startup graveyard is full of companies that scaled too fast. Hiring 50 people before product-market fit is the most common mistake I see as an investor. Build lean, validate hard. #Startup #Entrepreneurship", tags: ["Startup", "Entrepreneurship"], likesCount: 445, commentsCount: 167, sharesCount: 123, viewsCount: 22300 },
    { content: "Remote work isn't dying. It's evolving. Companies forcing return-to-office are losing their best talent to competitors who understand that productivity isn't about proximity. #Business #RemoteWork #Leadership", tags: ["Business", "RemoteWork", "Leadership"], likesCount: 678, commentsCount: 312, sharesCount: 234, viewsCount: 34000 },
    { content: "Just closed our first acquisition. Buying a competitor is cheaper than outspending them on marketing. If you can integrate their team and customers, M&A is the fastest growth lever. #Business #Startup #Strategy", tags: ["Business", "Startup", "Strategy"], likesCount: 198, commentsCount: 67, sharesCount: 34, viewsCount: 9900 },
  ];
  bizPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 4 + 2, authorIndex: [1, 3, 1, 4, 3][i] }));

  // ─── Finance & Investing ───
  const financePosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Federal Reserve signals potential rate cut in September. Markets rallied but the real question is whether corporate earnings can sustain these valuations. P/E ratios are historically stretched. #Finance #Markets #Economy", tags: ["Finance", "Markets", "Economy"], likesCount: 234, commentsCount: 89, sharesCount: 56, viewsCount: 11700 },
    { content: "The IPO market is heating up again. Three unicorns filed S-1s this week. After two years of drought, public markets are finally receptive to growth stories — but only with clear paths to profitability. #Finance #IPO #Investing", tags: ["Finance", "IPO", "Investing"], likesCount: 178, commentsCount: 45, sharesCount: 32, viewsCount: 8900 },
    { content: "Unpopular opinion: index funds are creating a bubble. When everyone buys the same basket, price discovery breaks down. We're in for a reckoning when passive flows reverse. #Finance #Investing #Markets", tags: ["Finance", "Investing", "Markets"], likesCount: 567, commentsCount: 234, sharesCount: 156, viewsCount: 28400 },
    { content: "Central banks are exploring CBDCs more seriously than ever. 130 countries are now in some stage of CBDC development. This could fundamentally reshape how money works. #Finance #CBDC #DigitalCurrency", tags: ["Finance", "CBDC", "DigitalCurrency"], likesCount: 145, commentsCount: 56, sharesCount: 34, viewsCount: 7300 },
    { content: "Private credit is the hottest asset class of 2026. Banks pulling back from lending has created a massive opportunity for non-bank lenders. Returns are 12-15% with manageable risk. #Finance #PrivateCredit #Investing", tags: ["Finance", "PrivateCredit", "Investing"], likesCount: 289, commentsCount: 78, sharesCount: 45, viewsCount: 14500 },
  ];
  financePosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 5 + 1, authorIndex: [6, 3, 6, 12, 3][i] }));

  // ─── Marketing & Growth ───
  const marketingPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Short-form video isn't just for B2C anymore. Our B2B LinkedIn videos are generating 3x more qualified leads than blog posts. The algorithm rewards native video content heavily. #Marketing #ContentStrategy #Growth", tags: ["Marketing", "ContentStrategy", "Growth"], likesCount: 345, commentsCount: 123, sharesCount: 89, viewsCount: 17300 },
    { content: "Email marketing has the highest ROI of any channel — $36 for every $1 spent. Yet most companies treat it as an afterthought. Segmentation and personalization are the keys. #Marketing #Email #Business", tags: ["Marketing", "Email", "Business"], likesCount: 234, commentsCount: 67, sharesCount: 45, viewsCount: 11700 },
    { content: "The death of third-party cookies is forcing a first-party data revolution. Companies that invested in CRM and owned audiences are now at a massive advantage. Build your own data moat. #Marketing #Privacy #Data", tags: ["Marketing", "Privacy", "Data"], likesCount: 189, commentsCount: 56, sharesCount: 34, viewsCount: 9500 },
    { content: "Influencer marketing is maturing. Micro-influencers (10k-50k followers) deliver 60% higher engagement rates than macro-influencers. Authenticity beats reach every time. #Marketing #Influencer #SocialMedia", tags: ["Marketing", "Influencer", "SocialMedia"], likesCount: 412, commentsCount: 145, sharesCount: 98, viewsCount: 20600 },
  ];
  marketingPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 6 + 3, authorIndex: [4, 4, 14, 1][i] }));

  // ─── Politics & Policy ───
  const politicsPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "The 2026 midterms are reshaping policy priorities. Both parties are now competing on industrial policy — who can bring more manufacturing jobs home. Bipartisan consensus on reshoring is real. #Politics #Economy #Policy", tags: ["Politics", "Economy", "Policy"], likesCount: 456, commentsCount: 234, sharesCount: 167, viewsCount: 22800 },
    { content: "Data privacy legislation is moving fast globally. The EU, US, India, and Brazil all have different frameworks creating a compliance nightmare for global companies. Harmonization is desperately needed. #Politics #Privacy #Technology", tags: ["Politics", "Privacy", "Technology"], likesCount: 178, commentsCount: 89, sharesCount: 56, viewsCount: 8900 },
    { content: "The geopolitics of semiconductors is the most important tech story nobody talks about enough. CHIPS Act investments are bearing fruit but the talent gap remains critical. #Politics #Technology #Semiconductors", tags: ["Politics", "Technology", "Semiconductors"], likesCount: 234, commentsCount: 78, sharesCount: 45, viewsCount: 11700 },
    { content: "Climate policy is entering a new phase. Carbon border taxes are becoming reality in the EU and other regions are following. This will reshape global trade patterns for decades. #Politics #Climate #Trade", tags: ["Politics", "Climate", "Trade"], likesCount: 312, commentsCount: 134, sharesCount: 89, viewsCount: 15600 },
  ];
  politicsPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 5 + 4, authorIndex: [2, 5, 2, 9][i] }));

  // ─── Sports ───
  const sportsPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "The Premier League's new broadcast deal is worth $8.4B. Sports rights are the last moat in traditional media. Every streaming service wants live sports because nothing else drives appointment viewing. #Sports #Media #Business", tags: ["Sports", "Media", "Business"], likesCount: 345, commentsCount: 123, sharesCount: 78, viewsCount: 17300 },
    { content: "Data analytics is transforming player scouting. Clubs using advanced metrics are finding undervalued talent in leagues nobody watches. Moneyball has fully arrived in football. #Sports #Analytics #Technology", tags: ["Sports", "Analytics", "Technology"], likesCount: 234, commentsCount: 89, sharesCount: 56, viewsCount: 11700 },
    { content: "The Olympics just announced esports will be included in the 2028 LA games. This legitimizes competitive gaming as a sport and opens massive sponsorship opportunities. #Sports #Esports #Gaming", tags: ["Sports", "Esports", "Gaming"], likesCount: 567, commentsCount: 234, sharesCount: 189, viewsCount: 28400 },
    { content: "Sports betting revenue hit $15B in the US this year. The integration of live odds into broadcast is changing how fans watch games. Regulatory frameworks are still catching up. #Sports #Betting #Business", tags: ["Sports", "Betting", "Business"], likesCount: 289, commentsCount: 98, sharesCount: 67, viewsCount: 14500 },
  ];
  sportsPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 4 + 2, authorIndex: [7, 7, 13, 7][i] }));

  // ─── Entertainment ───
  const entertainmentPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Streaming wars are over. The winner is bundling. Every major platform is now offering bundles because churn is killing unit economics. We've come full circle back to cable packages. #Entertainment #Streaming #Media", tags: ["Entertainment", "Streaming", "Media"], likesCount: 456, commentsCount: 178, sharesCount: 134, viewsCount: 22800 },
    { content: "AI-generated music is creating a copyright crisis. Who owns a song created by AI trained on copyrighted material? The courts are about to reshape creative industries. #Entertainment #AI #Music", tags: ["Entertainment", "AI", "Music"], likesCount: 345, commentsCount: 156, sharesCount: 98, viewsCount: 17300 },
    { content: "The creator economy has matured into a $250B industry. Top creators are building media empires that rival traditional studios. The power shift from institutions to individuals is accelerating. #Entertainment #Creator #Business", tags: ["Entertainment", "Creator", "Business"], likesCount: 389, commentsCount: 134, sharesCount: 89, viewsCount: 19500 },
    { content: "Virtual production using LED volumes is now standard for mid-budget films. What was exotic technology 5 years ago is now cheaper than location shooting. Hollywood's infrastructure is being rebuilt. #Entertainment #Technology #Film", tags: ["Entertainment", "Technology", "Film"], likesCount: 178, commentsCount: 56, sharesCount: 34, viewsCount: 8900 },
  ];
  entertainmentPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 6 + 1, authorIndex: [13, 13, 1, 5][i] }));

  // ─── Science ───
  const sciencePosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "CRISPR gene therapy just received FDA approval for sickle cell disease. We're witnessing the beginning of a new era in medicine. The first generation of genetic diseases we can actually cure. #Science #Biotech #Health", tags: ["Science", "Biotech", "Health"], likesCount: 678, commentsCount: 234, sharesCount: 189, viewsCount: 34000 },
    { content: "The James Webb telescope found organic molecules in an exoplanet atmosphere. This doesn't prove life exists elsewhere but it dramatically narrows the search parameters. #Science #Space #Research", tags: ["Science", "Space", "Research"], likesCount: 890, commentsCount: 345, sharesCount: 267, viewsCount: 45000 },
    { content: "Fusion energy milestone: sustained plasma for 6 minutes. Commercial fusion is still a decade away but we're solving engineering problems that physicists said were impossible. #Science #Energy #Climate", tags: ["Science", "Energy", "Climate"], likesCount: 567, commentsCount: 198, sharesCount: 156, viewsCount: 28400 },
    { content: "New research shows microplastics are found in every human organ tested. The health implications are still being studied but the ubiquity of contamination is alarming. We need better materials science. #Science #Health #Environment", tags: ["Science", "Health", "Environment"], likesCount: 345, commentsCount: 167, sharesCount: 123, viewsCount: 17300 },
  ];
  sciencePosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 7 + 2, authorIndex: [8, 0, 9, 8][i] }));

  // ─── Health ───
  const healthPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Telemedicine usage has stabilized at 3x pre-pandemic levels. It's not replacing in-person care — it's augmenting it. The hybrid model is the future of healthcare delivery. #Health #Telemedicine #Technology", tags: ["Health", "Telemedicine", "Technology"], likesCount: 234, commentsCount: 89, sharesCount: 56, viewsCount: 11700 },
    { content: "GLP-1 drugs like Ozempic are reshaping healthcare economics. The cost implications are staggering — if even 10% of eligible patients get treatment, it could bankrupt insurance systems. #Health #Pharma #Business", tags: ["Health", "Pharma", "Business"], likesCount: 456, commentsCount: 198, sharesCount: 134, viewsCount: 22800 },
    { content: "Mental health apps have a retention problem. 90% of users churn within 30 days. The technology works but engagement models from social media don't translate to therapeutic contexts. #Health #MentalHealth #Technology", tags: ["Health", "MentalHealth", "Technology"], likesCount: 289, commentsCount: 123, sharesCount: 78, viewsCount: 14500 },
    { content: "Wearable health data is becoming admissible in clinical trials. Apple Watch and similar devices are generating continuous health data that could accelerate drug development timelines by years. #Health #Wearables #Research", tags: ["Health", "Wearables", "Research"], likesCount: 178, commentsCount: 56, sharesCount: 34, viewsCount: 8900 },
  ];
  healthPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 5 + 3, authorIndex: [8, 8, 10, 0][i] }));

  // ─── Education ───
  const educationPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Universities are restructuring around AI. Programming courses now teach AI-assisted coding rather than pure syntax. The skill is knowing what to build, not how to type it. #Education #AI #Technology", tags: ["Education", "AI", "Technology"], likesCount: 345, commentsCount: 134, sharesCount: 89, viewsCount: 17300 },
    { content: "Micro-credentials are replacing traditional degrees for mid-career professionals. Companies like Google and IBM now accept certification programs as equivalent to bachelor's degrees. #Education #Career #Business", tags: ["Education", "Career", "Business"], likesCount: 234, commentsCount: 89, sharesCount: 67, viewsCount: 11700 },
    { content: "The EdTech bubble has burst but the survivors are thriving. Companies that focused on outcomes over engagement are seeing sustainable growth. Learning platforms need to prove ROI. #Education #EdTech #Startup", tags: ["Education", "EdTech", "Startup"], likesCount: 189, commentsCount: 67, sharesCount: 45, viewsCount: 9500 },
  ];
  educationPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 8 + 4, authorIndex: [10, 10, 14][i] }));

  // ─── Travel & Lifestyle ───
  const travelPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Sustainable travel is no longer a niche. Airlines are investing billions in sustainable aviation fuel. Hotels are eliminating single-use plastics. The industry is transforming from the inside. #Travel #Sustainability #Climate", tags: ["Travel", "Sustainability", "Climate"], likesCount: 234, commentsCount: 78, sharesCount: 56, viewsCount: 11700 },
    { content: "Digital nomad visas are now offered by 50+ countries. Portugal, Estonia, and Thailand lead in infrastructure for remote workers. The future of work is borderless. #Travel #RemoteWork #Lifestyle", tags: ["Travel", "RemoteWork", "Lifestyle"], likesCount: 456, commentsCount: 189, sharesCount: 134, viewsCount: 22800 },
    { content: "Experiential travel is killing traditional tourism. Travelers want cooking classes in Oaxaca, not all-inclusive resorts. The shift from consumption to experience is reshaping the $9T travel industry. #Travel #Lifestyle #Business", tags: ["Travel", "Lifestyle", "Business"], likesCount: 312, commentsCount: 123, sharesCount: 89, viewsCount: 15600 },
  ];
  travelPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 6 + 5, authorIndex: [11, 11, 4][i] }));

  // ─── Crypto & Web3 ───
  const cryptoPosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Bitcoin ETFs have accumulated $50B in assets in under a year. Institutional adoption is no longer speculative — it's happening. The narrative has shifted from 'if' to 'how much'. #Crypto #Bitcoin #Finance", tags: ["Crypto", "Bitcoin", "Finance"], likesCount: 567, commentsCount: 234, sharesCount: 178, viewsCount: 28400 },
    { content: "Real-world asset tokenization is the sleeper hit of blockchain. Tokenized treasuries, real estate, and commodities are creating trillion-dollar opportunities. DeFi is going mainstream. #Crypto #DeFi #Finance", tags: ["Crypto", "DeFi", "Finance"], likesCount: 345, commentsCount: 123, sharesCount: 89, viewsCount: 17300 },
    { content: "Layer 2 solutions have finally made blockchain usable. Transaction costs on Ethereum L2s are under $0.01. The scalability problem is solved — now we need killer apps. #Crypto #Blockchain #Technology", tags: ["Crypto", "Blockchain", "Technology"], likesCount: 234, commentsCount: 89, sharesCount: 56, viewsCount: 11700 },
    { content: "The regulatory clarity around crypto is actually bullish. Clear rules attract institutional capital. The uncertainty was worse than any regulation could be. #Crypto #Regulation #Finance", tags: ["Crypto", "Regulation", "Finance"], likesCount: 189, commentsCount: 67, sharesCount: 45, viewsCount: 9500 },
  ];
  cryptoPosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 4 + 1, authorIndex: [12, 12, 5, 6][i] }));

  // ─── Climate & Energy ───
  const climatePosts: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Solar energy is now the cheapest form of electricity in history. The learning curve continues — every doubling of capacity drops costs by 20%. Fossil fuels cannot compete on economics alone. #Climate #Energy #Sustainability", tags: ["Climate", "Energy", "Sustainability"], likesCount: 456, commentsCount: 178, sharesCount: 134, viewsCount: 22800 },
    { content: "Carbon capture technology is scaling faster than expected. Direct air capture costs dropped from $600/ton to $250/ton in 3 years. Still expensive but the trajectory is promising. #Climate #Technology #Science", tags: ["Climate", "Technology", "Science"], likesCount: 345, commentsCount: 123, sharesCount: 89, viewsCount: 17300 },
    { content: "Electric vehicle adoption hit 25% of new car sales globally. The tipping point is here. Battery costs are falling, charging infrastructure is expanding, and range anxiety is fading. #Climate #EV #Technology", tags: ["Climate", "EV", "Technology"], likesCount: 567, commentsCount: 234, sharesCount: 167, viewsCount: 28400 },
    { content: "Green hydrogen could decarbonize industries that electrification can't reach — steel, cement, shipping. The cost premium is shrinking and policy support is growing. #Climate #Energy #Business", tags: ["Climate", "Energy", "Business"], likesCount: 234, commentsCount: 89, sharesCount: 56, viewsCount: 11700 },
  ];
  climatePosts.forEach((p, i) => posts.push({ ...p, hoursAgo: i * 5 + 2, authorIndex: [9, 9, 5, 9][i] }));

  // ─── Additional cross-category posts for velocity signal ───
  // Recent posts (within 1-2 hours) to create velocity spikes
  const recentSpikes: Omit<PostTemplate, "hoursAgo" | "authorIndex">[] = [
    { content: "Breaking: Major AI lab announces breakthrough in reasoning. Their new model can solve PhD-level math problems that stumped previous systems. The pace of progress is accelerating. #AI #Research #Technology", tags: ["AI", "Research", "Technology"], likesCount: 890, commentsCount: 345, sharesCount: 267, viewsCount: 45000 },
    { content: "Just in: Record venture funding in Q3 2026. AI companies captured 40% of all VC dollars. The concentration is unprecedented and raising questions about portfolio diversification. #Startup #Finance #AI", tags: ["Startup", "Finance", "AI"], likesCount: 456, commentsCount: 178, sharesCount: 134, viewsCount: 22800 },
    { content: "The crypto market just crossed $3T in total market cap. Bitcoin above $100K feels different this time — institutional holdings are at all-time highs. #Crypto #Finance #Markets", tags: ["Crypto", "Finance", "Markets"], likesCount: 678, commentsCount: 267, sharesCount: 198, viewsCount: 34000 },
    { content: "Climate summit announces binding commitments for methane reduction. 80 countries signed the agreement. This could have more impact than CO2 targets given methane's potency. #Climate #Politics #Science", tags: ["Climate", "Politics", "Science"], likesCount: 345, commentsCount: 134, sharesCount: 98, viewsCount: 17300 },
  ];
  recentSpikes.forEach((p, i) => posts.push({ ...p, hoursAgo: 0.5 + i * 0.3, authorIndex: [0, 3, 12, 9][i] }));

  return posts;
}

// ─── Main Seed Function ──────────────────────────────────────────────────────

async function main() {
  console.log("Seeding trending content...\n");

  // Clean up any previous seed data
  console.log("  Cleaning up previous seed data...");
  await prisma.postLike.deleteMany({ where: { post: { slug: { startsWith: "seed-" } } } });
  await prisma.postComment.deleteMany({ where: { post: { slug: { startsWith: "seed-" } } } });
  await prisma.postShareEvent.deleteMany({ where: { post: { slug: { startsWith: "seed-" } } } });
  await prisma.post.deleteMany({ where: { slug: { startsWith: "seed-" } } });

  // Check for existing admin user
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const adminId = existingAdmin?.id ?? 1;
  console.log(`  Admin user ID: ${adminId}`);

  // 1. Create seed users (skip if they already exist)
  console.log("  Creating seed users...");
  const userIds: number[] = [];
  for (const u of SEED_USERS) {
    const existing = await prisma.user.findFirst({ where: { handle: u.handle } });
    if (existing) {
      userIds.push(existing.id);
      continue;
    }
    const user = await prisma.user.create({
      data: {
        name: u.name,
        handle: u.handle,
        email: `${u.handle}@example.com`,
        password: "seed-user-no-login",
        title: u.title,
        country: u.country,
        countryCode: u.countryCode,
        bio: `${u.title} sharing insights on industry trends.`,
        avatar: "",
        verified: Math.random() > 0.4,
        joinedDate: "January 2025",
        followers: String(Math.floor(Math.random() * 5000) + 500),
        followingCount: String(Math.floor(Math.random() * 300) + 50),
      },
    });
    userIds.push(user.id);
  }
  console.log(`  Created/found ${userIds.length} users`);

  // 2. Create posts
  console.log("  Creating posts with hashtags...");
  const templates = generatePosts();
  const now = Date.now();
  const createdPostIds: number[] = [];

  for (const tpl of templates) {
    const userId = userIds[tpl.authorIndex];
    const createdAt = new Date(now - tpl.hoursAgo * 3_600_000);
    const slug = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const post = await prisma.post.create({
      data: {
        userId,
        type: "POST",
        content: tpl.content,
        tags: tpl.tags,
        status: "published",
        likesCount: tpl.likesCount,
        commentsCount: tpl.commentsCount,
        sharesCount: tpl.sharesCount,
        viewsCount: tpl.viewsCount,
        likes: String(tpl.likesCount),
        comments: String(tpl.commentsCount),
        shares: String(tpl.sharesCount),
        views: String(tpl.viewsCount),
        date: createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        countryCode: SEED_USERS[tpl.authorIndex].countryCode,
        slug,
        createdAt,
        contentScope: "GLOBAL",
      },
    });
    createdPostIds.push(post.id);
  }
  console.log(`  Created ${createdPostIds.length} posts`);

  // 3. Batch-create engagement records (likes, comments, shares)
  console.log("  Creating engagement records (batch)...");
  const commentTexts = [
    "Great insight, thanks for sharing this perspective.",
    "This is exactly what the industry needs to hear right now.",
    "Interesting take. I'd add that the timing matters a lot here.",
    "The data supports this. We're seeing similar trends in our research.",
    "This changed how I think about the space. Well articulated.",
  ];

  const allLikes: { postId: number; userId: number; createdAt: Date }[] = [];
  const allComments: { postId: number; userId: number; text: string; createdAt: Date }[] = [];
  const allShares: { postId: number; userId: number; createdAt: Date }[] = [];

  const seenLikes = new Set<string>();

  for (let i = 0; i < createdPostIds.length; i++) {
    const postId = createdPostIds[i];
    const tpl = templates[i];
    const postCreatedAt = new Date(now - tpl.hoursAgo * 3_600_000);

    // Likes (cap at 10 per post, deduplicated)
    const likerIndices = shuffleAndTake(
      Array.from({ length: userIds.length }, (_, j) => j),
      Math.min(tpl.likesCount, 10)
    );
    for (const li of likerIndices) {
      const key = `${postId}-${userIds[li]}`;
      if (seenLikes.has(key)) continue;
      seenLikes.add(key);
      allLikes.push({
        postId,
        userId: userIds[li],
        createdAt: new Date(postCreatedAt.getTime() + Math.random() * (now - postCreatedAt.getTime())),
      });
    }

    // Comments (cap at 3 per post)
    for (let c = 0; c < Math.min(tpl.commentsCount, 3); c++) {
      allComments.push({
        postId,
        userId: userIds[(tpl.authorIndex + c + 1) % userIds.length],
        text: commentTexts[c % commentTexts.length],
        createdAt: new Date(postCreatedAt.getTime() + Math.random() * (now - postCreatedAt.getTime())),
      });
    }

    // Shares (cap at 2 per post)
    for (let s = 0; s < Math.min(tpl.sharesCount, 2); s++) {
      allShares.push({
        postId,
        userId: userIds[(tpl.authorIndex + s + 2) % userIds.length],
        createdAt: new Date(postCreatedAt.getTime() + Math.random() * (now - postCreatedAt.getTime())),
      });
    }
  }

  await prisma.postLike.createMany({ data: allLikes, skipDuplicates: true });
  await prisma.postComment.createMany({ data: allComments });
  await prisma.postShareEvent.createMany({ data: allShares });
  console.log(`  Created ${allLikes.length} likes, ${allComments.length} comments, ${allShares.length} shares`);

  // 4. Clear any stale trending caches and computed scores
  console.log("  Clearing stale trending data...");
  await prisma.trendingTopicScore.deleteMany();
  await prisma.trendingScore.deleteMany();

  // Print summary
  console.log("\n─── Seed Summary ───");
  console.log(`  Users:    ${userIds.length}`);
  console.log(`  Posts:    ${createdPostIds.length}`);
  console.log(`  Likes:    ${allLikes.length}`);
  console.log(`  Comments: ${allComments.length}`);
  console.log(`  Shares:   ${allShares.length}`);

  // Count tags
  const tagCounts = new Map<string, number>();
  for (const tpl of templates) {
    for (const tag of tpl.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  console.log(`\n  Hashtag distribution:`);
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    console.log(`    #${tag}: ${count} posts`);
  }

  console.log("\nSeeding complete! Run the trending pipeline to compute scores.");
}

function shuffleAndTake<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
