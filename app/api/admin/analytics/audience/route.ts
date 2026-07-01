import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcChange } from "@/app/lib/analytics-scoring";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// ?days=7|30|90|all
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const isAllTime = !daysParam || daysParam === "all";
    const days = isAllTime ? 365 : parseInt(daysParam!);
    const DAY_MS = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const rangeStart = new Date(nowMs - days * DAY_MS);
    const prevStart = new Date(nowMs - days * 2 * DAY_MS);
    const h24Ago = new Date(nowMs - DAY_MS);
    const m30Ago = new Date(nowMs - 30 * DAY_MS);
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    // fetch from whichever is earlier: period start or 6 months ago
    const signupFetchFrom = new Date(Math.min(rangeStart.getTime(), sixMonthsAgo.getTime()));

    const [
      totalUsers, prevNewUsers, dau, mau,
      roleRows, genderRows, birthYearRows, countryRows, deviceRows,
      signupRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: { gte: prevStart, lt: rangeStart } } }),
      prisma.user.count({ where: { lastSeenAt: { gte: h24Ago } } }),
      prisma.user.count({ where: { lastSeenAt: { gte: m30Ago } } }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["gender"], where: { gender: { not: null } }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["birthYear"], where: { birthYear: { not: null } }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ["countryCode", "country"], where: { countryCode: { not: null } }, _count: { _all: true } }),
      prisma.visitorLog.groupBy({ by: ["device"], where: { createdAt: { gte: m30Ago } }, _count: { _all: true } }),
      // single signup query covers both the period trend and the 6-month chart
      prisma.user.findMany({
        where: { emailVerified: { gte: signupFetchFrom } },
        select: { emailVerified: true, role: true },
      }),
    ]);

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // ── Split signup rows into period vs 6-month buckets ──
    const periodSignups = signupRows.filter((u: any) => u.emailVerified && new Date(u.emailVerified).getTime() >= rangeStart.getTime());
    const newUsers = periodSignups.length;
    const newUsersChange = calcChange(newUsers, prevNewUsers);

    // ── New users by role in period ──
    const roleCountMap = new Map<string, number>();
    for (const u of periodSignups) {
      const role = String(u.role ?? "NORMAL");
      roleCountMap.set(role, (roleCountMap.get(role) ?? 0) + 1);
    }
    const newByRole = [...roleCountMap.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    // ── Daily signup trend — last min(days, 30) days ──
    const dayMap = new Map<string, number>();
    for (const u of periodSignups) {
      if (!u.emailVerified) continue;
      const d = new Date(u.emailVerified);
      const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
    }
    const bucketCount = Math.min(days, 30);
    const signupTrend = Array.from({ length: bucketCount }, (_, i) => {
      const d = new Date(nowMs - (bucketCount - 1 - i) * DAY_MS);
      const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      return { date: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`, count: dayMap.get(k) ?? 0 };
    });

    // ── Monthly cumulative growth — last 6 months (for UserGrowthChart) ──
    const gainedByMonth = signupRows.reduce((acc: Map<string, number>, u: any) => {
      if (!u.emailVerified) return acc;
      const d = new Date(u.emailVerified);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      acc.set(k, (acc.get(k) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const totalGained6mo = [...gainedByMonth.values()].reduce((a, b) => a + b, 0);
    let cumulative = totalUsers - totalGained6mo;
    const userGrowth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const gained = gainedByMonth.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0;
      cumulative += gained;
      return { month: MONTHS[d.getMonth()], gained, cumulative: Math.max(0, cumulative) };
    });

    // ── Role breakdown (all users) ──
    const roleBreakdown = (roleRows as any[])
      .map(r => ({ role: String(r.role), count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    // ── Geo ──
    const countryMap = new Map<string, { name: string; count: number }>();
    for (const r of countryRows as any[]) {
      const code = (r.countryCode as string)?.toUpperCase();
      if (!code) continue;
      const e = countryMap.get(code);
      if (e) e.count += r._count._all;
      else countryMap.set(code, { name: r.country ?? code, count: r._count._all });
    }
    const topCountries = [...countryMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([code, { name, count }]) => ({
        code, name, count,
        pct: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0,
      }));

    // ── Gender ──
    const genderTotal = (genderRows as any[]).reduce((s, r) => s + r._count._all, 0);
    const genderSplit = (genderRows as any[]).map(r => ({
      label: r.gender === "male" ? "Male" : r.gender === "female" ? "Female"
        : r.gender === "nonbinary" ? "Non-binary" : "Other",
      count: r._count._all,
      pct: genderTotal > 0 ? Math.round((r._count._all / genderTotal) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // ── Age ──
    const currentYear = new Date().getFullYear();
    const AGE_BUCKETS = [
      { range: "18–24", min: 18, max: 24 }, { range: "25–34", min: 25, max: 34 },
      { range: "35–44", min: 35, max: 44 }, { range: "45–54", min: 45, max: 54 },
      { range: "55+", min: 55, max: 999 },
    ];
    const ageCounts = AGE_BUCKETS.map(b => ({ ...b, count: 0 }));
    for (const r of birthYearRows as any[]) {
      if (!r.birthYear) continue;
      const age = currentYear - r.birthYear;
      const bucket = ageCounts.find(b => age >= b.min && age <= b.max);
      if (bucket) bucket.count += r._count._all;
    }
    const ageTotal = ageCounts.reduce((s, b) => s + b.count, 0);
    const ageRanges = ageCounts.map(b => ({
      range: b.range, count: b.count,
      pct: ageTotal > 0 ? Math.round((b.count / ageTotal) * 100) : 0,
    }));

    // ── Devices ──
    const deviceTotal = (deviceRows as any[]).reduce((s, r) => s + r._count._all, 0);
    const devices = (deviceRows as any[])
      .map(r => ({
        label: r.device ?? "Unknown", count: r._count._all,
        pct: deviceTotal > 0 ? Math.round((r._count._all / deviceTotal) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalUsers,
      newUsers,
      newUsersChange,
      newByRole,
      dau,
      mau,
      stickiness: mau > 0 ? parseFloat(((dau / mau) * 100).toFixed(1)) : 0,
      roleBreakdown,
      userGrowth,
      signupTrend,
      topCountries,
      genderSplit,
      ageRanges,
      devices,
    });
  } catch (err) {
    console.error("[admin/analytics/audience] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
