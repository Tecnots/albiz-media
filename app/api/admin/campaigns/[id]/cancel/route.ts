import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");

  // Atomic: only cancel if the campaign is still in draft or sending state.
  const affected = await prisma.$executeRaw`
    UPDATE "EmailCampaign"
    SET status = 'cancelled'
    WHERE id = ${id} AND status IN ('draft', 'sending')
  `;

  if (affected === 0) {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json(
      { error: `Cannot cancel — campaign status is '${campaign.status}'` },
      { status: 409 }
    );
  }

  // Dead-kill all pending recipient jobs — fire-and-forget.
  prisma.$executeRaw`
    UPDATE "Job"
    SET status = 'dead', "lastError" = 'Campaign cancelled'
    WHERE id IN (
      SELECT "jobId" FROM "EmailCampaignRecipient"
      WHERE "campaignId" = ${id} AND "jobId" IS NOT NULL
    ) AND status = 'pending'
  `.catch((err) => console.error("[cancel-campaign] Job cleanup error:", err));

  // Mark unprocessed recipient rows as skipped — fire-and-forget.
  prisma.emailCampaignRecipient
    .updateMany({ where: { campaignId: id, status: "pending" }, data: { status: "skipped" } })
    .catch((err) => console.error("[cancel-campaign] Recipient cleanup error:", err));

  await logActivity({
    eventType: "CAMPAIGN_CANCELLED",
    userId: user.id,
    meta: JSON.stringify({ campaignId: id }),
  });

  return NextResponse.json({ success: true });
}