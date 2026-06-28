import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { cancelAlert } from "@/lib/alert-scheduler";
import { enqueue } from "@/lib/job-queue";
import { logActivity } from "@/lib/activity-logger";

// DELETE /api/alerts/[id] — cancel a pending alert
// Only the creator or an ADMIN can cancel
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");

  const alert = await prisma.scheduledAlert.findUnique({
    where: { id },
    select: { createdById: true, status: true },
  });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  // Only creator or admin can cancel
  if (user.role !== "ADMIN" && alert.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await cancelAlert(id, user.id);
  if (!result.cancelled) {
    return NextResponse.json(
      { error: `Cannot cancel — ${result.reason}` },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/alerts/[id] — reschedule a pending alert to a new time
// Only the creator or an ADMIN can reschedule
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { scheduledFor } = body as { scheduledFor?: string };

  if (!scheduledFor) {
    return NextResponse.json({ error: "scheduledFor is required" }, { status: 400 });
  }

  const newDate = new Date(scheduledFor);
  if (isNaN(newDate.getTime()) || newDate <= new Date()) {
    return NextResponse.json(
      { error: "scheduledFor must be a valid future date" },
      { status: 400 }
    );
  }

  const { prisma } = await import("@/lib/prisma");

  // Read alert for auth check and to capture the old jobId we'll need to kill.
  const alert = await prisma.scheduledAlert.findUnique({
    where: { id },
    select: { status: true, jobId: true, createdById: true },
  });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  if (user.role !== "ADMIN" && alert.createdById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create the replacement job before the atomic update so we have its ID ready.
  // If the atomic update fails (alert already cancelled/sent), we immediately kill
  // this new job to prevent a dangling entry in the queue.
  const newJobId = await enqueue(
    "send-scheduled-alert",
    { alertId: id },
    { scheduledAt: newDate, priority: 7 }
  );

  // Fix: atomic conditional update — only succeeds if the alert is still pending.
  // A concurrent cancelAlert() or worker delivery that completed between the
  // findUnique above and now will flip status away from 'pending', causing this
  // updateMany to match 0 rows. We detect that and return 409 rather than silently
  // patching a cancelled/sent alert.
  const updated = await prisma.scheduledAlert.updateMany({
    where: { id, status: "pending" },
    data: { scheduledFor: newDate, jobId: newJobId },
  });

  if (updated.count === 0) {
    // The alert was concurrently cancelled or delivered — kill the job we just
    // created so it never fires against a non-pending alert.
    prisma.job.update({
      where: { id: newJobId },
      data: { status: "dead", lastError: "Alert no longer pending at reschedule time" },
    }).catch(() => {});

    // Re-read the actual current status to surface a useful error message.
    const current = await prisma.scheduledAlert.findUnique({
      where: { id },
      select: { status: true },
    });
    return NextResponse.json(
      { error: `Cannot reschedule — alert status is '${current?.status ?? "unknown"}'` },
      { status: 409 }
    );
  }

  // Atomic update succeeded — kill the old job. Fire-and-forget: even if this
  // fails, the worker's idempotency guard (status check on the alert) will
  // prevent double delivery if the old job somehow still executes.
  if (alert.jobId) {
    prisma.job.update({
      where: { id: alert.jobId },
      data: { status: "dead", lastError: "Superseded by reschedule" },
    }).catch(() => {});
  }

  await logActivity({
    eventType: "ALERT_SCHEDULED",
    userId: user.id,
    meta: JSON.stringify({ alertId: id, rescheduled: true, scheduledFor: newDate.toISOString() }),
  });

  return NextResponse.json({ success: true, scheduledFor: newDate.toISOString() });
}