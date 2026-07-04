import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/fcm-send";

interface CampaignPushPayload {
  campaignId: string;
  userId: number;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function processCampaignPush(payload: CampaignPushPayload): Promise<void> {
  const { campaignId, userId, title, body, url, icon } = payload;

  // Verify campaign is still active (not cancelled mid-flight)
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (!campaign || campaign.status === "cancelled") {
    console.log(`[CAMPAIGN_PUSH] Skipped userId=${userId} — campaign ${campaignId} is ${campaign?.status ?? "not found"}`);
    return;
  }

  try {
    await sendPushToUser(userId, { title, body, url: url ?? "/", icon });

    // Atomically increment push delivered count
    await prisma.$executeRaw`
      UPDATE "EmailCampaign"
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{pushDeliveredCount}',
        (COALESCE((metadata->>'pushDeliveredCount')::int, 0) + 1)::text::jsonb
      )
      WHERE id = ${campaignId}
    `;
  } catch (err) {
    console.error(`[CAMPAIGN_PUSH] Failed for userId=${userId} campaign=${campaignId}:`, err);

    await prisma.$executeRaw`
      UPDATE "EmailCampaign"
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{pushFailedCount}',
        (COALESCE((metadata->>'pushFailedCount')::int, 0) + 1)::text::jsonb
      )
      WHERE id = ${campaignId}
    `;

    throw err; // Re-throw so the job runner records the failure and retries
  }
}
