import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, handle: true } },
      _count: { select: { recipients: true } },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

const VALID_AUDIENCE_TYPES = ["all", "authors", "editors", "circle", "verified", "admin", "role"];

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, subject, bodyHtml, audienceType, audienceFilter, scheduledAt } = body as {
    name?: string;
    subject?: string;
    bodyHtml?: string;
    audienceType?: string;
    audienceFilter?: Record<string, unknown> | null;
    scheduledAt?: string | null;
  };

  if (audienceType !== undefined && !VALID_AUDIENCE_TYPES.includes(audienceType)) {
    return NextResponse.json({ error: `Invalid audienceType '${audienceType}'` }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (subject !== undefined) data.subject = subject.trim();
  if (bodyHtml !== undefined) data.bodyHtml = bodyHtml.trim();
  if (audienceType !== undefined) data.audienceType = audienceType;
  if (audienceFilter !== undefined) data.audienceFilter = audienceFilter;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { prisma } = await import("@/lib/prisma");

  // Atomic: only update if campaign is still in draft status. This prevents
  // a concurrent send from transitioning the campaign to 'sending' between
  // a read and a write, which would corrupt a live campaign's fields.
  const result = await prisma.emailCampaign.updateMany({
    where: { id, status: "draft" },
    data,
  });

  if (result.count === 0) {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json(
      { error: `Cannot edit — campaign status is '${campaign.status}'` },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Only draft campaigns can be deleted" }, { status: 409 });
  }

  await prisma.emailCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}