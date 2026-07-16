import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function buildAudienceWhere(
  audienceType: string,
  audienceFilter: Record<string, unknown> | null
): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { banned: false, deactivatedAt: null };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

  switch (audienceType) {
    case "all":       return base;
    case "authors":   return { ...base, role: "AUTHOR" };
    case "editors":   return { ...base, role: "EDITOR" };
    case "circle":    return { ...base, role: "CIRCLE" };
    case "uploaders": return { ...base, role: "UPLOADER" };
    case "verified":  return { ...base, verified: true };
    case "premium":   return { ...base, isPremium: true };
    case "admin":     return { ...base, role: "ADMIN" };
    case "active":    return { ...base, lastSeenAt: { gte: thirtyDaysAgo } };
    case "inactive":  return { ...base, lastSeenAt: { lte: ninetyDaysAgo } };
    case "role": {
      const role = audienceFilter?.role as string | undefined;
      if (!role) throw new Error("audienceFilter.role required");
      return { ...base, role: role as any };
    }
    default:
      throw new Error(`Unknown audience type: ${audienceType}`);
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const audienceType   = sp.get("audienceType") ?? "all";
  const audienceFilter = sp.get("audienceFilter") ? JSON.parse(sp.get("audienceFilter")!) : null;

  try {
    const where = buildAudienceWhere(audienceType, audienceFilter);
    const [total, withPushTokens] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.count({ where: { ...where, pushTokens: { some: {} } } }),
    ]);
    return NextResponse.json({ total, withPushTokens });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
