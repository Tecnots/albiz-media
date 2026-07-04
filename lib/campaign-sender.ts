import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

type AudienceType =
  | "all" | "authors" | "editors" | "circle" | "uploaders"
  | "verified" | "premium" | "admin" | "active" | "inactive" | "role";

export function buildAudienceWhere(
  audienceType: AudienceType,
  audienceFilter: Record<string, unknown> | null
): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { banned: false, deactivatedAt: null };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

  switch (audienceType) {
    case "all":       return base;
    case "authors":   return { ...base, role: "AUTHOR" };
    case "editors":   return { ...base, role: "EDITOR" };
    case "circle":    return { ...base, role: "CIRCLE" };
    case "uploaders": return { ...base, role: "SHORTS_CREATOR" };
    case "verified":  return { ...base, verified: true };
    case "premium":   return { ...base, isPremium: true };
    case "admin":     return { ...base, role: "ADMIN" };
    case "active":    return { ...base, lastSeenAt: { gte: thirtyDaysAgo } };
    case "inactive":  return { ...base, lastSeenAt: { lte: ninetyDaysAgo } };
    case "role": {
      const role = audienceFilter?.role as string | undefined;
      if (!role) throw new Error("audienceFilter.role required for audience type 'role'");
      return { ...base, role: role as any };
    }
    default:
      throw new Error(`Unknown audience type: ${audienceType}`);
  }
}

// Transitions a draft campaign to 'sending', queries the audience, and fans out
// one send-campaign-email job per email recipient and one send-campaign-push job
// per push-enabled recipient — all inside a single transaction.
// Returns the number of email recipients enqueued (0 if audience is empty).
export async function fanOutCampaign(campaignId: string): Promise<number> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { audienceType: true, audienceFilter: true, status: true, metadata: true },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error(`STATUS_CHANGED:${campaign.status}`);

  const meta = campaign.metadata as Record<string, unknown> | null;
  const channels = (meta?.channels as string[]) ?? ["email"];
  const emailEnabled = channels.includes("email");
  const pushEnabled  = channels.includes("push");

  const where = buildAudienceWhere(
    campaign.audienceType as AudienceType,
    campaign.audienceFilter as Record<string, unknown> | null
  );

  const [users, pushUsers] = await Promise.all([
    emailEnabled
      ? prisma.user.findMany({ where, select: { id: true, email: true, name: true }, take: 10_000 })
      : Promise.resolve([] as { id: number; email: string; name: string }[]),
    pushEnabled
      ? prisma.user.findMany({
          where: { ...where, pushTokens: { some: {} } },
          select: { id: true },
          take: 10_000,
        })
      : Promise.resolve([] as { id: number }[]),
  ]);

  if (users.length === 10_000 || pushUsers.length === 10_000) {
    console.warn(`[CAMPAIGN] Audience cap (10k) reached for campaign ${campaignId}`);
  }

  if (users.length === 0 && pushUsers.length === 0) {
    await prisma.$executeRaw`
      UPDATE "EmailCampaign"
      SET status = 'sent', "recipientCount" = 0, "sentAt" = NOW()
      WHERE id = ${campaignId} AND status = 'draft'
    `;
    return 0;
  }

  const emailRows = users.map(u => ({
    recipientRowId: randomUUID(),
    jobId: randomUUID(),
    userId: u.id,
    email: u.email,
    name: u.name,
  }));

  const pushRows = pushUsers.map(u => ({
    userId: u.id,
    jobId: randomUUID(),
  }));

  const updatedMeta: Record<string, unknown> = {
    ...meta,
    pushRecipientCount: pushRows.length,
    pushDeliveredCount: 0,
    pushFailedCount: 0,
  };

  await prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<{ status: string }[]>(
      Prisma.sql`SELECT status FROM "EmailCampaign" WHERE id = ${campaignId} FOR UPDATE`
    );
    if (!locked.length) throw new Error("Campaign not found in transaction");
    if (locked[0].status !== "draft") throw new Error(`STATUS_CHANGED:${locked[0].status}`);

    if (emailRows.length > 0) {
      await tx.emailCampaignRecipient.createMany({
        data: emailRows.map(r => ({
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
        data: emailRows.map(r => ({
          id: r.jobId,
          type: "send-campaign-email",
          payload: { campaignId, recipientRowId: r.recipientRowId } as Prisma.InputJsonValue,
          maxAttempts: 3,
          priority: 5,
          scheduledAt: new Date(),
        })),
      });
    }

    if (pushRows.length > 0) {
      const msgTitle = (meta?.messageTitle as string | undefined) || "";
      const msgBody  = (meta?.notificationBody as string | undefined) || "";

      await tx.job.createMany({
        data: pushRows.map(r => ({
          id: r.jobId,
          type: "send-campaign-push",
          payload: {
            campaignId,
            userId: r.userId,
            title: msgTitle,
            body:  msgBody,
          } as Prisma.InputJsonValue,
          maxAttempts: 2,
          priority: 5,
          scheduledAt: new Date(),
        })),
      });
    }

    await tx.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: "sending",
        recipientCount: emailRows.length,
        metadata: updatedMeta as Prisma.InputJsonValue,
      },
    });
  });

  return emailRows.length;
}
