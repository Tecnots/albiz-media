import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { getQueueStats } from "@/lib/job-queue";

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const type   = searchParams.get("type")   ?? "";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit  = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type)   where.type   = type;

  const [stats, jobs, total, emailStats] = await Promise.all([
    getQueueStats(),
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, type: true, status: true, priority: true,
        attempts: true, maxAttempts: true, lastError: true,
        scheduledAt: true, startedAt: true, completedAt: true, createdAt: true,
      },
    }),
    prisma.job.count({ where }),
    prisma.emailLog.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    stats,
    jobs,
    total,
    page,
    pages: Math.ceil(total / limit),
    emailStats: Object.fromEntries(emailStats.map((r) => [r.status, r._count._all])),
  });
}

// Retry a dead or failed job
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { jobId } = body;
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, status: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "dead" && job.status !== "failed") {
    return NextResponse.json({ error: "Only dead or failed jobs can be retried" }, { status: 400 });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "pending", lastError: null, scheduledAt: new Date(), attempts: 0 },
  });

  return NextResponse.json({ success: true, jobId });
}

// Delete completed or dead jobs
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (!status || !["dead", "completed"].includes(status)) {
    return NextResponse.json({ error: "status must be 'dead' or 'completed'" }, { status: 400 });
  }

  const { count } = await prisma.job.deleteMany({ where: { status } });
  return NextResponse.json({ deleted: count });
}