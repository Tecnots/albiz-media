import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const { searchParams } = new URL(request.url);
  const status  = searchParams.get("status");
  const search  = searchParams.get("search")?.trim() ?? "";
  const page    = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip    = (page - 1) * limit;

  const where: any = {};
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { handle: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [shorts, total] = await Promise.all([
    prisma.short.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, handle: true, avatar: true } },
      },
    }),
    prisma.short.count({ where }),
  ]);

  // Aggregate stats
  const stats = await prisma.$queryRaw<{ status: string; cnt: bigint }[]>`
    SELECT status, COUNT(*) AS cnt FROM "Short" GROUP BY status
  `;
  const statMap: Record<string, number> = {};
  for (const s of stats) statMap[s.status] = Number(s.cnt);

  return NextResponse.json({
    shorts,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: {
      draft:      statMap["draft"]      ?? 0,
      in_review:  statMap["in_review"]  ?? 0,
      approved:   statMap["approved"]   ?? 0,
      rejected:   statMap["rejected"]   ?? 0,
      published:  statMap["published"]  ?? 0,
    },
  });
}
