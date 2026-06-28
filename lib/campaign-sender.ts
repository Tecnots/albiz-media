import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

type AudienceType = "all" | "authors" | "editors" | "circle" | "verified" | "admin" | "role";

function buildAudienceWhere(
  audienceType: AudienceType,
  audienceFilter: Record<string, unknown> | null
): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = {
    banned: false,
    deactivatedAt: null,
  };

  switch (audienceType) {
    case "all":
      return base;
    case "authors":
      return { ...base, role: "AUTHOR" };
    case "editors":
      return { ...base, role: "EDITOR" };
    case "circle":
      return { ...base, role: "CIRCLE" };
    case "verified":
      return { ...base, verified: true };
    case "admin":
      return { ...base, role: "ADMIN" };
    case "role": {
      const role = audienceFilter?.role as string | undefined;
      if (!role) throw new Error("audienceFilter.role required for audience type 'role'");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ...base, role: role as any };
    }
    default:
      throw new Error(`Unknown audience type: ${audienceType}`);
  }
}

// Transitions a draft campaign to 'sending', queries the audience, and fans out
// one send-campaign-email job per recipient — all inside a single transaction.
// Returns the number of recipients enqueued (0 if audience is empty).
export async function fanOutCampaign(campaignId: string): Promise<number> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { audienceType: true, audienceFilter: true, status: true },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") {
    throw new Error(`STATUS_CHANGED:${campaign.status}`);
  }

  const where = buildAudienceWhere(
    campaign.audienceType as AudienceType,
    campaign.audienceFilter as Record<string, unknown> | null
  );

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true },
    take: 10_000,
  });

  if (users.length === 10_000) {
    console.warn(
      `[CAMPAIGN] fanOutCampaign: audience cap (10k) reached for campaign ${campaignId} — ` +
        `additional recipients beyond 10,000 were excluded. Segment the audience or raise the cap for larger sends.`
    );
  }

  // Zero-recipient case: mark campaign sent immediately without creating jobs.
  if (users.length === 0) {
    await prisma.$executeRaw`
      UPDATE "EmailCampaign"
      SET status = 'sent', "recipientCount" = 0, "sentAt" = NOW()
      WHERE id = ${campaignId} AND status = 'draft'
    `;
    return 0;
  }

  // Pre-generate all IDs client-side so recipient rows and job rows can be linked
  // atomically within a single transaction without a round-trip to fetch auto IDs.
  const rows = users.map((u) => ({
    recipientRowId: randomUUID(),
    jobId: randomUUID(),
    userId: u.id,
    email: u.email,
    name: u.name,
  }));

  await prisma.$transaction(async (tx) => {
    // Lock campaign row and re-verify status — guards against concurrent sends.
    const locked = await tx.$queryRaw<{ status: string }[]>(
      Prisma.sql`SELECT status FROM "EmailCampaign" WHERE id = ${campaignId} FOR UPDATE`
    );
    if (!locked.length) throw new Error("Campaign not found in transaction");
    if (locked[0].status !== "draft") throw new Error(`STATUS_CHANGED:${locked[0].status}`);

    await tx.emailCampaignRecipient.createMany({
      data: rows.map((r) => ({
        id: r.recipientRowId,
        campaignId,
        userId: r.userId,
        email: r.email,
        name: r.name,
        status: "pending",
        jobId: r.jobId,
      })),
    });

    await tx.job.createMany({
      data: rows.map((r) => ({
        id: r.jobId,
        type: "send-campaign-email",
        payload: { campaignId, recipientRowId: r.recipientRowId } as Prisma.InputJsonValue,
        maxAttempts: 3,
        priority: 5,
        scheduledAt: new Date(),
      })),
    });

    await tx.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "sending", recipientCount: rows.length },
    });
  });

  return rows.length;
}