import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTION_WEIGHTS } from "@/app/lib/algorithm/signals";

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

function tagImage(tag: string): string {
  return `https://picsum.photos/seed/${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}/200/200`;
}

// X-algorithm velocity: engagement acceleration per hour (last 24h vs. total)
// Uses ACTION_WEIGHTS for a consistent signal across feed and trending
function computeTagVelocityScore(
  posts: { views: string; likes: string; comments: string; shares: string; createdAt: Date | null }[],
  nowMs: number
): number {
  let totalXScore = 0;
  let velocityScore = 0;

  for (const post of posts) {
    const likes    = parseStat(post.likes);
    const comments = parseStat(post.comments);
    const shares   = parseStat(post.shares);
    const views    = Math.max(parseStat(post.views), 1);

    const likeRate    = likes    / views;
    const commentRate = comments / views;
    const shareRate   = shares   / views;

    // X's weighted engagement formula
    const xScore =
      ACTION_WEIGHTS.like    * likeRate +
      ACTION_WEIGHTS.comment * commentRate +
      ACTION_WEIGHTS.share   * shareRate;

    totalXScore += Math.max(xScore, 0);

    // Velocity: posts from last 24h contribute extra weight
    const createdMs = post.createdAt ? new Date(post.createdAt).getTime() : nowMs;
    const ageHours  = (nowMs - createdMs) / 3_600_000;
    if (ageHours <= 24) {
      const velocityBoost = (24 - ageHours) / 24; // linear decay over 24h
      velocityScore += Math.max(xScore, 0) * velocityBoost;
    }
  }

  // Combined: 60% total x-score, 40% velocity boost
  return totalXScore * 0.6 + velocityScore * 0.4;
}

export async function GET() {
  try {
    const nowMs = Date.now();

    const posts = await prisma.$queryRaw<any[]>`
      SELECT tags, views, likes, comments, shares,
             COALESCE("createdAt", NOW()) as "createdAt"
      FROM "Post"
      WHERE status = 'published' OR status IS NULL
    `;

    if (!posts.length) {
      const topics = await prisma.trendingTopic.findMany({ orderBy: { id: "asc" } });
      return NextResponse.json(topics);
    }

    // Aggregate by tag using X's velocity-weighted scoring
    const tagData: Record<string, { count: number; postsForScoring: any[] }> = {};

    for (const post of posts) {
      for (const tag of (post.tags ?? [])) {
        if (!tag) continue;
        if (!tagData[tag]) tagData[tag] = { count: 0, postsForScoring: [] };
        tagData[tag].count += 1;
        tagData[tag].postsForScoring.push(post);
      }
    }

    // Score each tag and sort by velocity-weighted X score
    const scored = Object.entries(tagData)
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        score: computeTagVelocityScore(data.postsForScoring, nowMs),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const trending = scored.map((item, i) => ({
      id: i + 1,
      name: item.tag,
      posts: formatCount(item.count),
      image: tagImage(item.tag),
    }));

    return NextResponse.json(trending);
  } catch (err: any) {
    console.error("Trending error:", err);
    const topics = await prisma.trendingTopic.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json(topics);
  }
}
