import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { extractIp } from "@/lib/audit";
import { resolveDomain } from "@/lib/domain-service";

// Called by middleware.ts on every request to a non-platform hostname.
// Rate-limited per-IP AND per-domain so heavy traffic to one custom domain
// can never exhaust the shared budget for every other domain on the platform
// (the previous single global per-IP bucket was starved by middleware never
// forwarding the real client IP — see middleware.ts for the corresponding fix).
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  const ip = extractIp(request) ?? "unknown";
  const [ipLimit, domainLimit] = await Promise.all([
    rateLimit(`domain-resolve:ip:${ip}`, 300, 60_000),
    rateLimit(`domain-resolve:domain:${domain}`, 600, 60_000),
  ]);
  const limit = !ipLimit.allowed ? ipLimit : domainLimit;
  if (!limit.allowed) {
    console.warn(`[domain/resolve] rate limited — ip=${ip} domain=${domain}`);
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const handle = await resolveDomain(domain);
  if (!handle) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }
  return NextResponse.json({ handle });
}
