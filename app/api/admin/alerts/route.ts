import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { scheduleCustomAlert } from "@/lib/alert-scheduler";

export const dynamic = "force-dynamic";

// GET /api/admin/alerts — full alert list with filters (ADMIN only)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const recipientId = searchParams.get("recipientId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (recipientId) where.recipientId = parseInt(recipientId);

  const { prisma } = await import("@/lib/prisma");

  const [alerts, total] = await Promise.all([
    prisma.scheduledAlert.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        url: true,
        status: true,
        channels: true,
        scheduledFor: true,
        sentAt: true,
        cancelledAt: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        entityType: true,
        entityId: true,
        jobId: true,
        createdAt: true,
        recipient: { select: { id: true, name: true, handle: true, avatar: true, role: true } },
        createdBy: { select: { id: true, name: true, handle: true } },
      },
    }),
    prisma.scheduledAlert.count({ where }),
  ]);

  // Summary stats for the dashboard
  const stats = await prisma.scheduledAlert.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  const statMap = Object.fromEntries(stats.map((s) => [s.status, s._count.id]));

  return NextResponse.json({ alerts, total, stats: statMap });
}

// POST /api/admin/alerts — admin creates a scheduled alert for any user
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    type,
  } = body as {
    recipientId?: number;
    title?: string;
    body?: string;
    url?: string;
    scheduledFor?: string;
    channels?: { inApp?: boolean; push?: boolean; email?: boolean };
    entityType?: string;
    entityId?: number;
    type?: string;
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

  // Validate type if provided
  const validTypes = ["CUSTOM", "PRE_PUBLISH_REMINDER", "REVIEW_OVERDUE", "APPROVAL_PENDING", "SUBMISSION_REMINDER", "INACTIVITY_REMINDER", "DEADLINE_REMINDER"];
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid alert type" }, { status: 400 });
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
    channels: channels ?? { inApp: true, push: true, email: true },
    entityType,
    entityId,
    createdById: user.id,
    metadata: { adminCreated: true, alertType: type ?? "CUSTOM" },
  });

  return NextResponse.json({ alertId }, { status: 201 });
}