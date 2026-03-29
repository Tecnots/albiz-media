import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { page, referrer } = await request.json();

    // Get real IP (x-forwarded-for in production, fallback to connection)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Detect device type from user agent
    const ua = request.headers.get("user-agent") ?? "";
    const device = /mobile|android|iphone|ipad|tablet/i.test(ua)
      ? /tablet|ipad/i.test(ua) ? "Tablet" : "Mobile"
      : "Desktop";

    // Skip localhost/private IPs (dev)
    const isLocal = ip === "::1" || ip === "127.0.0.1" || ip === "unknown" || ip.startsWith("192.168.") || ip.startsWith("10.");

    let geo: { country?: string; countryCode?: string; city?: string; lat?: number; lon?: number } = {};

    if (!isLocal) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,city,lat,lon`, { signal: AbortSignal.timeout(2000) });
        if (geoRes.ok) {
          const data = await geoRes.json();
          if (data.status !== "fail") {
            geo = { country: data.country, countryCode: data.countryCode, city: data.city, lat: data.lat, lon: data.lon };
          }
        }
      } catch { /* geo lookup failed — log without location */ }
    } else {
      // In development, use India as default so the globe shows something
      geo = { country: "India", countryCode: "IN", city: "Mumbai", lat: 19.08, lon: 72.88 };
    }

    await prisma.visitorLog.create({
      data: { ...geo, page: page ?? null, device, referrer: referrer ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
