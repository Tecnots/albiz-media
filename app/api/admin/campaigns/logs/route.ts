import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const page     = Math.max(1, Number(sp.get("page") ?? 1));
  const limit    = Math.min(100, Math.max(10, Number(sp.get("limit") ?? 50)));
  const search   = sp.get("search")?.trim() ?? "";
  const status   = sp.get("status") ?? "";
  const campaignId = sp.get("campaignId") ?? "";

  const where: Record<string, unknown> = {};
  if (campaignId) where.campaignId = campaignId;
  if (status)     where.status = status;
  if (search)     where.email = { contains: search, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.emailCampaignRecipient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        campaignId: true,
        email: true,
        name: true,
        status: true,
        sentAt: true,
        error: true,
        createdAt: true,
        campaign: { select: { name: true, metadata: true } },
      },
    }),
    prisma.emailCampaignRecipient.count({ where }),
  ]);

  return NextResponse.json({
    logs: rows.map(r => ({
      ...r,
      channels: ((r.campaign?.metadata as Record<string, unknown> | null)?.channels as string[]) ?? ["email"],
      campaignName: r.campaign?.name ?? "",
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
