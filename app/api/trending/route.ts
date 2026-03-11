import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Parse stat strings like "1k", "2.3M", "45k" to numbers
function parseStat(s: string): number {
  if (!s) return 0;
  const c = s.replace(/,/g, "").trim().toLowerCase();
  if (c.endsWith("m")) return Math.round(parseFloat(c) * 1_000_000);
  if (c.endsWith("k")) return Math.round(parseFloat(c) * 1_000);
  return parseInt(c) || 0;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M posts";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k posts";
  return `${n} posts`;
}

// Seeded image from tag name for consistent thumbnails
function tagImage(tag: string): string {
  return `https://picsum.photos/seed/${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}/200/200`;
}

export async function GET() {
  try {
    // Get all published posts with their tags and engagement stats
    const publishedIds = await prisma.$queryRaw<any[]>`
      SELECT id FROM "Post" WHERE status = 'published' OR status IS NULL
    `;
    const ids = publishedIds.map((r: any) => r.id);

    if (!ids.length) {
      // Fallback to static trending topics if no posts
      const topics = await prisma.trendingTopic.findMany({ orderBy: { id: "asc" } });
      return NextResponse.json(topics);
    }

    const posts = await prisma.post.findMany({
      where: { id: { in: ids } },
      select: { tags: true, views: true, likes: true, comments: true, shares: true },
    });

    // Aggregate by tag: count posts + total engagement
    const tagStats: Record<string, { count: number; engagement: number }> = {};

    for (const post of posts) {
      const engagement =
        parseStat(post.views) * 0.1 +
        parseStat(post.likes) * 1.0 +
        parseStat(post.comments) * 3.0 +
        parseStat(post.shares) * 2.0;

      for (const tag of post.tags) {
        if (!tag) continue;
        if (!tagStats[tag]) tagStats[tag] = { count: 0, engagement: 0 };
        tagStats[tag].count += 1;
        tagStats[tag].engagement += engagement;
      }
    }

    // Sort by engagement (highest first), take top 8
    const sorted = Object.entries(tagStats)
      .sort(([, a], [, b]) => b.engagement - a.engagement)
      .slice(0, 8);

    const trending = sorted.map(([tag, stats], i) => ({
      id: i + 1,
      name: tag,
      posts: formatCount(stats.count),
      image: tagImage(tag),
    }));

    return NextResponse.json(trending);
  } catch (err: any) {
    console.error("Trending error:", err);
    // Fallback to static data on error
    const topics = await prisma.trendingTopic.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json(topics);
  }
}
