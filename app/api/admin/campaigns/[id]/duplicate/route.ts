import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { prisma: db } = await import("@/lib/prisma");

  const source = await db.emailCampaign.findUnique({
    where: { id },
    select: {
      name: true, subject: true, bodyHtml: true,
      audienceType: true, audienceFilter: true, metadata: true,
    },
  });
  if (!source) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const copy = await db.emailCampaign.create({
    data: {
      name: `${source.name} (copy)`,
      subject: source.subject,
      bodyHtml: source.bodyHtml,
      audienceType: source.audienceType,
      audienceFilter: source.audienceFilter as Prisma.InputJsonValue ?? Prisma.DbNull,
      metadata: source.metadata as Prisma.InputJsonValue ?? Prisma.DbNull,
      createdById: user.id,
      status: "draft",
    },
    select: { id: true, name: true },
  });

  await logActivity({
    eventType: "CAMPAIGN_CREATED",
    userId: user.id,
    meta: JSON.stringify({ campaignId: copy.id, name: copy.name, duplicatedFrom: id }),
  });

  return NextResponse.json({ campaign: copy }, { status: 201 });
}
