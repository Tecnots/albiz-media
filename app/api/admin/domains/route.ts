import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

// GET /api/admin/domains?status=&search=&page=&limit= — list every user with a custom domain configured.
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const where: any = { customDomain: { not: null } };
  if (status && status !== "all") where.domainStatus = status;
  if (search) {
    where.OR = [
      { customDomain: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { handle: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total, statsRaw] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { domainLastCheckedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, name: true, handle: true, avatar: true, banned: true, deactivatedAt: true,
        customDomain: true, domainStatus: true, domainVerificationAttempts: true,
        domainFailureReason: true, domainVerifiedAt: true, domainActivatedAt: true, domainLastCheckedAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.$queryRaw<{ domainStatus: string; cnt: bigint }[]>`
      SELECT "domainStatus", COUNT(*) AS cnt FROM "User" WHERE "customDomain" IS NOT NULL GROUP BY "domainStatus"
    `,
  ]);

  const stats: Record<string, number> = {};
  for (const row of statsRaw) stats[row.domainStatus] = Number(row.cnt);

  return NextResponse.json({
    domains: users.map((u) => ({ ...u, avatar: blobStorageService.resolveMediaUrl(u.avatar) })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats,
  });
}
