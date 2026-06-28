import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { scheduleCustomAlert } from "@/lib/alert-scheduler";

export const dynamic = "force-dynamic";

// GET /api/alerts — list alerts visible to the current user
// Editors/Admins see alerts they created; Authors/Normal see alerts targeting them
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const cursor = searchParams.get("cursor");

  const isEditor = user.role === "EDITOR" || user.role === "ADMIN";

  // Build the where clause: editors see what they created, users see what targets them
  const where: Record<string, unknown> = isEditor
    ? { createdById: user.id }
    : { recipientId: user.id };

  if (status) where.status = status;
  if (cursor) where.id = { lt: cursor };

  const { prisma } = await import("@/lib/prisma");
  const alerts = await prisma.scheduledAlert.findMany({
    where,
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      url: true,
      status: true,
      scheduledFor: true,
      sentAt: true,
      cancelledAt: true,
      channels: true,
      attempts: true,
      lastError: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      recipient: { select: { id: true, name: true, handle: true, avatar: true } },
    },
  });

  return NextResponse.json({ alerts });
}

// POST /api/alerts — schedule a custom alert (EDITOR or ADMIN only)
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "EDITOR" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    recipientId,
    title,
    body: alertBody,
    url,
    scheduledFor,
    channels,
    entityType,
    entityId,
  } = body as {
    recipientId?: number;
    title?: string;
    body?: string;
    url?: string;
    scheduledFor?: string;
    channels?: { inApp?: boolean; push?: boolean; email?: boolean };
    entityType?: string;
    entityId?: number;
  };

  if (!recipientId || !title || !alertBody || !scheduledFor) {
    return NextResponse.json(
      { error: "recipientId, title, body, and scheduledFor are required" },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduledFor);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return NextResponse.json(
      { error: "scheduledFor must be a valid future date" },
      { status: 400 }
    );
  }

  const { prisma } = await import("@/lib/prisma");
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  const alertId = await scheduleCustomAlert({
    recipientId,
    title,
    body: alertBody,
    url,
    scheduledFor: scheduledDate,
    channels: channels ?? { inApp: true, push: true, email: false },
    entityType,
    entityId,
    createdById: user.id,
  });

  return NextResponse.json({ alertId }, { status: 201 });
}