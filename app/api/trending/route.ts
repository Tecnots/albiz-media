import { NextResponse }    from "next/server";
import { prisma }          from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/cache";
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

async function getSeedOrEmpty(): Promise<{ source: string; topics: any[] }> {
  const seeds = await prisma.trendingTopic.findMany({ orderBy: { id: "asc" } });
  if (seeds.length > 0) {
    return {
      source: "seed",
      topics: seeds.map(t => ({
        id: t.id, name: t.name, posts: t.posts, image: t.image,
        score: 0, breakdown: null,
      })),
    };
  }
  return { source: "empty", topics: [] };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") ?? "GLOBAL";

    const cacheKey = `trending:topics:${scope}`;

    // Check cache first
    const cached = await cacheGet<{ source: string; topics: any[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Cache miss — compute fresh result
    let result: { source: string; topics: any[] };

    // 1. Try computed table (written by the topics worker every ~10 min)
    const stored = await prisma.trendingTopicScore.findMany({
      where:   { scope },
      orderBy: { score: "desc" },
      take:    10,
    });

    if (stored.length > 0) {
      result = {
        source: "live",
        topics: stored.map((t, i) => ({
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
        })),
      };
      // Live data: cache for 5 minutes (worker invalidates on recompute)
      await cacheSet(cacheKey, result, 5 * 60);
    } else if (scope === "GLOBAL") {
      // 2. Worker hasn't run yet (cold start) — compute on-the-fly
      const results = await runTopicsPipeline();
      const global  = results.find(r => r.scope === "GLOBAL");

      if (global && global.topics.length > 0) {
        result = {
          source: "computed",
          topics: global.topics.map((t, i) => ({
            id:    i + 1,
            name:  t.tag,
            posts: formatCount(t.postCount),
            image: tagImage(t.tag),
            score: t.score,
            breakdown: t.breakdown,
          })),
        };
        // Computed on-the-fly: cache for 2 minutes
        await cacheSet(cacheKey, result, 2 * 60);
      } else {
        // No qualifying content — fall through to seed/empty
        result = await getSeedOrEmpty();
      }
    } else {
      result = await getSeedOrEmpty();
    }

    if (result.source === "seed" || result.source === "empty") {
      // Seed/empty: cache for only 30 seconds so fresh data is picked up quickly
      await cacheSet(cacheKey, result, 30);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Trending] Error:", err);

    // Absolute fallback — never return an error to the client for a UI widget
    const fallback = await prisma.trendingTopic
      .findMany({ orderBy: { id: "asc" } })
      .catch(() => []);

    return NextResponse.json({
      source: fallback.length > 0 ? "seed" : "empty",
      topics: fallback.map(t => ({
        id: t.id, name: t.name, posts: t.posts, image: t.image, score: 0, breakdown: null,
      })),
    });
  }
}
