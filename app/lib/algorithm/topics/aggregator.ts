import { prisma } from "@/lib/prisma";
import {
  ACTION_WEIGHTS,
  TOPIC_COLLECTION_WINDOW_HOURS,
  VELOCITY_WINDOWS,
} from "./signals";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostRow {
  id:            number;
  userId:        number;
  tags:          string[];
  likesCount:    number;
  commentsCount: number;
  sharesCount:   number;
  viewsCount:    number;
  createdAt:     Date;
  countryCode:   string | null;
  flagged:       boolean;
}

export interface TopicAggregate {
  tag:             string;
  postIds:         number[];
  authorIds:       number[];
  posts:           PostRow[];
  totalLikes:      number;
  totalComments:   number;
  totalShares:     number;
  totalViews:      number;
  countryCounts:   Map<string, number>;
  postCreatedAts:  Date[];
  flaggedCount:    number;
  // Pre-computed velocity windows: each entry corresponds to VELOCITY_WINDOWS[i]
  velocityWindows: Array<{ recent: number; prior: number }>;
}

// ─── Tag normalisation ────────────────────────────────────────────────────────

// Canonical aliases: normalised input → canonical tag
// Keys AND values are already lower-case + stripped of leading #
const CANONICAL_TAG_MAP: Record<string, string> = {
  "a.i.": "ai", "artificial intelligence": "ai", "machine learning": "ai",
  "ml": "ai", "deep learning": "ai", "ai & ml": "ai", "ai and ml": "ai",
  "generative ai": "ai", "llm": "ai", "large language models": "ai",
  "chatgpt": "ai", "genai": "ai",

  "web 3": "web3", "web 3.0": "web3",
  "nfts": "nft", "non-fungible token": "nft",
  "defi": "web3", "decentralized finance": "web3",

  "crypto currency": "crypto", "cryptocurrency": "crypto",
  "bitcoin": "crypto", "btc": "crypto", "ethereum": "crypto", "eth": "crypto",
  "blockchain": "crypto",

  "start up": "startup", "startups": "startup", "start-up": "startup",
  "entrepreneurship": "startup", "founders": "startup", "solopreneur": "startup",

  "fintech": "finance", "financial technology": "finance",
  "stock market": "finance", "investing": "finance",
  "venture capital": "finance", "vc": "finance", "private equity": "finance",

  "saas": "technology", "software": "technology", "tech": "technology",
  "engineering": "technology", "programming": "technology", "coding": "technology",
  "software development": "technology", "devops": "technology",

  "climate change": "climate", "climate tech": "climate",
  "environment": "climate", "sustainability": "climate", "esg": "climate",
  "clean energy": "climate", "renewable energy": "climate",

  "mental health": "health", "healthcare": "health",
  "wellbeing": "health", "medtech": "health", "wellness": "health",

  "uae": "middleeast", "dubai": "middleeast", "abu dhabi": "middleeast",
  "saudi arabia": "middleeast", "ksa": "middleeast", "gcc": "middleeast",
};

function normaliseTag(raw: string): string {
  return raw.toLowerCase().replace(/^#+/, "").trim().replace(/\s+/g, " ");
}

export function canonicaliseTag(raw: string): string {
  const n = normaliseTag(raw);
  return CANONICAL_TAG_MAP[n] ?? n;
}

// ─── Velocity windows ─────────────────────────────────────────────────────────

// Weights engagement by proximity to nowMs using post creation time as proxy.
// For full precision, replace this with per-event timestamp queries from
// PostLike / PostComment / PostShareEvent.
function buildVelocityWindows(
  posts: PostRow[],
  nowMs: number
): Array<{ recent: number; prior: number }> {
  return VELOCITY_WINDOWS.map(({ recentHours, priorHours }) => {
    const recentCutoff = nowMs - recentHours * 3_600_000;
    const priorCutoff  = nowMs - priorHours  * 3_600_000;

    let recent = 0;
    let prior  = 0;

    for (const p of posts) {
      const postMs = new Date(p.createdAt).getTime();
      const eng    =
        p.likesCount    * ACTION_WEIGHTS.like    +
        p.commentsCount * ACTION_WEIGHTS.comment +
        p.sharesCount   * ACTION_WEIGHTS.share;

      if (postMs >= recentCutoff) {
        recent += eng;
      } else if (postMs >= priorCutoff) {
        prior  += eng;
      }
    }

    return { recent, prior };
  });
}

// ─── Collection ──────────────────────────────────────────────────────────────

async function fetchPostsInWindow(
  windowHours: number,
  nowMs: number
): Promise<PostRow[]> {
  const since = new Date(nowMs - windowHours * 3_600_000);

  // Join User inline to exclude banned / deactivated authors at the DB level.
  // COALESCE prefers the post's own countryCode (set at publish time) then falls
  // back to the author's country so geo scoring has the best possible coverage.
  return prisma.$queryRaw<PostRow[]>`
    SELECT
      p.id,
      p."userId",
      p.tags,
      p."likesCount",
      p."commentsCount",
      p."sharesCount",
      p."viewsCount",
      p."createdAt",
      COALESCE(p."countryCode", u."countryCode") AS "countryCode",
      p.flagged
    FROM "Post" p
    JOIN "User" u
      ON  u.id              = p."userId"
      AND u.banned          = false
      AND u."deactivatedAt" IS NULL
    WHERE
      (p.status = 'published' OR p.status IS NULL)
      AND p."createdAt" >= ${since}
      AND array_length(p.tags, 1) > 0
    ORDER BY p."createdAt" DESC
    LIMIT 50000
  `;
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

function groupByTag(
  posts: PostRow[],
  nowMs: number
): Map<string, TopicAggregate> {
  const tagMap = new Map<string, TopicAggregate>();

  for (const post of posts) {
    for (const rawTag of (post.tags ?? [])) {
      if (!rawTag || rawTag.length < 2) continue;

      const tag = canonicaliseTag(rawTag);
      if (!tag || tag.length < 2) continue;

      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          tag,
          postIds:         [],
          authorIds:       [],
          posts:           [],
          totalLikes:      0,
          totalComments:   0,
          totalShares:     0,
          totalViews:      0,
          countryCounts:   new Map(),
          postCreatedAts:  [],
          flaggedCount:    0,
          velocityWindows: [],
        });
      }

      const agg = tagMap.get(tag)!;

      // Deduplicate posts (a post with multiple matching tags must not be double-counted)
      if (agg.postIds.includes(post.id)) continue;

      agg.postIds.push(post.id);
      agg.posts.push(post);
      agg.postCreatedAts.push(new Date(post.createdAt));
      agg.totalLikes    += post.likesCount;
      agg.totalComments += post.commentsCount;
      agg.totalShares   += post.sharesCount;
      agg.totalViews    += post.viewsCount;

      if (post.flagged) agg.flaggedCount++;

      if (post.countryCode) {
        agg.countryCounts.set(
          post.countryCode,
          (agg.countryCounts.get(post.countryCode) ?? 0) + 1
        );
      }

      if (!agg.authorIds.includes(post.userId)) {
        agg.authorIds.push(post.userId);
      }
    }
  }

  // Attach velocity windows after grouping so all posts for the tag are available
  for (const agg of tagMap.values()) {
    agg.velocityWindows = buildVelocityWindows(agg.posts, nowMs);
  }

  return tagMap;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function collectAndAggregate(
  windowHours = TOPIC_COLLECTION_WINDOW_HOURS,
  nowMs       = Date.now()
): Promise<TopicAggregate[]> {
  const posts = await fetchPostsInWindow(windowHours, nowMs);
  return Array.from(groupByTag(posts, nowMs).values());
}

// Derive a regional subset from already-collected global aggregates.
// No additional DB query needed — we just filter the post lists.
export function buildRegionalAggregates(
  globalAggregates: TopicAggregate[],
  countryCode: string,
  nowMs: number
): TopicAggregate[] {
  return globalAggregates
    .map((agg): TopicAggregate | null => {
      const regionalPosts = agg.posts.filter(p => p.countryCode === countryCode);
      if (regionalPosts.length === 0) return null;

      const authorIds     = [...new Set(regionalPosts.map(p => p.userId))];
      const countryCounts = new Map<string, number>();
      countryCounts.set(countryCode, regionalPosts.length);

      return {
        tag:             agg.tag,
        postIds:         regionalPosts.map(p => p.id),
        authorIds,
        posts:           regionalPosts,
        totalLikes:      regionalPosts.reduce((s, p) => s + p.likesCount, 0),
        totalComments:   regionalPosts.reduce((s, p) => s + p.commentsCount, 0),
        totalShares:     regionalPosts.reduce((s, p) => s + p.sharesCount, 0),
        totalViews:      regionalPosts.reduce((s, p) => s + p.viewsCount, 0),
        countryCounts,
        postCreatedAts:  regionalPosts.map(p => new Date(p.createdAt)),
        flaggedCount:    regionalPosts.filter(p => p.flagged).length,
        velocityWindows: buildVelocityWindows(regionalPosts, nowMs),
      };
    })
    .filter((a): a is TopicAggregate => a !== null);
}
