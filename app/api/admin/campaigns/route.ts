import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { logActivity } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";

const VALID_AUDIENCE_TYPES = [
  "all", "authors", "editors", "circle", "uploaders",
  "verified", "premium", "admin", "active", "inactive", "role",
];

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const search = sp.get("search")?.trim();

  const { prisma } = await import("@/lib/prisma");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (search) where.name = { contains: search, mode: "insensitive" };

  const campaigns = await prisma.emailCampaign.findMany({
    where,
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
      updatedAt: true,
      metadata: true,
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({
    campaigns: campaigns.map(c => ({
      ...c,
      channels: ((c.metadata as Record<string, unknown> | null)?.channels as string[]) ?? ["email"],
      tags: ((c.metadata as Record<string, unknown> | null)?.tags as string[]) ?? [],
      priority: ((c.metadata as Record<string, unknown> | null)?.priority as number) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    name, subject, bodyHtml, audienceType, audienceFilter, scheduledAt,
    channels, previewText, messageTitle, notificationBody, plainText,
    priority, tags, internalNotes,
  } = body as Record<string, unknown>;

  if (!String(name ?? "").trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!String(subject ?? "").trim()) return NextResponse.json({ error: "subject is required" }, { status: 400 });
  if (!String(bodyHtml ?? "").trim()) return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });
  if (!audienceType || !VALID_AUDIENCE_TYPES.includes(audienceType as string)) {
    return NextResponse.json({ error: "Valid audienceType is required" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");

  const channelList = Array.isArray(channels) && channels.length > 0 ? channels : ["email"];

  const metadata: Record<string, unknown> = {
    channels: channelList,
    previewText: String(previewText ?? "").trim(),
    messageTitle: String(messageTitle ?? "").trim(),
    notificationBody: String(notificationBody ?? "").trim(),
    plainText: String(plainText ?? "").trim(),
    priority: Number(priority ?? 0),
    tags: Array.isArray(tags) ? tags : [],
    internalNotes: String(internalNotes ?? "").trim(),
  };

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: String(name).trim(),
      subject: String(subject).trim(),
      bodyHtml: String(bodyHtml).trim(),
      audienceType: audienceType as string,
      audienceFilter: audienceFilter ? (audienceFilter as Prisma.InputJsonValue) : undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt as string) : undefined,
      metadata: metadata as Prisma.InputJsonValue,
      createdById: user.id,
    },
    select: { id: true },
  });

  await logActivity({
    eventType: "CAMPAIGN_CREATED",
    userId: user.id,
    meta: JSON.stringify({ campaignId: campaign.id, name, audienceType, channels: channelList }),
  });

  return NextResponse.json({ campaign: { id: campaign.id } }, { status: 201 });
}
