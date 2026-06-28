import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

const VALID_EVENT_TYPES = new Set([
  "SIGNUP", "SIGNIN", "DEACTIVATE", "REACTIVATE", "DELETE_ACCOUNT",
  "CIRCLE_REQUEST", "CIRCLE_APPROVED", "CIRCLE_REJECTED",
  "BAN", "UNBAN", "VERIFICATION_APPROVED", "VERIFICATION_REJECTED",
  "CONTENT_REPORTED", "CONTENT_MODERATED",
]);

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const eventTypeParam = searchParams.get("eventType")?.trim() ?? "";
  const userIdParam = searchParams.get("userId")?.trim() ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "25")));

  try {
    const where: Record<string, unknown> = {};

    if (eventTypeParam) {
      const types = eventTypeParam
        .split(",")
        .map(t => t.trim())
        .filter(t => VALID_EVENT_TYPES.has(t));
      if (types.length > 0) where.eventType = { in: types };
    }

    if (userIdParam) {
      const uid = parseInt(userIdParam);
      if (!isNaN(uid)) where.userId = uid;
    }

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) dateFilter.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) dateFilter.lte = d;
      }
      if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    }

    if (q) {
      where.OR = [
        { userName: { contains: q, mode: "insensitive" } },
        { handle: { contains: q, mode: "insensitive" } },
        { meta: { contains: q, mode: "insensitive" } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      entries: entries.map(e => ({
        id: e.id,
        eventType: e.eventType,
        userId: e.userId ?? null,
        userName: e.userName ?? null,
        handle: e.handle ?? null,
        avatar: e.avatar ?? null,
        meta: e.meta ?? null,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[admin/analytics/activity]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}