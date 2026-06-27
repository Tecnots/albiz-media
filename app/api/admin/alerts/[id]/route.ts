import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { cancelAlert } from "@/lib/alert-scheduler";
import { enqueue } from "@/lib/job-queue";
import { logActivity } from "@/lib/activity-logger";

// GET /api/admin/alerts/[id] — fetch a single alert with full detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");

  const alert = await prisma.scheduledAlert.findUnique({
    where: { id },
    include: {
      recipient: { select: { id: true, name: true, handle: true, avatar: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true, handle: true } },
    },
  });

  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  return NextResponse.json({ alert });
}

// PATCH /api/admin/alerts/[id] — admin reschedules or updates any alert
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { scheduledFor, title, alertBody, channels } = body as {
    scheduledFor?: string;
    title?: string;
    alertBody?: string;
    channels?: { inApp?: boolean; push?: boolean; email?: boolean };
  };

  const { prisma } = await import("@/lib/prisma");
  const alert = await prisma.scheduledAlert.findUnique({
    where: { id },
    select: { status: true, jobId: true },
  });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  if (alert.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot update — status is '${alert.status}'` },
      { status: 409 }
    );
  }

  const updateData: Record<string, unknown> = {};

  if (scheduledFor) {
    const newDate = new Date(scheduledFor);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
      return NextResponse.json({ error: "scheduledFor must be a valid future date" }, { status: 400 });
    }

    // Cancel old job, create new one at updated time
    if (alert.jobId) {
      prisma.job.update({
        where: { id: alert.jobId },
        data: { status: "dead", lastError: "Superseded by admin reschedule" },
      }).catch(() => {});
    }
    const newJobId = await enqueue(
      "send-scheduled-alert",
      { alertId: id },
      { scheduledAt: newDate, priority: 7 }
    );
    updateData.scheduledFor = newDate;
    updateData.jobId = newJobId;
  }

  if (title) updateData.title = title;
  if (alertBody) updateData.body = alertBody;
  if (channels) updateData.channels = channels;

  await prisma.scheduledAlert.update({ where: { id }, data: updateData });

  await logActivity({
    eventType: "ALERT_SCHEDULED",
    userId: user.id,
    meta: JSON.stringify({ alertId: id, action: "admin-update", ...updateData }),
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/alerts/[id] — admin cancels any alert
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await cancelAlert(id, user.id);

  if (!result.cancelled) {
    return NextResponse.json(
      { error: `Cannot cancel — ${result.reason}` },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}