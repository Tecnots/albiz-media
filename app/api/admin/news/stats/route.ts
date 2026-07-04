import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [statusCounts, publishedToday, trendRaw, topAuthorsRaw] = await Promise.all([
      prisma.post.groupBy({
        by: ["status"],
        where: { type: "ARTICLE" },
        _count: { _all: true },
      }),
      prisma.post.count({
        where: { type: "ARTICLE", status: "published", createdAt: { gte: today } },
      }),
      prisma.$queryRaw<{ day: Date; cnt: bigint }[]>`
        SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS cnt
        FROM "Post"
        WHERE type = 'ARTICLE'
          AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY day ASC
      `,
      prisma.post.groupBy({
        by: ["userId"],
        where: { type: "ARTICLE" },
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
        take: 8,
      }),
    ]);

    // Build status map
    const sm: Record<string, number> = {};
    for (const row of statusCounts) sm[row.status] = row._count._all;

    const draft             = sm["draft"]              ?? 0;
    const submitted         = sm["submitted"]          ?? 0;
    const under_review      = sm["under_review"]       ?? 0;
    const revision_requested = sm["revision_requested"] ?? 0;
    const approved          = sm["approved"]           ?? 0;
    const published         = sm["published"]          ?? 0;
    const scheduled         = sm["scheduled"]          ?? 0;
    const rejected          = sm["rejected"]           ?? 0;
    const archived          = sm["archived"]           ?? 0;
    const pending           = submitted + under_review;
    const total             = Object.values(sm).reduce((a, b) => a + b, 0);
    const reviewed          = approved + rejected;
    const approvalRate      = reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0;

    // Fill in a continuous 30-day trend (zero for missing days)
    const trendMap = new Map<string, number>();
    for (const row of trendRaw) {
      const key = new Date(row.day).toISOString().slice(0, 10);
      trendMap.set(key, Number(row.cnt));
    }
    const trend: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      trend.push({ date: key, count: trendMap.get(key) ?? 0 });
    }

    // Resolve top author names/avatars
    const authorIds = topAuthorsRaw.map((r: any) => r.userId);
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, handle: true, avatar: true },
        })
      : [];
    const authorMap = new Map(authors.map((a: any) => [a.id, a]));
    const topAuthors = topAuthorsRaw
      .map((r: any) => {
        const a = authorMap.get(r.userId);
        if (!a) return null;
        return {
          id: a.id,
          name: a.name,
          handle: a.handle,
          avatar: blobStorageService.resolveMediaUrl(a.avatar),
          count: r._count._all,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      total,
      draft,
      submitted,
      under_review,
      revision_requested,
      approved,
      published,
      published_today: publishedToday,
      scheduled,
      rejected,
      archived,
      pending,
      approvalRate,
      trend,
      topAuthors,
    });
  } catch (error) {
    console.error("News stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}