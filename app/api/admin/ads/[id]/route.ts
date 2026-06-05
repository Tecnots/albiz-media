import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { serializeCampaign, buildCountsMap, parseMoney, AD_SETTINGS_KEY, DEFAULT_AD_SETTINGS } from "@/app/lib/ads";

async function requireAdAccess(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return { error: unauthorized() as Response, authUser: null };
  if (authUser.role !== "ADMIN" && authUser.role !== "AUTHOR") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), authUser: null };
  }
  return { error: null, authUser };
}

const VALID_STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAdAccess(request);
    if (error) return error;

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const existing = await prisma.adCampaign.findUnique({ where: { id }, include: { creatives: true } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const body = await request.json();
    const data: any = {};

    // Status changes — pause/resume/activate/complete
    if (body.status) {
      const status = String(body.status).toUpperCase();
      if (!VALID_STATUSES.includes(status))
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      data.status = status;
    }

    if (body.name != null) data.name = String(body.name).trim();
    if (body.advertiser != null) data.advertiserName = String(body.advertiser).trim();
    if (body.advertiserEmail != null) data.advertiserEmail = body.advertiserEmail || null;
    if (body.budget != null) data.budget = parseMoney(body.budget);
    if (body.cpc != null) {
      const cpc = parseMoney(body.cpc);
      const settingsRow = await prisma.adminSetting.findUnique({ where: { key: AD_SETTINGS_KEY } });
      const settings = { ...DEFAULT_AD_SETTINGS, ...(settingsRow?.value as object | undefined) };
      if (settings.maxCpcBid && cpc > settings.maxCpcBid) {
        return NextResponse.json(
          { error: `CPC bid cannot exceed $${settings.maxCpcBid.toFixed(2)}` },
          { status: 400 },
        );
      }
      data.cpc = cpc;
    }
    if (Array.isArray(body.placements)) data.placements = body.placements;
    if (body.startDate) data.startDate = new Date(body.startDate);
    if (body.endDate) data.endDate = new Date(body.endDate);
    if (body.promoteType != null) data.promoteType = body.promoteType;

    // Targeting + pacing edits
    if (Array.isArray(body.targetCountries))
      data.targetCountries = body.targetCountries.map((s: unknown) => String(s).toUpperCase()).filter(Boolean);
    if (Array.isArray(body.targetTags))
      data.targetTags = body.targetTags.map((s: unknown) => String(s).trim()).filter(Boolean);
    if (body.targetAudience != null && ["all", "guests", "members", "followers"].includes(body.targetAudience))
      data.targetAudience = body.targetAudience;
    if (body.pacing != null) data.pacing = body.pacing === "accelerated" ? "accelerated" : "even";
    if (body.dailyBudget !== undefined)
      data.dailyBudget = body.dailyBudget === null || String(body.dailyBudget) === "" ? null : parseMoney(body.dailyBudget);
    if (body.frequencyCap != null) data.frequencyCap = Number(body.frequencyCap) > 0 ? Math.floor(Number(body.frequencyCap)) : 0;
    if (body.priority != null) data.priority = Math.max(0, Math.floor(Number(body.priority) || 0));

    // Creative edits (Live Ads tab)
    const creativeData: any = {};
    if (body.headline != null || body.adHeadline != null)
      creativeData.headline = String(body.headline ?? body.adHeadline);
    if (body.brand != null || body.sponsorName != null)
      creativeData.sponsorName = String(body.sponsorName ?? body.brand);
    if (body.image != null || body.adImage != null)
      creativeData.imageUrl = body.image ?? body.adImage ?? null;
    if (body.ctaText != null || body.adCta != null) creativeData.ctaText = body.ctaText ?? body.adCta;
    if (body.ctaUrl != null || body.adCtaUrl != null) creativeData.ctaUrl = body.ctaUrl ?? body.adCtaUrl ?? null;
    if (body.description != null) creativeData.description = body.description || null;

    if (Object.keys(creativeData).length > 0) {
      const creativeId = existing.creatives[0]?.id;
      if (creativeId) {
        data.creatives = { update: { where: { id: creativeId }, data: creativeData } };
      } else {
        data.creatives = {
          create: {
            headline: creativeData.headline ?? existing.name,
            sponsorName: creativeData.sponsorName ?? existing.advertiserName,
            ctaText: creativeData.ctaText ?? "Learn More",
            ...creativeData,
          },
        };
      }
    }

    const updated = await prisma.adCampaign.update({
      where: { id },
      data,
      include: { creatives: true },
    });

    const grouped = await prisma.adEvent.groupBy({
      by: ["campaignId", "type"],
      where: { campaignId: id },
      _count: { _all: true },
    });
    const counts = buildCountsMap(grouped as any)[id] ?? { impressions: 0, clicks: 0 };

    return NextResponse.json(serializeCampaign(updated, counts));
  } catch (error) {
    console.error("[ADMIN_ADS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAdAccess(request);
    if (error) return error;

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await prisma.adCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ADMIN_ADS_DELETE]", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
