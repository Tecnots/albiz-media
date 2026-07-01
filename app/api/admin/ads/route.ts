import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/admin-notifier";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import {
  serializeCampaign,
  buildCountsMap,
  parseMoney,
  AD_SETTINGS_KEY,
  DEFAULT_AD_SETTINGS,
} from "@/app/lib/ads";

// Ad management is available to ADMIN and AUTHOR roles (same as the admin page).
async function requireAdAccess(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return { error: unauthorized() as Response, authUser: null };
  if (authUser.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), authUser: null };
  }
  return { error: null, authUser };
}

async function getAdSettings() {
  const row = await prisma.adminSetting.findUnique({ where: { key: AD_SETTINGS_KEY } });
  return { ...DEFAULT_AD_SETTINGS, ...(row?.value as object | undefined) };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "active" | "paused" | ... | null

    const where: any = {};
    if (status && status !== "all") where.status = status.toUpperCase();

    const campaigns = await prisma.adCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { creatives: true },
    });

    const grouped = await prisma.adEvent.groupBy({
      by: ["campaignId", "type"],
      _count: { _all: true },
    });
    const counts = buildCountsMap(grouped as any);

    const result = campaigns.map((c) =>
      serializeCampaign(c, counts[c.id] ?? { impressions: 0, clicks: 0 }),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ADMIN_ADS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, authUser } = await requireAdAccess(request);
    if (error) return error;

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const advertiser = String(body.advertiser ?? "").trim();
    const placements: string[] = Array.isArray(body.placements) ? body.placements : [];
    const customZoneIds: number[] = Array.isArray(body.customZoneIds)
      ? body.customZoneIds.map(Number).filter((n: number) => !isNaN(n))
      : [];

    if (!name) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    if (!advertiser) return NextResponse.json({ error: "Advertiser is required" }, { status: 400 });
    if (placements.length === 0 && customZoneIds.length === 0)
      return NextResponse.json({ error: "Select at least one placement" }, { status: 400 });

    const settings = await getAdSettings();
    const budget = parseMoney(body.budget);
    if (settings.minBudget && budget < settings.minBudget) {
      return NextResponse.json(
        { error: `Budget must be at least $${settings.minBudget}` },
        { status: 400 },
      );
    }

    const cpc = body.cpc != null ? parseMoney(body.cpc) : settings.defaultCpc;
    if (settings.maxCpcBid && cpc > settings.maxCpcBid) {
      return NextResponse.json(
        { error: `CPC bid cannot exceed $${settings.maxCpcBid.toFixed(2)}` },
        { status: 400 },
      );
    }
    const now = new Date();
    const startDate = body.startDate ? new Date(body.startDate) : now;
    const endDate = body.endDate ? new Date(body.endDate) : new Date(now.getTime() + 30 * 864e5);

    // Targeting + pacing (all optional; defaults keep the campaign untargeted)
    const targetCountries: string[] = Array.isArray(body.targetCountries)
      ? body.targetCountries.map((s: unknown) => String(s).toUpperCase()).filter(Boolean)
      : [];
    const targetTags: string[] = Array.isArray(body.targetTags)
      ? body.targetTags.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];
    const validAudiences = ["all", "guests", "members", "followers"];
    const targetAudience = validAudiences.includes(body.targetAudience) ? body.targetAudience : "all";
    const pacing = body.pacing === "accelerated" ? "accelerated" : "even";
    const dailyBudget = body.dailyBudget != null && String(body.dailyBudget) !== "" ? parseMoney(body.dailyBudget) : null;
    const frequencyCap = Number(body.frequencyCap) > 0 ? Math.floor(Number(body.frequencyCap)) : 0;
    const priority = Number.isFinite(Number(body.priority)) ? Math.max(0, Math.floor(Number(body.priority))) : 0;

    // Validate ctaUrl — reject javascript: and data: URIs
    const ctaUrl = body.adCtaUrl || null;
    if (ctaUrl) {
      try {
        const url = new URL(ctaUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return NextResponse.json({ error: 'Invalid CTA URL: only http and https are allowed' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid CTA URL' }, { status: 400 });
      }
    }

    // Optional A/B variants beyond the primary creative
    const variants: any[] = Array.isArray(body.variants) ? body.variants : [];

    // Status: pending review unless auto-approve is on; scheduled if start is future.
    let status: string;
    if (!settings.autoApprove) {
      status = "DRAFT";
    } else {
      status = startDate.getTime() > now.getTime() ? "SCHEDULED" : "ACTIVE";
    }

    const campaign = await prisma.adCampaign.create({
      data: {
        name,
        advertiserName: advertiser,
        advertiserEmail: body.advertiserEmail ? String(body.advertiserEmail) : null,
        status: status as any,
        budget,
        cpc,
        promoteType: body.promoteType ?? "custom",
        promoteTargetId: body.promoteTarget ? Number(body.promoteTarget) || null : null,
        placements,
        targetCountries,
        targetTags,
        targetAudience,
        pacing,
        dailyBudget,
        frequencyCap,
        priority,
        startDate,
        endDate,
        createdById: authUser.id,
        placementZones: customZoneIds.length > 0
          ? { create: customZoneIds.map((zoneId, i) => ({ zoneId, sortOrder: i })) }
          : undefined,
        creatives: {
          create: [
            {
              imageUrl: body.adImage || null,
              headline: String(body.adHeadline ?? name),
              description: body.adDescription ? String(body.adDescription) : null,
              ctaText: body.adCta || "Learn More",
              ctaUrl: ctaUrl,
              sponsorName: advertiser,
              sponsorLogo: body.sponsorLogo || null,
            },
            ...variants
              .filter((v) => v && (v.adImage || v.adHeadline || v.headline || v.image))
              .map((v) => ({
                imageUrl: v.image || v.adImage || null,
                headline: String(v.headline || v.adHeadline || name),
                description: v.adDescription ? String(v.adDescription) : null,
                ctaText: v.cta || v.adCta || "Learn More",
                ctaUrl: v.adCtaUrl || null,
                sponsorName: advertiser,
                sponsorLogo: v.sponsorLogo || null,
                weight: Number(v.weight) > 0 ? Math.floor(Number(v.weight)) : 1,
              })),
          ],
        },
      },
      include: { creatives: true },
    });

    notifyAdmin({
      type: "SYSTEM",
      title: settings.autoApprove ? "Ad campaign launched" : "Ad campaign submitted",
      message: `${name} by ${advertiser} — ${status.toLowerCase()}`,
      metadata: { campaignId: campaign.id, action: "ad_campaign_created" },
    });

    return NextResponse.json(serializeCampaign(campaign, { impressions: 0, clicks: 0 }));
  } catch (error) {
    console.error("[ADMIN_ADS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
