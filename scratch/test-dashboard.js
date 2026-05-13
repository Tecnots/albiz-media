// scratch/test-dashboard.js
// Run with: node -e "require('./scratch/test-dashboard.js')" 
// or: node scratch/test-dashboard.js (if module type allows)

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config({ path: ".env.local" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const now = new Date();
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, totalPosts, activeUsers24h, newSignups7d, circleMembers, pendingApprovals, flaggedContent, articlesPublished, activeConversations, totalComments] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.user.count({ where: { lastSeenAt: { gte: h24Ago } } }),
      prisma.user.count({ where: { emailVerified: { gte: d7Ago } } }),
      prisma.user.count({ where: { role: "CIRCLE" } }),
      prisma.circleUpgradeRequest.count({ where: { status: "PENDING" } }),
      prisma.post.count({ where: { status: "flagged" } }),
      prisma.post.count({ where: { type: "ARTICLE", status: { not: "flagged" } } }),
      prisma.conversation.count(),
      prisma.postComment.count(),
    ]);

    console.log(JSON.stringify({
      totalUsers, totalPosts, activeUsers24h, newSignups7d,
      circleMembers, pendingApprovals, flaggedContent,
      articlesPublished, activeConversations, totalComments,
    }, null, 2));

    // Test recent activity queries
    const recentUpgrades = await prisma.circleUpgradeRequest.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        status: true,
        user: { select: { id: true, name: true, handle: true } },
      },
    });
    console.log("Recent upgrades:", recentUpgrades.length, recentUpgrades.map(r => `${r.user.name} - ${r.status}`));

    const recentComments = await prisma.postComment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        post: { select: { type: true } },
        user: { select: { id: true, name: true } },
      },
    });
    console.log("Recent comments:", recentComments.length);

    const recentFollows = await prisma.userFollow.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        follower: { select: { id: true, name: true } },
      },
    });
    console.log("Recent follows:", recentFollows.length);

  } catch (err) {
    console.error("ERROR:", err.message);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
