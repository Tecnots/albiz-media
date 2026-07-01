import { NextResponse, NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";
import {
  AD_SETTINGS_KEY,
  DEFAULT_AD_SETTINGS,
  AD_ALGORITHM_KEY,
  DEFAULT_AD_ALGORITHM,
  dec,
} from "@/app/lib/ads";
import { getAuthUser } from "@/app/lib/auth";
import {
  scoreAd,
  pickCreative,
  type AdViewerContext,
  type AdCampaignForScoring,
} from "@/app/lib/ads-algorithm";

// Synthetic id base so served ads never collide with real post / news / sponsored ids.
const AD_ID_BASE = 9_000_000;
const ANON_COOKIE = "ad_uid";

function startOfTodayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayFractionUTC(): number {
  const d = new Date();
  const secs = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
  return secs / 86_400;
}

// Build everything the scorer needs about the current viewer. Guests resolve to
// a null userId and are tracked by an anonymous cookie for frequency capping.
async function buildViewerContext(
  request: NextRequest,
  userId: number | null,
  anonId: string,
): Promise<AdViewerContext> {
  const since = startOfTodayUTC();

  let countryCode: string | null = null;
  let userTags: string[] = [];
  let followingIds = new Set<number>();

  if (userId) {
    const [countryRows, tagRows, followRows] = await Promise.all([
      prisma.$queryRaw<{ countryCode: string | null }[]>`
        SELECT "countryCode" FROM "User" WHERE id = ${userId}`.catch(() => []),
      prisma.$queryRaw<{ name: string }[]>`
        SELECT name FROM "UserInterest" WHERE "userId" = ${userId}`.catch(() => []),
      prisma.$queryRaw<{ followingId: number }[]>`
        SELECT "followingId" FROM "UserFollow" WHERE "followerId" = ${userId}`.catch(() => []),
    ]);
    countryCode = countryRows[0]?.countryCode ?? null;
    userTags = tagRows.map((r: { name: any; }) => r.name);
    followingIds = new Set(followRows.map((r: { followingId: any; }) => r.followingId));
  } else {
    // Best-effort geo for guests — read Vercel's built-in header (no extra cost or latency).
    countryCode = request.headers.get("x-vercel-ip-country") ?? null;
  }

  // Today's impressions for this viewer (per campaign) → frequency capping.
  const impressionWhere = userId ? { userId } : { anonId };
  const impressionGroups = await prisma.adEvent
    .groupBy({
      by: ["campaignId"],
      where: { type: "IMPRESSION", createdAt: { gte: since }, ...impressionWhere },
      _count: { _all: true },
    })
    .catch(() => [] as { campaignId: number; _count: { _all: number } }[]);
  const recentImpressions = new Map<number, number>();
  for (const g of impressionGroups) recentImpressions.set(g.campaignId, g._count._all);

  return {
    userId,
    countryCode,
    userTags,
    followingIds,
    isMember: userId != null,
    recentImpressions,
    spentToday: new Map(), // filled per-candidate below using each campaign's cpc
    dayFraction: dayFractionUTC(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placement = searchParams.get("placement") || "Feed"; // Feed | Sidebar | Stories | Custom
    // zone_type=overlay fetches campaigns linked to any custom zone of that region type
    const zoneType = searchParams.get("zone_type");

    const [settingsRow, algorithmRow] = await Promise.all([
      prisma.adminSetting.findUnique({ where: { key: AD_SETTINGS_KEY } }),
      prisma.adminSetting.findUnique({ where: { key: AD_ALGORITHM_KEY } }),
    ]);
    const settings = { ...DEFAULT_AD_SETTINGS, ...(settingsRow?.value as object | undefined) };
    const weights = { ...DEFAULT_AD_ALGORITHM, ...(algorithmRow?.value as object | undefined) };

    if (!zoneType) {
      if (placement === "Sidebar" && !settings.sidebarEnabled) return NextResponse.json({ ads: [] });
      if (placement === "Stories" && !settings.storiesEnabled) return NextResponse.json({ ads: [] });
    }

    // Identify the viewer (best-effort) and ensure an anonymous id for guests.
    const authUser = await getAuthUser(request).catch(() => null);
    const userId = authUser?.id ?? null;
    let anonId = request.cookies.get(ANON_COOKIE)?.value ?? "";
    let setAnonCookie = false;
    if (!anonId) {
      anonId = randomUUID();
      setAnonCookie = true;
    }

    const now = new Date();

    // Resolve which campaigns to score.
    // For custom zone types (e.g. zone_type=overlay), look up campaigns via AdCampaignPlacement.
    // For standard placements (Feed/Sidebar/Stories/Custom), use the placements[] array on the campaign.
    let campaigns: any[] = [];
    let resolvedPlacement = placement;

    if (zoneType) {
      // Find all active zones of this type
      const zones = await prisma.adPlacementZone.findMany({
        where: { zone: zoneType, isActive: true },
        select: { id: true, key: true },
      });
      if (zones.length === 0) return NextResponse.json({ ads: [] });
      resolvedPlacement = zones[0]?.key ?? zoneType;

      const linked = await prisma.adCampaignPlacement.findMany({
        where: { zoneId: { in: zones.map((z: { id: any; }) => z.id) } },
        select: { campaignId: true },
      });
      const campaignIds = [...new Set(linked.map((l: { campaignId: any; }) => l.campaignId))];
      if (campaignIds.length === 0) return NextResponse.json({ ads: [] });

      campaigns = await prisma.adCampaign.findMany({
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
          id: { in: campaignIds },
        },
        include: { creatives: true },
        take: 200,
      });
    } else {
      campaigns = await prisma.adCampaign.findMany({
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
          placements: { has: placement },
        },
        include: { creatives: true },
        // Wide pool — ranking, not recency, decides who serves.
        take: 200,
      });
    }

    const ctx = await buildViewerContext(request, userId, anonId);

    // Today's spend per campaign (clicks today × cpc) for even-pacing throttle.
    if (campaigns.some((c) => c.pacing === "even" && c.dailyBudget)) {
      const clickGroups = await prisma.adEvent
        .groupBy({
          by: ["campaignId"],
          where: { type: "CLICK", createdAt: { gte: startOfTodayUTC() } },
          _count: { _all: true },
        })
        .catch(() => [] as { campaignId: number; _count: { _all: number } }[]);
      const clickMap = new Map<number, number>(
        clickGroups.map((g: any) => [g.campaignId as number, g._count._all as number]),
      );
      for (const c of campaigns) {
        ctx.spentToday.set(c.id, (clickMap.get(c.id) ?? 0) * dec(c.cpc));
      }
    }

    const maxCpc = Math.max(0.01, ...campaigns.map((c) => dec(c.cpc)));
    const nowMs = now.getTime();

    type Ranked = { campaign: (typeof campaigns)[number]; creative: any; score: number; reason: string };
    const ranked: Ranked[] = [];

    for (const c of campaigns) {
      if (c.creatives.length === 0) continue;
      const creative = pickCreative(
        c.creatives.map((cr: any) => ({ ...cr, weight: cr.weight ?? 1 })),
        weights.ctrInfluence,
        Math.random(),
      );
      if (!creative) continue;

      const forScoring: AdCampaignForScoring = {
        id: c.id,
        cpc: dec(c.cpc),
        createdAt: c.createdAt,
        priority: c.priority ?? 0,
        promoteTargetId: c.promoteTargetId,
        targetCountries: c.targetCountries ?? [],
        targetTags: c.targetTags ?? [],
        targetAudience: c.targetAudience ?? "all",
        pacing: c.pacing ?? "even",
        dailyBudget: c.dailyBudget ? dec(c.dailyBudget) : null,
        frequencyCap: c.frequencyCap ?? 0,
        advertiserName: c.advertiserName,
      };

      const result = scoreAd(forScoring, creative, ctx, weights, maxCpc, nowMs);
      if (!result.eligible) continue;
      ranked.push({ campaign: c, creative, score: result.score, reason: result.reason });
    }

    ranked.sort((a, b) => b.score - a.score);

    // Diversity — avoid serving the same advertiser twice in a row.
    let ordered = ranked;
    if (weights.diversity && ranked.length > 1) {
      ordered = [];
      const pool = [...ranked];
      let lastAdvertiser = "";
      while (pool.length > 0) {
        const idx = pool.findIndex((r) => r.campaign.advertiserName !== lastAdvertiser);
        const pick = pool.splice(idx >= 0 ? idx : 0, 1)[0];
        ordered.push(pick);
        lastAdvertiser = pick.campaign.advertiserName;
      }
    }

    const ads = ordered.slice(0, Math.max(1, settings.maxAdsPerPage)).map(({ campaign: c, creative, reason }) => ({
      id: AD_ID_BASE + c.id,
      campaignId: c.id,
      creativeId: creative.id,
      isDbAd: true,
      placement: resolvedPlacement,
      title: creative.headline,
      description: creative.description ?? "",
      image: blobStorageService.resolveMediaUrl(creative.imageUrl ?? c.creatives[0]?.imageUrl ?? null),
      tags: [] as string[],
      date: "Sponsored",
      reason,
      sponsor: { name: creative.sponsorName, logo: blobStorageService.resolveMediaUrl(creative.sponsorLogo ?? null) },
      ctaText: creative.ctaText,
      ctaUrl: creative.ctaUrl ?? null,
      promoteType: c.promoteType,
      promoteTargetId: c.promoteTargetId,
      stats: { views: "0", likes: "0", comments: "0", shares: "0" },
    }));

    const response = NextResponse.json({ ads, frequency: settings.feedAdFrequency });
    if (setAnonCookie) {
      response.cookies.set(ANON_COOKIE, anonId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 90, // 90 days
        path: "/",
      });
    }
    return response;
  } catch (error) {
    console.error("[ADS_SERVE_GET]", error);
    return NextResponse.json({ ads: [] });
  }
}
