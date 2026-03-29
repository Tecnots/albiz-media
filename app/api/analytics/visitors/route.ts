import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const last30m = new Date(now.getTime() - 30 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [live, total24h, total7d, allLogs] = await Promise.all([
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

    // Globe points (country centroids with size = visitor count)
    const globePoints = countries.slice(0, 50).map(c => ({
      lat: c.lat, lng: c.lon, size: Math.min(c.count * 0.3 + 0.4, 3),
      color: "#F44444", label: `${c.country}: ${c.count} visitors`,
    }));

    // Live arcs for last 30 min (arcs from each country to center)
    const liveArcs = countries.slice(0, 8).map(c => ({
      startLat: c.lat, startLng: c.lon,
      endLat: 20, endLng: 78, // center (approx India/Asia)
      color: ["#F44444", "#FF8888"],
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
      liveArcs,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
