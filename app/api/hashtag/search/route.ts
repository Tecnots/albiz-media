import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/hashtag/search?q=trav — prefix search/browse over hashtags
// actually used across Posts and Stories (distinct from /api/hashtag/[tag],
// which is an exact-match feed for one already-known tag). Scans
// `Post.tags` and Story `hashtag` stickers, the same two sources
// /api/hashtag/[tag] already reads, just aggregated instead of filtered to
// one value. Empty `q` returns the most-used tags overall, so a picker has
// something to browse before the user types anything.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().replace(/^#/, "");
  const prefix = `${q}%`;

  const [postTags, storyTags] = await Promise.all([
    prisma.$queryRaw<{ tag: string; uses: bigint }[]>`
      SELECT lower(t) AS tag, count(*)::bigint AS uses
      FROM "Post" p, unnest(p.tags) t
      WHERE p.status = 'published' AND lower(t) LIKE ${prefix}
      GROUP BY lower(t)
    `,
    prisma.$queryRaw<{ tag: string; uses: bigint }[]>`
      SELECT lower(elem->'data'->>'tag') AS tag, count(*)::bigint AS uses
      FROM "Story" s, jsonb_array_elements(s.stickers) elem
      WHERE s.status = 'published' AND s."expiresAt" > NOW()
        AND elem->>'type' = 'hashtag' AND elem->'data'->>'tag' IS NOT NULL
        AND lower(elem->'data'->>'tag') LIKE ${prefix}
      GROUP BY lower(elem->'data'->>'tag')
    `,
  ]);

  const merged = new Map<string, number>();
  for (const row of [...postTags, ...storyTags]) {
    merged.set(row.tag, (merged.get(row.tag) ?? 0) + Number(row.uses));
  }

  const results = Array.from(merged.entries())
    .map(([tag, uses]) => ({ tag, uses }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 15);

  return NextResponse.json({ results });
}
