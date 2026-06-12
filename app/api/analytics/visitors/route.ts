import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const now = new Date();
    const last30m = new Date(now.getTime() - 30 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [live, total24h, total7d, allLogs] = await prisma.$transaction([
      prisma.visitorLog.count({ where: { createdAt: { gte: last30m } } }),
      prisma.visitorLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.visitorLog.count({ where: { createdAt: { gte: last7d } } }),
      prisma.visitorLog.findMany({
        where: { createdAt: { gte: last30d } },
        select: { country: true, countryCode: true, city: true, lat: true, lon: true, device: true, page: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Country breakdown
    const countryMap: Record<string, { country: string; countryCode: string; count: number; lat: number; lon: number }> = {};
    for (const log of allLogs) {
      if (!log.country || !log.countryCode) continue;
      const key = log.countryCode;
      if (!countryMap[key]) {
        countryMap[key] = { country: log.country, countryCode: log.countryCode, count: 0, lat: log.lat ?? 0, lon: log.lon ?? 0 };
      }
      countryMap[key].count++;
    }
    const countries = Object.values(countryMap).sort((a, b) => b.count - a.count);

    // Device breakdown
    const deviceMap: Record<string, number> = {};
    for (const log of allLogs) {
      const d = log.device ?? "Desktop";
      deviceMap[d] = (deviceMap[d] ?? 0) + 1;
    }
    const devices = Object.entries(deviceMap).map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count);

    // Page breakdown
    const pageMap: Record<string, number> = {};
    for (const log of allLogs) {
      const p = log.page ?? "/";
      pageMap[p] = (pageMap[p] ?? 0) + 1;
    }
    const pages = Object.entries(pageMap).map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Hourly traffic for last 24h
    const hourly: Record<string, number> = {};
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now.getTime() - i * 60 * 60 * 1000);
      hourly[`${h.getHours()}:00`] = 0;
    }
    for (const log of allLogs.filter(l => new Date(l.createdAt) >= last24h)) {
      const h = `${new Date(log.createdAt).getHours()}:00`;
      if (h in hourly) hourly[h]++;
    }
    const hourlyData = Object.entries(hourly).map(([hour, count]) => ({ hour, count }));

    // Aggregated country dots — very faint background context
    const globePoints = countries.slice(0, 50).map(c => ({
      lat: c.lat, lng: c.lon, size: Math.min(c.count * 0.15 + 0.2, 1.5),
      color: "rgba(244,68,68,0.2)", label: `${c.country}: ${c.count} total`,
    }));

    const last5m = new Date(now.getTime() - 5 * 60 * 1000);
    const liveLogs = allLogs.filter(l => new Date(l.createdAt) >= last30m && l.lat && l.lon);

    // Group visitors by approximate location (1° grid ≈ 110km) so dots stay on land
    const locMap = new Map<string, { lat: number; lon: number; count: number; city: string; recency: "hot" | "warm" }>();
    for (const l of liveLogs) {
      // Round to 1 decimal to cluster nearby visits without spreading
      const key = `${l.lat!.toFixed(1)},${l.lon!.toFixed(1)}`;
      const rec = new Date(l.createdAt) >= last5m ? "hot" : "warm";
      if (locMap.has(key)) {
        const e = locMap.get(key)!;
        e.count++;
        if (rec === "hot") e.recency = "hot"; // hot wins
      } else {
        locMap.set(key, { lat: l.lat!, lon: l.lon!, count: 1, city: l.city ?? l.country ?? "Visitor", recency: rec });
      }
    }

    const liveRings = Array.from(locMap.values()).map(g => ({
      lat: g.lat,
      lng: g.lon,
      recency: g.recency,
      count: g.count,
      label: `${g.city} · ${g.count} visitor${g.count > 1 ? "s" : ""} · ${g.recency === "hot" ? "just now" : "5-30 min ago"}`,
    }));

    // Live arcs: draw from each visitor country toward the platform origin.
    // Platform origin (server/HQ) is read from env; falls back to a neutral central point.
    const originLat = parseFloat(process.env.PLATFORM_ORIGIN_LAT ?? "20");
    const originLng = parseFloat(process.env.PLATFORM_ORIGIN_LNG ?? "78");
    const liveArcs = countries.slice(0, 6).map(c => ({
      startLat: c.lat, startLng: c.lon,
      endLat: originLat, endLng: originLng,
      color: ["#F44444", "rgba(244,68,68,0)"],
    }));

    return NextResponse.json({
      live,
      total24h,
      total7d,
      total30d: allLogs.length,
      countries: countries.slice(0, 20),
      devices,
      pages,
      hourlyData,
      globePoints,
      liveRings,
      liveArcs,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
