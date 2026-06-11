import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { dec } from "@/app/lib/ads";

const ANON_COOKIE = "ad_uid";

// Public endpoint — ads are shown to logged-out users too. userId is best-effort.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignId = Number(body.campaignId);
    const creativeId = body.creativeId ? Number(body.creativeId) || null : null;
    const type = String(body.type || "").toUpperCase();
    const placement = String(body.placement || "Feed");

    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    if (type !== "IMPRESSION" && type !== "CLICK")
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });

    const campaign = await prisma.adCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== "ACTIVE") {
      // Don't error — the ad may have just been paused. Silently ignore.
      return NextResponse.json({ success: true, recorded: false });
    }

    const userId = body.userId ? Number(body.userId) || null : null;
    const anonId = userId ? null : request.cookies.get(ANON_COOKIE)?.value ?? null;

    // Dedup clicks: one click per user/anon per campaign per hour to prevent budget drain
    if (type === "CLICK") {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const where: Record<string, unknown> = { campaignId, type: "CLICK", createdAt: { gte: since } };
      if (userId) where.userId = userId;
      else if (anonId) where.anonId = anonId;
      else where.anonId = null; // fully anonymous — allow (no fingerprint to dedup on)

      if (userId || anonId) {
        const existing = await prisma.adEvent.findFirst({ where, select: { id: true } });
        if (existing) return NextResponse.json({ success: true, recorded: false });
      }
    }

    await prisma.adEvent.create({
      data: { campaignId, creativeId, type: type as any, placement, userId, anonId },
    });

    // Denormalized per-creative counters drive A/B rotation in the serve route.
    if (creativeId) {
      await prisma.adCreative
        .update({
          where: { id: creativeId },
          data: type === "CLICK" ? { clicks: { increment: 1 } } : { impressions: { increment: 1 } },
        })
        .catch(() => {}); // creative may have been deleted; event still recorded
    }

    // Charge CPC on click and auto-complete when budget is exhausted.
    if (type === "CLICK") {
      const cpc = dec(campaign.cpc);
      const budget = dec(campaign.budget);
      const newSpent = dec(campaign.spent) + cpc;
      const exhausted = budget > 0 && newSpent >= budget;
      await prisma.adCampaign.update({
        where: { id: campaignId },
        data: {
          spent: newSpent,
          ...(exhausted ? { status: "COMPLETED" } : {}),
        },
      });
    }

    return NextResponse.json({ success: true, recorded: true });
  } catch (error) {
    console.error("[ADS_EVENT_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
