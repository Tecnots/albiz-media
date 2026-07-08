import { NextResponse }    from "next/server";
import { prisma }          from "@/lib/prisma";
import { withCache }       from "@/lib/cache";
import { runTopicsPipeline } from "@/app/lib/algorithm/topics/pipeline";

// Human-readable post count string, consistent with the rest of the app
function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M posts";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k posts";
  return `${n} posts`;
}

// Stable placeholder image derived from the tag name (no external dependency)
function tagImage(tag: string): string {
  return `https://picsum.photos/seed/${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}/200/200`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") ?? "GLOBAL"; // optional ?scope=IN for regional

    const cacheKey = `trending:topics:${scope}`;

    const topics = await withCache(cacheKey, 5 * 60, async () => {
      // 1. Try computed table (written by the topics worker every ~10 min)
      const stored = await prisma.trendingTopicScore.findMany({
        where:   { scope },
        orderBy: { score: "desc" },
        take:    10,
      });

      if (stored.length > 0) {
        return stored.map((t, i) => ({
          id:    i + 1,
          name:  t.tag,
          posts: formatCount(t.postCount),
          image: tagImage(t.tag),
          score: t.score,
          breakdown: {
            velocity:      t.velocity,
            freshness:     t.freshness,
            participation: t.participation,
            popularity:    t.popularity,
            geo:           t.geo,
          },
        }));
      }

      // 2. Worker hasn't run yet (cold start) — compute on-the-fly for GLOBAL scope only
      if (scope === "GLOBAL") {
        const results = await runTopicsPipeline({ windowHours: 48 });
        const global  = results.find(r => r.scope === "GLOBAL");

        if (global && global.topics.length > 0) {
          return global.topics.map((t, i) => ({
            id:    i + 1,
            name:  t.tag,
            posts: formatCount(t.postCount),
            image: tagImage(t.tag),
            score: t.score,
            breakdown: t.breakdown,
          }));
        }
      }

      // 3. Last resort: static seed topics from the TrendingTopic table
      return (await prisma.trendingTopic.findMany({ orderBy: { id: "asc" } })).map(t => ({
        id:       t.id,
        name:     t.name,
        posts:    t.posts,
        image:    t.image,
        score:    0,
        breakdown: null,
      }));
    });

    return NextResponse.json(topics);
  } catch (err) {
    console.error("[Trending] Error:", err);

    // Absolute fallback — never return an error to the client for a UI widget
    const fallback = await prisma.trendingTopic
      .findMany({ orderBy: { id: "asc" } })
      .catch(() => []);

    return NextResponse.json(fallback);
  }
}
