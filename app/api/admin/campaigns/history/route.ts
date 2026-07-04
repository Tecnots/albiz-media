import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

const CAMPAIGN_EVENTS = [
  "CAMPAIGN_CREATED",
  "CAMPAIGN_SENT",
  "CAMPAIGN_CANCELLED",
  "CAMPAIGN_FAILED",
];

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp    = new URL(req.url).searchParams;
  const page  = Math.max(1, Number(sp.get("page") ?? 1));
  const limit = Math.min(100, Math.max(10, Number(sp.get("limit") ?? 50)));

  // ActivityLog stores campaign events; eventType is an enum string
  const [rows, total] = await Promise.all([
    (prisma as any).activityLog.findMany({
      where: { eventType: { in: CAMPAIGN_EVENTS } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        eventType: true,
        userId: true,
        userName: true,
        handle: true,
        avatar: true,
        meta: true,
        createdAt: true,
      },
    }),
    (prisma as any).activityLog.count({
      where: { eventType: { in: CAMPAIGN_EVENTS } },
    }),
  ]);

  return NextResponse.json({
    entries: rows.map((r: any) => ({
      ...r,
      meta: r.meta ? JSON.parse(r.meta) : null,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
