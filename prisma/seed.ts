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
  await prisma.story.deleteMany();
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

  const now = new Date();

  // ─── Admin ───
  console.log("  Seeding admin user...");
  await prisma.user.create({
    data: {
      id: 1,
      name: "Albiz Admin",
      handle: "albizadmin",
      email: "support@tecnots.com",
      password: "C0mplex@#408",
      emailVerified: now,
      title: "Platform Administrator",
      avatar: "",
      role: "ADMIN",
      verified: true,
      isPremium: true,
      bio: "Albiz platform administration and support.",
      joinedDate: "January 2023",
      followers: "0",
      followingCount: "0",
    },
  });

  // ─── Trending Topics ───
  console.log("  Seeding trending topics...");
  await prisma.trendingTopic.createMany({
    data: [
      { id: 1, name: "AI & SaaS", posts: "0 posts", image: "https://picsum.photos/seed/ai-saas/200/200" },
      { id: 2, name: "UAE Startup", posts: "0 posts", image: "https://picsum.photos/seed/uae-startup/200/200" },
      { id: 3, name: "Fintech", posts: "0 posts", image: "https://picsum.photos/seed/fintech-topic/200/200" },
      { id: 4, name: "Web3", posts: "0 posts", image: "https://picsum.photos/seed/web3-topic/200/200" },
      { id: 5, name: "Climate Tech", posts: "0 posts", image: "https://picsum.photos/seed/climate-tech/200/200" },
    ],
  });

  // ─── Saved Collections ───
  console.log("  Seeding saved collections...");
  await prisma.savedCollection.createMany({
    data: [
      { id: 1, name: "Technology", count: 0, image: "https://picsum.photos/seed/coll-tech/100" },
      { id: 2, name: "AI", count: 0, image: "https://picsum.photos/seed/coll-ai/100" },
      { id: 3, name: "Finance", count: 0, image: "https://picsum.photos/seed/coll-finance/100" },
      { id: 4, name: "Startups", count: 0, image: "https://picsum.photos/seed/coll-startups/100" },
      { id: 5, name: "News", count: 0, image: "https://picsum.photos/seed/coll-news/100" },
    ],
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
      { label: "Total view", value: "0", change: 0, up: true, sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: "Profile visits", value: "0", change: 0, up: false, sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: "Circle actions", value: "0", change: 0, up: true, sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  });

  // ─── Views Over Time ───
  console.log("  Seeding views over time...");
  await prisma.viewOverTime.createMany({
    data: [
      { date: "01 OCT", value: 0 },
      { date: "04 OCT", value: 0 },
      { date: "08 OCT", value: 0 },
      { date: "11 OCT", value: 0 },
      { date: "15 OCT", value: 0 },
      { date: "18 OCT", value: 0 },
      { date: "22 OCT", value: 0 },
      { date: "25 OCT", value: 0 },
      { date: "28 OCT", value: 0 },
      { date: "30 OCT", value: 0 },
    ],
  });

  // ─── Top Posts ───
  console.log("  Seeding top posts placeholder...");
  await prisma.topPost.createMany({
    data: [
      { id: 1, title: "No posts yet", views: "0", likes: "0", image: "" },
    ],
  });

  // ─── Quick Snapshot ───
  console.log("  Seeding quick snapshot...");
  await prisma.quickSnapshot.createMany({
    data: [
      { label: "Views today", value: "0" },
      { label: "New followers", value: "0" },
      { label: "Circle requests", value: "0" },
      { label: "Engagement rate", value: "0%" },
    ],
  });

  // ─── Account Settings ───
  console.log("  Seeding account settings...");
  await prisma.accountSetting.createMany({
    data: [
      { label: "Email", value: "support@tecnots.com" },
      { label: "Username", value: "albizadmin" },
      { label: "Phone", value: "" },
    ],
  });

  // ─── Language & Region Settings ───
  console.log("  Seeding language & region settings...");
  await prisma.languageRegionSetting.createMany({
    data: [
      { label: "Language", value: "English (US)" },
      { label: "Time Zone", value: "(GMT+05:30) India Standard Time" },
      { label: "Currency", value: "INR (₹)" },
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
