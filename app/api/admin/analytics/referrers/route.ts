import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function categorize(referrer: string | null): string {
  if (!referrer || referrer.trim() === "") return "Direct";
  const r = referrer.toLowerCase();
  if (/google\./i.test(r)) return "Google";
  if (/bing\.com/i.test(r)) return "Bing";
  if (/duckduckgo\.com/i.test(r)) return "DuckDuckGo";
  if (/yahoo\.com/i.test(r)) return "Yahoo";
  if (/facebook\.com|fb\.me/i.test(r)) return "Facebook";
  if (/twitter\.com|t\.co|x\.com/i.test(r)) return "Twitter / X";
  if (/linkedin\.com/i.test(r)) return "LinkedIn";
  if (/instagram\.com/i.test(r)) return "Instagram";
  if (/youtube\.com|youtu\.be/i.test(r)) return "YouTube";
  if (/reddit\.com/i.test(r)) return "Reddit";
  if (/albiz|localhost/i.test(r)) return "Internal";
  return "Other";
}

function extractDomain(referrer: string): string {
  try {
    const url = new URL(referrer.startsWith("http") ? referrer : `https://${referrer}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return referrer.slice(0, 80);
  }
}

const SEARCH_SOURCES = new Set(["Google", "Bing", "DuckDuckGo", "Yahoo"]);
const SOCIAL_SOURCES = new Set(["Facebook", "Twitter / X", "LinkedIn", "Instagram", "YouTube", "Reddit"]);

const SOURCE_ORDER = [
  "Direct", "Google", "Facebook", "Twitter / X", "LinkedIn",
  "Instagram", "YouTube", "Reddit", "Bing", "DuckDuckGo", "Yahoo", "Internal", "Other",
];

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const days = (!daysParam || daysParam === "all") ? 365 : Math.min(365, Math.max(1, parseInt(daysParam) || 30));

  const rangeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const logs = await prisma.visitorLog.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { referrer: true, createdAt: true },
    });

    const sourceMap = new Map<string, number>();
    const domainMap = new Map<string, number>();

    const DAY_MS = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const bucketCount = Math.min(days, 60);

    type DayBuckets = { direct: number; search: number; social: number; referral: number };
    const dayBuckets = new Map<string, DayBuckets>();

    for (const log of logs) {
      const src = categorize(log.referrer);
      sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);

      if (log.referrer && src !== "Direct" && src !== "Internal") {
        const domain = extractDomain(log.referrer);
        domainMap.set(domain, (domainMap.get(domain) ?? 0) + 1);
      }

      const d = new Date(log.createdAt);
      const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      const bucket = dayBuckets.get(k) ?? { direct: 0, search: 0, social: 0, referral: 0 };
      if (src === "Direct" || src === "Internal") bucket.direct++;
      else if (SEARCH_SOURCES.has(src)) bucket.search++;
      else if (SOCIAL_SOURCES.has(src)) bucket.social++;
      else bucket.referral++;
      dayBuckets.set(k, bucket);
    }

    const total = logs.length;

    const sources = SOURCE_ORDER
      .filter(s => sourceMap.has(s))
      .map(s => ({
        source: s,
        count: sourceMap.get(s) ?? 0,
        percentage: total > 0 ? Math.round(((sourceMap.get(s) ?? 0) / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topReferrers = [...domainMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([domain, count]) => ({
        domain,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }));

    const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
      const utc = new Date(nowMs - (bucketCount - 1 - i) * DAY_MS);
      const k = `${utc.getUTCFullYear()}-${utc.getUTCMonth()}-${utc.getUTCDate()}`;
      const bucket = dayBuckets.get(k) ?? { direct: 0, search: 0, social: 0, referral: 0 };
      return {
        date: `${MONTHS[utc.getUTCMonth()]} ${utc.getUTCDate()}`,
        ...bucket,
      };
    });

    return NextResponse.json({ total, sources, topReferrers, timeSeries });
  } catch (err) {
    console.error("[admin/analytics/referrers]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}