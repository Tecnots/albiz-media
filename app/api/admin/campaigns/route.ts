import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { prisma } = await import("@/lib/prisma");

  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      subject: true,
      audienceType: true,
      status: true,
      scheduledAt: true,
      sentAt: true,
      recipientCount: true,
      deliveredCount: true,
      failedCount: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name, subject, bodyHtml, audienceType, audienceFilter, scheduledAt } = body as {
    name?: string;
    subject?: string;
    bodyHtml?: string;
    audienceType?: string;
    audienceFilter?: Record<string, unknown>;
    scheduledAt?: string;
  };

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!subject?.trim()) return NextResponse.json({ error: "subject is required" }, { status: 400 });
  if (!bodyHtml?.trim()) return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });

  const validAudienceTypes = ["all", "authors", "editors", "circle", "verified", "admin", "role"];
  if (!audienceType || !validAudienceTypes.includes(audienceType)) {
    return NextResponse.json({ error: "Valid audienceType is required" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: name.trim(),
      subject: subject.trim(),
      bodyHtml: bodyHtml.trim(),
      audienceType,
      audienceFilter: audienceFilter ? (audienceFilter as Prisma.InputJsonValue) : undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      createdById: user.id,
    },
    select: { id: true },
  });

  await logActivity({
    eventType: "CAMPAIGN_CREATED",
    userId: user.id,
    meta: JSON.stringify({ campaignId: campaign.id, name, audienceType }),
  });

  return NextResponse.json({ campaign: { id: campaign.id } }, { status: 201 });
}