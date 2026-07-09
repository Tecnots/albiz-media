import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { notifyUploaderOfShortDecision } from "@/lib/workflow-notifications";
import { randomUUID } from "crypto";

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

// "scheduled" was added so Shorts can be scheduled for future publication —
// previously publish was always immediate and manual (audit findings L-8 /
// M-13). reject now also accepts a scheduled short (an admin can reject it
// before it goes live).
const TRANSITION_MAP: Record<string, { from: string[]; to: string }> = {
  approve:  { from: ["in_review"],           to: "approved"  },
  reject:   { from: ["in_review", "approved", "published", "scheduled"], to: "rejected"  },
  publish:  { from: ["approved"],            to: "published" },
  unpublish:{ from: ["published"],           to: "approved"  },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const { id } = await params;
  const shortId = parseInt(id);
  if (isNaN(shortId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const short = await prisma.short.findUnique({
    where: { id: shortId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { action, rejectionNote } = body;

  // ── Reviewer assignment (advisory — see schema comment on Short.assignedAdminId) ──
  if (action === "claim" || action === "release") {
    const assignedAdminId = action === "claim" ? guard.user!.id : null;
    await prisma.short.update({ where: { id: shortId }, data: { assignedAdminId } });
    await prisma.shortActivity.create({
      data: { editorId: guard.user!.id, shortId, action: action === "claim" ? "CLAIMED" : "RELEASED" },
    }).catch((e) => console.error("[admin/shorts PATCH] claim activity log failed:", e));
    return NextResponse.json({ success: true, assignedAdminId });
  }

  // ── Scheduling ─────────────────────────────────────────────────────────────
  if (action === "schedule") {
    const { publishAt } = body as { publishAt?: string };
    if (!publishAt) return NextResponse.json({ error: "publishAt is required" }, { status: 400 });
    const publishDate = new Date(publishAt);
    if (isNaN(publishDate.getTime()) || publishDate <= new Date()) {
      return NextResponse.json({ error: "publishAt must be a valid future date" }, { status: 400 });
    }

    const jobId = randomUUID();
    const prevJobId = short.scheduleJobId;

    try {
      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ status: string }[]>(
          Prisma.sql`SELECT status FROM "Short" WHERE id = ${shortId} FOR UPDATE`
        );
        if (!locked.length) throw new Error("NOT_FOUND");
        if (locked[0].status !== "approved") throw new Error("NOT_APPROVED");

        await tx.job.create({
          data: {
            id: jobId,
            type: "publish-scheduled-short",
            payload: { shortId, scheduleJobId: jobId } as Prisma.InputJsonValue,
            maxAttempts: 3,
            priority: 10,
            scheduledAt: publishDate,
          },
        });

        await tx.$executeRaw`UPDATE "Short" SET status = 'scheduled', "scheduleJobId" = ${jobId} WHERE id = ${shortId}`;
      });
    } catch (err: any) {
      if (err.message === "NOT_APPROVED") {
        return NextResponse.json({ error: "Only approved shorts can be scheduled" }, { status: 409 });
      }
      console.error("[admin/shorts schedule] transaction failed:", err);
      return NextResponse.json({ error: "Failed to schedule short" }, { status: 500 });
    }

    if (prevJobId) {
      prisma.job.update({ where: { id: prevJobId }, data: { status: "dead", lastError: "Superseded by new schedule" } }).catch(() => {});
    }
    await prisma.shortActivity.create({
      data: { editorId: guard.user!.id, shortId, action: `SCHEDULE|${JSON.stringify({ publishAt: publishDate.toISOString() })}` },
    }).catch((e) => console.error("[admin/shorts schedule] activity log failed:", e));

    return NextResponse.json({ success: true, status: "scheduled", jobId, publishAt: publishDate.toISOString() });
  }

  if (action === "unschedule") {
    const updated = await prisma.$executeRaw`
      UPDATE "Short" SET status = 'approved', "scheduleJobId" = NULL WHERE id = ${shortId} AND status = 'scheduled'
    `;
    if (updated === 0) {
      return NextResponse.json({ error: "Short is no longer scheduled — it may have already been published" }, { status: 409 });
    }
    if (short.scheduleJobId) {
      prisma.job.update({ where: { id: short.scheduleJobId }, data: { status: "dead", lastError: "Cancelled by admin" } }).catch(() => {});
    }
    await prisma.shortActivity.create({
      data: { editorId: guard.user!.id, shortId, action: `STATUS_CHANGE|${JSON.stringify({ prev: "scheduled", next: "approved", action: "unschedule" })}` },
    }).catch((e) => console.error("[admin/shorts unschedule] activity log failed:", e));

    return NextResponse.json({ success: true, status: "approved" });
  }

  const transition = TRANSITION_MAP[action];
  if (!transition) {
    return NextResponse.json({ error: "Invalid action. Use: approve, reject, publish, unpublish, schedule, unschedule, claim, release" }, { status: 400 });
  }
  if (!transition.from.includes(short.status)) {
    return NextResponse.json({
      error: `Cannot ${action} a short in "${short.status}" status`,
    }, { status: 422 });
  }
  if (action === "reject" && !rejectionNote?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const data: Record<string, any> = { status: transition.to };
  if (action === "reject") {
    data.rejectionNote = rejectionNote.trim().slice(0, 1000);
  }
  if (action === "approve" || action === "unpublish") {
    data.rejectionNote = null;
  }
  if (action === "publish") {
    data.publishedAt = new Date();
    data.rejectionNote = null;
  }
  // Rejecting a scheduled short previously left scheduleJobId pointing at a
  // still-pending publish-scheduled-short Job — the idempotency guard in the
  // worker prevents it from wrongly publishing, but the Job stayed in the
  // queue forever and the Short's scheduleJobId was left stale (caught by
  // this pass's own self-review). Clear it the same way "unschedule" already
  // does.
  const wasScheduled = short.status === "scheduled";
  if (action === "reject" && wasScheduled) {
    data.scheduleJobId = null;
  }

  // Optimistic lock on status: if another request already moved this short
  // out of the status we validated `transition.from` against, this affects
  // zero rows and we surface a conflict instead of silently overwriting
  // whatever the other request wrote (audit finding H-5 — no concurrency
  // guard existed on any Shorts write).
  const result = await prisma.short.updateMany({
    where: { id: shortId, status: short.status },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: "This short's status changed since you last loaded it. Refresh and try again." },
      { status: 409 }
    );
  }
  const updated = await prisma.short.findUnique({ where: { id: shortId } });

  if (action === "reject" && wasScheduled && short.scheduleJobId) {
    prisma.job.update({
      where: { id: short.scheduleJobId },
      data: { status: "dead", lastError: "Short rejected before scheduled publish" },
    }).catch((e) => console.error("[admin/shorts reject] failed to cancel scheduled job:", e));
  }

  await prisma.shortActivity.create({
    data: {
      editorId: guard.user!.id,
      shortId,
      action: `STATUS_CHANGE|${JSON.stringify({ prev: short.status, next: transition.to, action })}`,
    },
  }).catch((e) => console.error("[admin/shorts PATCH] activity log failed:", e));

  if (short.user?.id) {
    const decision = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "publish" ? "published" : "unpublished";
    notifyUploaderOfShortDecision({
      shortId,
      actorId: guard.user!.id,
      uploaderId: short.user.id,
      uploaderEmail: short.user.email,
      uploaderName: short.user.name,
      shortTitle: short.title,
      decision,
      rejectionNote: action === "reject" ? data.rejectionNote : null,
    }).catch((e) => console.error("[admin/shorts PATCH] uploader notification failed:", e));
  }

  return NextResponse.json({ short: updated });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const { id } = await params;
  const shortId = parseInt(id);
  if (isNaN(shortId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const short = await prisma.short.findUnique({
    where: { id: shortId },
    include: {
      user: { select: { id: true, name: true, handle: true, avatar: true, email: true } },
      assignedAdmin: { select: { id: true, name: true, avatar: true } },
    },
  });
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ short });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const { id } = await params;
  const shortId = parseInt(id);
  if (isNaN(shortId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const short = await prisma.short.findUnique({ where: { id: shortId } });
  if (!short) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.short.delete({ where: { id: shortId } });
  return NextResponse.json({ success: true });
}
