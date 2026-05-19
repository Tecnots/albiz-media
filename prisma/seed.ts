import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clear existing data in reverse dependency order
  await prisma.userFollow.deleteMany();
  await prisma.userCustomTab.deleteMany();
  await prisma.userInterest.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.userEducation.deleteMany();
  await prisma.userExperience.deleteMany();
  await prisma.message.deleteMany();
  await prisma.savedPost.deleteMany();
  await prisma.articleContent.deleteMany();
  await prisma.circlePost.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
  await prisma.circleMember.deleteMany();
  await prisma.trendingTopic.deleteMany();
  await prisma.savedCollection.deleteMany();
  await prisma.contentTopic.deleteMany();
  await prisma.analyticsStat.deleteMany();
  await prisma.viewOverTime.deleteMany();
  await prisma.topPost.deleteMany();
  await prisma.quickSnapshot.deleteMany();
  await prisma.accountSetting.deleteMany();
  await prisma.languageRegionSetting.deleteMany();

  // ─── Users ───
  console.log("  Seeding users...");

  const now = new Date();
  // Circle Users — full access: messaging, profile page, circle features
  await prisma.user.createMany({
    data: [
      {
        id: 1, name: "Jessin Sam S", handle: "jessinsam", email: "jessinsam@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Founder @ Example.com", avatar: "/Jess-profile.jpg",
        role: "CIRCLE", verified: true, isPremium: true, hasStory: true,
        bio: "Building the future of business connections. Passionate about startups, technology, and making meaningful connections.",
        location: "San Francisco, CA", website: "example.com",
        coverPhoto: "https://picsum.photos/seed/cover-jessin/1200/400",
        joinedDate: "January 2023", followers: "150k", followingCount: "1500",
      },
      {
        id: 2, name: "Open AI", handle: "openai", email: "openai@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "ChatGPT Creators", avatar: "https://picsum.photos/seed/openai/200",
        role: "CIRCLE", verified: true, hasStory: true,
        bio: "Creating safe AGI that benefits all of humanity.",
        location: "San Francisco, CA", website: "openai.com",
        coverPhoto: "https://picsum.photos/seed/cover-openai/1200/400",
        joinedDate: "March 2023", followers: "2.8M", followingCount: "42",
      },
      {
        id: 3, name: "Nikhil Kamath", handle: "nikhilkamath", email: "nikhilkamath@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Investor & Entrepreneur", avatar: "https://picsum.photos/seed/nikhil/200",
        role: "CIRCLE", verified: true, hasStory: true,
        bio: "Co-founder of Zerodha & True Beacon. Investing in India's future.",
        location: "Bangalore, India", website: "zerodha.com",
        coverPhoto: "https://picsum.photos/seed/cover-nikhil/1200/400",
        joinedDate: "February 2023", followers: "890k", followingCount: "320",
      },
      {
        id: 4, name: "Elon Musk", handle: "elonmusk", email: "elonmusk@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "CEO @ Tesla, SpaceX", avatar: "https://picsum.photos/seed/elon/200",
        role: "CIRCLE", verified: true, hasStory: true,
        bio: "Mars, Cars, Stars. Making life multiplanetary.",
        location: "Austin, TX", website: "tesla.com",
        coverPhoto: "https://picsum.photos/seed/cover-elon/1200/400",
        joinedDate: "January 2023", followers: "5.2M", followingCount: "180",
      },
      {
        id: 6, name: "Y Combinator", handle: "ycombinator", email: "ycombinator@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Help founders make something...", avatar: "https://picsum.photos/seed/yc/200",
        role: "CIRCLE", verified: true, hasStory: true,
        bio: "The most successful startup accelerator in the world. Backed 5,000+ startups.",
        location: "Mountain View, CA", website: "ycombinator.com",
        coverPhoto: "https://picsum.photos/seed/cover-yc/1200/400",
        joinedDate: "January 2023", followers: "1.1M", followingCount: "250",
      },
      {
        id: 7, name: "Satya Nadella", handle: "satyanadella", email: "satyanadella@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Chairman and CEO at Microsoft", avatar: "https://picsum.photos/seed/satya/200",
        role: "CIRCLE", verified: true,
        bio: "Chairman and CEO at Microsoft. Believer in empowering every person and organization on the planet.",
        location: "Redmond, WA", website: "microsoft.com",
        coverPhoto: "https://picsum.photos/seed/cover-satya/1200/400",
        joinedDate: "March 2023", followers: "3.4M", followingCount: "95",
      },
      {
        id: 8, name: "Aadit Palicha", handle: "aaditpalicha", email: "aaditpalicha@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Co-founder/CEO @ZeptoNow", avatar: "https://picsum.photos/seed/aadit/200",
        role: "CIRCLE", verified: true, hasStory: true,
        bio: "Building India's fastest delivery platform. Stanford dropout. Forbes 30 Under 30.",
        location: "Mumbai, India", website: "zeptonow.com",
        coverPhoto: "https://picsum.photos/seed/cover-aadit/1200/400",
        joinedDate: "April 2023", followers: "420k", followingCount: "280",
      },

      // Normal Users — can follow/like but no messaging or profile page
      {
        id: 5, name: "Donald J. Trump", handle: "realdonaldtrump", email: "realdonaldtrump@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "US President 2026", avatar: "https://picsum.photos/seed/trump/200",
        role: "NORMAL", verified: true,
        joinedDate: "June 2023", followers: "4.1M", followingCount: "45",
      },
      {
        id: 9, name: "Priya Sharma", handle: "priyasharma", email: "priyasharma@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Product Designer @ Figma", avatar: "https://picsum.photos/seed/priya-s/200",
        role: "NORMAL", verified: false,
        joinedDate: "August 2024", followers: "2.4k", followingCount: "450",
      },
      {
        id: 10, name: "Alex Chen", handle: "alexchen", email: "alexchen@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Full-Stack Developer", avatar: "https://picsum.photos/seed/alex-c/200",
        role: "NORMAL", verified: false,
        joinedDate: "November 2024", followers: "890", followingCount: "320",
      },
      {
        id: 11, name: "Sarah Johnson", handle: "sarahjohnson", email: "sarahjohnson@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Marketing Lead @ Shopify", avatar: "https://picsum.photos/seed/sarah-j/200",
        role: "NORMAL", verified: false,
        joinedDate: "January 2025", followers: "5.1k", followingCount: "680",
      },
      {
        id: 12, name: "Raj Patel", handle: "rajpatel", email: "rajpatel@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Startup Founder & Investor", avatar: "https://picsum.photos/seed/raj-p/200",
        role: "NORMAL", verified: false,
        joinedDate: "March 2025", followers: "1.2k", followingCount: "510",
      },

      // Admin
      {
        id: 13, name: "Albiz Admin", handle: "albizadmin", email: "support@tecnots.com", password: "C0mplex@#408", emailVerified: now,
        title: "Platform Administrator", avatar: "https://picsum.photos/seed/admin-albiz/200",
        role: "ADMIN", verified: true, isPremium: true,
        bio: "Albiz platform administration and support.",
        location: "San Francisco, CA",
        joinedDate: "January 2023", followers: "0", followingCount: "0",
      },

      // Author Invited
      {
        id: 14, name: "Maya Johnson", handle: "mayajohnson", email: "author@demo.albiz.com", password: "demo123", emailVerified: now,
        title: "Invited Author & Tech Writer", avatar: "https://picsum.photos/seed/maya-author/200",
        role: "AUTHOR", verified: true, hasStory: true,
        bio: "Tech writer and invited content creator. Covering startups, AI, and the future of work.",
        location: "New York, NY", website: "mayawrites.com",
        coverPhoto: "https://picsum.photos/seed/cover-maya/1200/400",
        joinedDate: "October 2024", followers: "12k", followingCount: "340",
      },
    ],
  });

  // ─── Posts ───
  console.log("  Seeding posts...");
  await prisma.post.createMany({
    data: [
      { id: 1, userId: 2, type: "POST", content: "Happy to share that Example.com has secured $10M from the top investors. Thank you all for being a part of it.", date: "Dec 12th 2025", time: "1:56 PM", image: "https://picsum.photos/seed/funding-announce/800/500", tags: ["Business", "Startups"], views: "1k", likes: "1k", comments: "1k", shares: "1k" },
      { id: 2, userId: 1, type: "ARTICLE", title: "Donald Trump reminds the entire world he has no idea what 6G means", description: "When business leaders spout buzzwords like \"AI,\" \"8K\" and \"5G,\" sometimes in the same sentence, we often get a sneaking suspicion they don't know what they mean!", tags: ["News", "Policy", "Tech"], date: "Dec 12th 2025", image: "https://picsum.photos/seed/trump-article/400/300", views: "2.3k", likes: "1.2k", comments: "342", shares: "89" },
      { id: 3, userId: 2, type: "ARTICLE", title: "OpenAI announces GPT-5: The most capable AI model yet", description: "The new model shows unprecedented reasoning capabilities and can now handle complex multi-step tasks with human-like accuracy.", tags: ["AI", "Technology", "News"], date: "Dec 12th 2025", image: "https://picsum.photos/seed/gpt5-announce/400/300", views: "45k", likes: "32k", comments: "5.2k", shares: "12k" },
      { id: 4, userId: 3, type: "POST", content: "The best time to start investing was yesterday. The second best time is today. Start small, stay consistent.", date: "Dec 11th 2025", time: "10:30 AM", tags: ["Finance", "Investing"], views: "5.2k", likes: "2.1k", comments: "456", shares: "234" },
      { id: 5, userId: 4, type: "ARTICLE", title: "SpaceX Starship completes first successful orbital flight", description: "After years of development and testing, SpaceX has achieved a major milestone in space exploration.", tags: ["Technology", "Space", "News"], date: "Dec 10th 2025", image: "https://picsum.photos/seed/spacex/400/300", views: "12k", likes: "8.5k", comments: "1.2k", shares: "3.4k" },
      { id: 6, userId: 6, type: "POST", content: "Applications for YC Winter 2026 batch are now open. Apply now at ycombinator.com/apply", date: "Dec 9th 2025", time: "2:00 PM", tags: ["Startups", "Business"], views: "8.3k", likes: "3.2k", comments: "892", shares: "1.5k" },
      { id: 7, userId: 7, type: "ARTICLE", title: "Microsoft unveils next-gen AI chips to compete with Nvidia", description: "The tech giant is betting big on custom silicon to power its Azure AI infrastructure and reduce dependency on third-party hardware.", tags: ["Technology", "AI", "Business"], date: "Dec 8th 2025", image: "https://picsum.photos/seed/ms-chips/400/300", views: "15k", likes: "6.7k", comments: "1.1k", shares: "2.3k" },
      { id: 8, userId: 8, type: "ARTICLE", title: "Zepto becomes India's fastest unicorn with $5B valuation", description: "The quick commerce startup has disrupted the grocery delivery market with 10-minute deliveries across major Indian cities.", tags: ["News", "Business", "Startups"], date: "Dec 7th 2025", image: "https://picsum.photos/seed/zepto-unicorn/400/300", views: "22k", likes: "11k", comments: "2.3k", shares: "4.1k" },
      { id: 9, userId: 4, type: "ARTICLE", title: "Tesla's Optimus robot begins factory trials", description: "The humanoid robot is now performing basic assembly tasks at Tesla's Fremont factory, marking a new era in manufacturing automation.", tags: ["Technology", "AI", "News"], date: "Dec 6th 2025", image: "https://picsum.photos/seed/optimus-robot/400/300", views: "35k", likes: "18k", comments: "3.2k", shares: "8.5k" },
      { id: 10, userId: 2, type: "ARTICLE", title: "Claude 4 sets new benchmarks in AI safety research", description: "Anthropic's latest model demonstrates unprecedented ability to refuse harmful requests while maintaining helpfulness.", tags: ["AI", "Technology", "News"], date: "Dec 5th 2025", image: "https://picsum.photos/seed/claude4-safety/400/300", views: "28k", likes: "15k", comments: "2.8k", shares: "6.2k" },
      { id: 11, userId: 5, type: "ARTICLE", title: "US announces new semiconductor export restrictions", description: "The Biden administration expands chip export controls to additional countries, impacting global tech supply chains.", tags: ["News", "Policy", "Technology"], date: "Dec 4th 2025", image: "https://picsum.photos/seed/chip-policy/400/300", views: "18k", likes: "4.2k", comments: "2.1k", shares: "3.8k" },
      { id: 12, userId: 3, type: "ARTICLE", title: "Indian stock market hits all-time high amid foreign investment surge", description: "Sensex crosses 85,000 for the first time as global investors pour billions into Indian equities.", tags: ["News", "Finance", "Business"], date: "Dec 3rd 2025", image: "https://picsum.photos/seed/sensex-high/400/300", views: "42k", likes: "21k", comments: "4.5k", shares: "9.2k" },
    ],
  });

  // ─── Article Content ───
  console.log("  Seeding article content...");
  await prisma.articleContent.createMany({
    data: [
      {
        postId: 2,
        paragraphs: [
          "In a recent press conference, former President Donald Trump made headlines once again by discussing telecommunications technology in ways that left many experts scratching their heads.",
          "\"We're going to have 6G, maybe even 7G,\" Trump declared confidently. \"Nobody knows what it means, but we're going to have it before anyone else. China thinks they're ahead, but they're not. We're going to be so far ahead, it's going to be incredible.\"",
          "The comments came during a discussion about American technological competitiveness, where Trump attempted to position himself as a champion of innovation. However, telecommunications experts were quick to point out that 6G standards don't yet exist, and the technology is still largely theoretical.",
          "\"6G is not something you can just declare into existence,\" explained Dr. Sarah Chen, a telecommunications researcher at MIT. \"It requires years of research, standardization, and infrastructure development. We're still in the early stages of 5G deployment globally.\"",
          "This isn't the first time business leaders and politicians have used technical buzzwords without fully understanding their meaning. The phenomenon has become so common that it has its own name among tech circles: \"buzzword bingo.\"",
        ],
      },
      {
        postId: 3,
        paragraphs: [
          "OpenAI has officially announced GPT-5, marking what the company calls \"the most significant leap in AI capability since the introduction of GPT-4.\"",
          "The new model demonstrates unprecedented reasoning capabilities, with the ability to solve complex multi-step problems that previously stumped AI systems. In internal testing, GPT-5 achieved near-human performance on graduate-level examinations across multiple disciplines.",
          "\"We've fundamentally reimagined how AI systems approach reasoning,\" said OpenAI CEO Sam Altman. \"GPT-5 doesn't just pattern match—it genuinely thinks through problems in ways that mirror human cognition.\"",
          "Key improvements include enhanced mathematical reasoning, better understanding of nuanced context, and significantly improved factual accuracy. The model also shows remarkable improvements in coding tasks, with early testers reporting that it can architect and implement complex software systems with minimal human guidance.",
          "The announcement has sent ripples through the tech industry, with competitors scrambling to respond. Google, Anthropic, and Meta are all reportedly accelerating their own AI development timelines.",
        ],
      },
      {
        postId: 5,
        paragraphs: [
          "In a historic moment for space exploration, SpaceX's Starship rocket has completed its first fully successful orbital flight, marking a major milestone in humanity's quest to become a multi-planetary species.",
          "The massive rocket, standing at nearly 400 feet tall, launched from SpaceX's Starbase facility in Boca Chica, Texas, at 7:23 AM local time. It successfully reached orbit, completed multiple revolutions around Earth, and executed a controlled reentry and landing.",
          "\"This is the day we've been working toward for over a decade,\" said Elon Musk, visibly emotional at the post-flight press conference. \"Starship is the vehicle that will take humanity to Mars, and today we proved it can work.\"",
          "The successful flight validates years of iterative testing, including multiple explosive failures that critics had pointed to as evidence of SpaceX's overly aggressive approach. But the company's \"fail fast, learn faster\" methodology has now proven its worth.",
          "NASA has already contracted Starship for lunar landing missions as part of the Artemis program. With today's success, those missions are now one step closer to reality.",
        ],
      },
      {
        postId: 7,
        paragraphs: [
          "Microsoft has unveiled its next-generation AI chips, codenamed 'Maia,' designed to compete directly with Nvidia's dominant GPU offerings in the artificial intelligence market.",
          "The custom silicon represents a major strategic shift for Microsoft, which has traditionally relied on third-party hardware for its Azure cloud infrastructure. The move comes as AI workloads have exploded in demand, creating supply constraints and driving up costs.",
          "\"We need to control our own destiny when it comes to AI infrastructure,\" explained Microsoft CEO Satya Nadella. \"Maia gives us that control while delivering better performance per dollar for our customers.\"",
          "Early benchmarks suggest the chips offer competitive performance to Nvidia's H100 GPUs while consuming significantly less power. Microsoft plans to begin deploying Maia in its data centers by mid-2026.",
          "The announcement puts additional pressure on Nvidia, which has enjoyed near-monopoly status in the AI chip market. Other tech giants, including Google and Amazon, have also developed custom AI chips.",
        ],
      },
      {
        postId: 8,
        paragraphs: [
          "Zepto, the quick commerce startup that promises 10-minute grocery deliveries, has achieved unicorn status faster than any company in Indian startup history, reaching a $5 billion valuation.",
          "Founded by Stanford dropouts Aadit Palicha and Kaivalya Vohra in 2021, Zepto has rapidly expanded to cover major metropolitan areas across India. The company operates a network of \"dark stores\"—small warehouses strategically located in residential neighborhoods.",
          "\"We're not just delivering groceries—we're redefining convenience,\" said co-founder Aadit Palicha. \"In urban India, time is the ultimate luxury, and we're giving people their time back.\"",
          "The latest funding round was led by StepStone Group, with participation from existing investors including Glade Brook Capital and Nexus Venture Partners. The funds will be used to expand into new cities and deepen coverage in existing markets.",
          "Critics have questioned the sustainability of the quick commerce model, citing thin margins and high operational costs. But Zepto claims it has achieved profitability in several mature markets.",
        ],
      },
      {
        postId: 9,
        paragraphs: [
          "Tesla has begun real-world factory trials of its Optimus humanoid robot, marking a significant step toward the company's vision of affordable robotic labor.",
          "The robots are currently performing basic assembly tasks at Tesla's Fremont, California factory, including picking up parts and placing them in designated locations. While the tasks are simple, they represent an important proof of concept.",
          "\"Optimus is not science fiction anymore,\" Elon Musk posted on X. \"It's working alongside humans on a real factory floor. This is just the beginning.\"",
          "Tesla claims Optimus could eventually handle any repetitive physical task that humans currently perform, from factory work to household chores. The company has set an ambitious target price of $20,000 per unit at scale.",
          "The implications for the labor market are profound. While proponents argue robots will free humans from dangerous and monotonous work, critics worry about widespread job displacement without adequate social safety nets.",
        ],
      },
      {
        postId: 10,
        paragraphs: [
          "Anthropic's Claude 4 has achieved unprecedented scores on AI safety benchmarks while maintaining—and in some cases exceeding—the helpfulness of previous models.",
          "The new model demonstrates a sophisticated ability to understand context and intent, refusing harmful requests even when they're disguised as legitimate queries. At the same time, it provides more comprehensive assistance for benign tasks than its predecessors.",
          "\"We've proven that safety and capability aren't trade-offs,\" said Anthropic CEO Dario Amodei. \"Claude 4 is both our safest and our most capable model to date.\"",
          "Key innovations include improved reasoning about potential harms, better recognition of manipulation attempts, and enhanced ability to ask clarifying questions when requests are ambiguous. The model also shows remarkable consistency in its safety behaviors across different contexts.",
          "The achievement is significant for the broader AI industry, which has often treated safety as an obstacle to progress. Anthropic's success suggests a path forward where AI systems can be both powerful and trustworthy.",
        ],
      },
      {
        postId: 11,
        paragraphs: [
          "The U.S. government has announced sweeping new restrictions on semiconductor exports, expanding controls to additional countries and tightening existing rules around advanced chip technology.",
          "The new regulations target AI chips and the equipment used to manufacture them, with the stated goal of preventing adversaries from acquiring technology that could enhance their military capabilities or enable human rights abuses.",
          "\"Advanced semiconductors are foundational to national security,\" said Commerce Secretary Gina Raimondo. \"We're taking necessary steps to prevent our cutting-edge technology from being used against our interests.\"",
          "The restrictions are expected to significantly impact global tech supply chains. Companies like Nvidia and AMD will face new compliance requirements, while international chip manufacturers must navigate an increasingly complex regulatory landscape.",
          "China has condemned the move as \"technological hegemony,\" vowing to accelerate its domestic chip development efforts. Industry analysts warn of potential retaliation that could further fragment the global technology market.",
        ],
      },
      {
        postId: 12,
        paragraphs: [
          "The Indian stock market has reached a historic milestone, with the BSE Sensex crossing 85,000 points for the first time as foreign investors pour billions into the country's equities.",
          "The rally has been driven by strong corporate earnings, a resilient domestic economy, and growing optimism about India's long-term growth prospects. Foreign institutional investors have been net buyers for twelve consecutive months.",
          "\"India is becoming the world's most attractive investment destination,\" said Nikhil Kamath, co-founder of Zerodha. \"The combination of demographics, digital infrastructure, and economic reforms creates a unique opportunity.\"",
          "Key sectors driving the gains include banking, technology, and consumer goods. The IT sector has particularly benefited from the global AI boom, with Indian software companies winning major contracts from international clients.",
          "Analysts caution that valuations are stretched by historical standards, but remain bullish on India's long-term trajectory. Many predict the Sensex could reach 100,000 within the next two years if current trends continue.",
        ],
      },
    ],
  });

  // ─── Circle Members ───
  console.log("  Seeding circle members...");
  const circleMemberData = [
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

  await prisma.circleMember.createMany({
    data: circleMemberData.map((m, i) => ({
      id: 100 + i,
      name: m.name,
      title: m.title,
      avatar: m.avatar,
      hasInitial: m.hasInitial,
      initial: m.initial || null,
      initialBg: m.initialBg || null,
      verified: true,
      rank: i + 1,
    })),
  });

  // ─── Circle Posts ───
  console.log("  Seeding circle posts...");
  await prisma.circlePost.createMany({
    data: [
      { memberId: 100, content: "Just closed a $200M fund focused on deep tech and climate. The next decade belongs to founders solving hard problems.", image: "https://picsum.photos/seed/nikhil-post/800/400", likes: "4.2k", comments: "312" },
      { memberId: 102, content: "AI is going to redefine every industry. At Microsoft, we're building the infrastructure to make that happen responsibly.", likes: "18k", comments: "2.1k" },
      { memberId: 103, content: "The next generation of AI won't just answer questions — it will reason, plan, and act. GPT-5 is a step in that direction.", image: "https://picsum.photos/seed/sam-post/800/400", likes: "32k", comments: "5.8k" },
      { memberId: 105, content: "Search is being completely reimagined. What we're building at Google is going to change how people interact with information forever.", likes: "12k", comments: "1.4k" },
      { memberId: 107, content: "Software is eating the world, but AI is eating software. Every company needs to figure out their AI strategy now, not next year.", image: "https://picsum.photos/seed/marc-post/800/400", likes: "8.5k", comments: "923" },
      { memberId: 110, content: "The future of hospitality is personal. We're investing heavily in AI-powered experiences that make every trip unique.", likes: "6.1k", comments: "445" },
      { memberId: 113, content: "Constitutional AI is not just a technique — it's a philosophy. Building safe AI systems requires rethinking how we train models from the ground up.", image: "https://picsum.photos/seed/dario-post/800/400", likes: "15k", comments: "1.8k" },
      { memberId: 115, content: "Commerce is going through its biggest transformation since the internet. Shopify merchants processed $1B in a single day last quarter.", likes: "9.3k", comments: "678" },
    ],
  });

  // ─── Notifications ───
  console.log("  Seeding notifications...");
  await prisma.notification.createMany({
    data: [
      { type: "FOLLOW", userId: 3, time: "2min ago", group: "TODAY", unread: true },
      { type: "FOLLOW", userId: 7, time: "7min ago", group: "TODAY", unread: true },
      { type: "LIKE", userId: 5, time: "2hr ago", group: "TODAY", unread: true, postPreview: "Happy to share that Example.com...", postImage: "https://picsum.photos/seed/funding-announce/200/200" },
      { type: "COMMENT", userId: 4, time: "3hr ago", group: "TODAY", unread: false, postPreview: "The best time to start investing was yesterday..." },
      { type: "MENTION", userId: 2, time: "5hr ago", group: "TODAY", unread: false, postPreview: "Check out what @jessinsam is building..." },
      { type: "LIKE_STORY", userId: 6, time: "1d ago", group: "YESTERDAY", unread: false },
      { type: "FOLLOW", userId: 8, time: "1d ago", group: "YESTERDAY", unread: false },
      { type: "LIKE", userId: 3, time: "1d ago", group: "YESTERDAY", unread: false, postPreview: "Building in public has been one of the best decisions..." },
      { type: "COMMENT", userId: 7, time: "2d ago", group: "EARLIER", unread: false, postPreview: "AI is going to redefine every industry..." },
      { type: "FOLLOW", userId: 4, time: "2d ago", group: "EARLIER", unread: false },
      { type: "LIKE", userId: 6, time: "3d ago", group: "EARLIER", unread: false, postPreview: "Applications for YC Winter 2026 batch are now open..." },
      { type: "MENTION", userId: 8, time: "3d ago", group: "EARLIER", unread: false, postPreview: "Zepto becomes India's fastest unicorn..." },
      { type: "FOLLOW", userId: 2, time: "4d ago", group: "EARLIER", unread: false },
      { type: "LIKE_STORY", userId: 3, time: "5d ago", group: "EARLIER", unread: false },
      { type: "LIKE", userId: 4, time: "5d ago", group: "EARLIER", unread: false, postPreview: "SpaceX Starship completes first successful orbital flight..." },
    ],
  });

  // ─── Conversations & Messages ───
  console.log("  Seeding conversations and messages...");

  const conversationsData = [
    {
      id: 1, userId: 3, lastMessage: "Let's discuss the term sheet......", time: "3:14 PM", unreadCount: 2, online: true,
      messages: [
        { fromMe: false, text: "Hey Jessin, great seeing you at the summit yesterday.", time: "2:45 PM" },
        { fromMe: true, text: "Thanks Nikhil! It was a pleasure to meet you.", time: "2:48 PM" },
        { fromMe: false, text: "I've been looking at Example.com and I think there's a huge opportunity here.", time: "3:01 PM" },
        { fromMe: true, text: "That means a lot coming from you. We're growing 40% month over month.", time: "3:05 PM" },
        { fromMe: false, text: "Impressive. I'd love to chat about a potential investment.", time: "3:10 PM" },
        { fromMe: false, text: "Let's discuss the term sheet......", time: "3:14 PM" },
      ],
    },
    {
      id: 2, userId: 7, lastMessage: "Hai Jessin!", time: "Yesterday", unreadCount: 0, online: false,
      messages: [
        { fromMe: false, text: "Hi Jessin, congratulations on the funding round!", time: "10:30 AM" },
        { fromMe: true, text: "Thank you Satya! Really appreciate the kind words.", time: "11:15 AM" },
        { fromMe: false, text: "Have you considered integrating with Azure for your infrastructure?", time: "11:45 AM" },
        { fromMe: true, text: "We're actually evaluating cloud partners right now. Would love to learn more.", time: "12:30 PM" },
        { fromMe: false, text: "Hai Jessin!", time: "3:00 PM" },
      ],
    },
    {
      id: 3, userId: 4, lastMessage: "Mars colony needs a social network too", time: "2d ago", unreadCount: 0, online: true,
      messages: [
        { fromMe: false, text: "Your platform is interesting. Different from what's out there.", time: "9:00 AM" },
        { fromMe: true, text: "Thanks Elon! We're focused on meaningful business connections.", time: "9:30 AM" },
        { fromMe: false, text: "Mars colony needs a social network too", time: "10:00 AM" },
      ],
    },
    {
      id: 4, userId: 2, lastMessage: "We'd love to feature Example.com as a case study.", time: "3d ago", unreadCount: 0, online: true,
      messages: [
        { fromMe: false, text: "Hi Jessin! We noticed Example.com is using our API extensively.", time: "2:00 PM" },
        { fromMe: true, text: "Yes, GPT powers our content recommendations. It's been great.", time: "2:30 PM" },
        { fromMe: false, text: "We'd love to feature Example.com as a case study.", time: "3:00 PM" },
      ],
    },
    {
      id: 5, userId: 8, lastMessage: "Quick commerce and social media — there's a play here.", time: "5d ago", unreadCount: 0, online: false,
      messages: [
        { fromMe: true, text: "Hey Aadit, congrats on the unicorn milestone!", time: "11:00 AM" },
        { fromMe: false, text: "Thanks Jessin! It's been a wild ride.", time: "11:30 AM" },
        { fromMe: false, text: "Quick commerce and social media — there's a play here.", time: "11:45 AM" },
      ],
    },
    {
      id: 6, userId: 6, lastMessage: "Your application for the next batch is strong.", time: "1w ago", unreadCount: 0, online: false,
      messages: [
        { fromMe: false, text: "Hi Jessin, thanks for applying to YC.", time: "4:00 PM" },
        { fromMe: true, text: "Thank you for considering us!", time: "4:15 PM" },
        { fromMe: false, text: "Your application for the next batch is strong.", time: "4:30 PM" },
      ],
    },
  ];

  for (const convo of conversationsData) {
    await prisma.conversation.create({
      data: {
        id: convo.id,
        participantId: 1, // Default to user 1 as the participant
        userId: convo.userId,
        lastMessage: convo.lastMessage,
        time: convo.time,
        unreadCount: convo.unreadCount,
        online: convo.online,
        messages: {
          create: convo.messages.map((m) => ({
            fromMe: m.fromMe,
            text: m.text,
            time: m.time,
          })),
        },
      },
    });
  }

  // ─── Trending Topics ───
  console.log("  Seeding trending topics...");
  await prisma.trendingTopic.createMany({
    data: [
      { id: 1, name: "AI & SaaS", posts: "2.1k posts this week", image: "https://picsum.photos/seed/ai-saas/200/200" },
      { id: 2, name: "UAE Startup", posts: "1.8k posts", image: "https://picsum.photos/seed/uae-startup/200/200" },
      { id: 3, name: "Fintech", posts: "1k posts", image: "https://picsum.photos/seed/fintech-topic/200/200" },
      { id: 4, name: "Web3", posts: "890 posts", image: "https://picsum.photos/seed/web3-topic/200/200" },
      { id: 5, name: "Climate Tech", posts: "670 posts", image: "https://picsum.photos/seed/climate-tech/200/200" },
    ],
  });

  // ─── Saved Collections ───
  console.log("  Seeding saved collections...");
  await prisma.savedCollection.createMany({
    data: [
      { id: 1, name: "Technology", count: 10, image: "https://picsum.photos/seed/coll-tech/100" },
      { id: 2, name: "AI", count: 5, image: "https://picsum.photos/seed/coll-ai/100" },
      { id: 3, name: "Finance", count: 12, image: "https://picsum.photos/seed/coll-finance/100" },
      { id: 4, name: "Startups", count: 8, image: "https://picsum.photos/seed/coll-startups/100" },
      { id: 5, name: "News", count: 15, image: "https://picsum.photos/seed/coll-news/100" },
    ],
  });

  // ─── Saved Posts ───
  console.log("  Seeding saved posts...");
  await prisma.savedPost.createMany({
    data: [2, 1, 3, 5, 7, 8].map((postId) => ({ postId })),
  });

  // ─── Content Topics ───
  console.log("  Seeding content topics...");
  await prisma.contentTopic.createMany({
    data: [
      { id: "tech", label: "Technology", selected: true },
      { id: "business", label: "Business", selected: true },
      { id: "ai", label: "AI & ML", selected: true },
      { id: "startups", label: "Startups", selected: false },
      { id: "finance", label: "Finance", selected: true },
      { id: "crypto", label: "Crypto", selected: false },
      { id: "science", label: "Science", selected: false },
      { id: "politics", label: "Politics", selected: true },
    ],
  });

  // ─── Analytics Stats ───
  console.log("  Seeding analytics stats...");
  await prisma.analyticsStat.createMany({
    data: [
      { label: "Total view", value: "45,210", change: 12.4, up: true, sparkline: [20, 35, 28, 45, 38, 55, 48, 62, 58, 72, 65, 78] },
      { label: "Profile visits", value: "1,284", change: 3.2, up: false, sparkline: [50, 48, 45, 47, 42, 40, 38, 41, 36, 35, 37, 34] },
      { label: "Circle actions", value: "432", change: 24.1, up: true, sparkline: [15, 22, 18, 30, 25, 38, 32, 45, 42, 55, 50, 62] },
    ],
  });

  // ─── Views Over Time ───
  console.log("  Seeding views over time...");
  await prisma.viewOverTime.createMany({
    data: [
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
    ],
  });

  // ─── Top Posts ───
  console.log("  Seeding top posts...");
  await prisma.topPost.createMany({
    data: [
      { id: 1, title: "Building the...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post1/100" },
      { id: 2, title: "10 Tips for...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post2/100" },
      { id: 3, title: "Why Founders...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post3/100" },
      { id: 4, title: "Why Founders...", views: "1k", likes: "1k", image: "https://picsum.photos/seed/top-post4/100" },
    ],
  });

  // ─── Quick Snapshot ───
  console.log("  Seeding quick snapshot...");
  await prisma.quickSnapshot.createMany({
    data: [
      { label: "Views today", value: "1,402" },
      { label: "New followers", value: "+25" },
      { label: "Circle requests", value: "5" },
      { label: "Engagement rate", value: "24%" },
    ],
  });

  // ─── Account Settings ───
  console.log("  Seeding account settings...");
  await prisma.accountSetting.createMany({
    data: [
      { label: "Email", value: "jessin@tecnots.com" },
      { label: "Username", value: "jessinsam" },
      { label: "Phone", value: "+91 7902839978" },
    ],
  });

  // ─── Language & Region Settings ───
  console.log("  Seeding language & region settings...");
  await prisma.languageRegionSetting.createMany({
    data: [
      { label: "Language", value: "English (US)" },
      { label: "Time Zone", value: "(GMT-08:00) Pacific Time" },
      { label: "Currency", value: "USD ($)" },
    ],
  });

  // ─── Profile data for Jessin Sam (user 1) ───
  await prisma.userExperience.createMany({
    data: [
      { userId: 1, role: "Founder & CEO", company: "Example Inc.", logo: "https://picsum.photos/seed/company1/100", period: "2021 – Present", description: "Leading a team of 45+ building the next generation of business networking tools. Raised $10M Series A.", order: 0 },
      { userId: 1, role: "Advisor", company: "Tech Ventures", logo: "https://picsum.photos/seed/company2/100", period: "2023 – Present", description: "Strategic advisor to early-stage startups in AI and enterprise SaaS.", order: 1 },
      { userId: 1, role: "Co-founder & CTO", company: "StartupX", logo: "https://picsum.photos/seed/company3/100", period: "2019 – 2021", description: "Built the core product and engineering team from 0 to 20. Acquired by TechCorp in 2021.", order: 2 },
    ],
  });

  await prisma.userEducation.createMany({
    data: [
      { userId: 1, school: "Stanford University", degree: "M.S. Computer Science", period: "2015 – 2017", logo: "https://picsum.photos/seed/stanford-edu/100", order: 0 },
      { userId: 1, school: "IIT Madras", degree: "B.Tech Computer Science & Engineering", period: "2011 – 2015", logo: "https://picsum.photos/seed/iitm-edu/100", order: 1 },
    ],
  });

  await prisma.userSkill.createMany({
    data: ["Product Strategy", "Startup Growth", "Full-Stack Development", "Machine Learning", "Team Leadership", "Fundraising", "Public Speaking", "AI Infrastructure", "React / Next.js", "Python"].map(name => ({ userId: 1, name })),
  });

  await prisma.userInterest.createMany({
    data: ["Artificial Intelligence", "Startups", "Venture Capital", "Space Technology", "Climate Tech", "Open Source"].map(name => ({ userId: 1, name })),
  });

  // ─── Stories ───
  console.log("  Seeding stories...");
  const storyExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
  await prisma.story.createMany({
    data: [
      { userId: 1, imageUrl: "https://picsum.photos/seed/story-jessin/400/700", status: "published", createdAt: now, expiresAt: storyExpiry, views: 120, likes: 45 },
      { userId: 2, imageUrl: "https://picsum.photos/seed/story-openai/400/700", status: "published", createdAt: now, expiresAt: storyExpiry, views: 340, likes: 128 },
      { userId: 3, imageUrl: "https://picsum.photos/seed/story-nikhil/400/700", status: "published", createdAt: now, expiresAt: storyExpiry, views: 89, likes: 32 },
      { userId: 4, imageUrl: "https://picsum.photos/seed-story-elon/400/700", status: "published", createdAt: now, expiresAt: storyExpiry, views: 567, likes: 234 },
      { userId: 6, imageUrl: "https://picsum.photos/seed/story-yc/400/700", status: "published", createdAt: now, expiresAt: storyExpiry, views: 156, likes: 67 },
      { userId: 8, imageUrl: "https://picsum.photos/seed/story-aadit/400/700", status: "published", createdAt: now, expiresAt: storyExpiry, views: 78, likes: 29 },
      { userId: 14, imageUrl: "https://picsum.photos/seed-story-maya/400/700", status: "published", createdAt: now, expiresAt: storyExpiry, views: 45, likes: 18 },
    ],
  });

  console.log("Seeding complete!");
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
