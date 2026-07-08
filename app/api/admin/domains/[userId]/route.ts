import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";
import { blobStorageService } from "@/lib/blob-storage";
import { retryDomain, disableDomain, removeDomain, DomainServiceError } from "@/lib/domain-service";
import { extractIp } from "@/lib/audit";

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

// GET — full detail + audit history for one user's domain.
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const userId = parseInt((await params).userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, handle: true, email: true, avatar: true, banned: true, deactivatedAt: true,
      customDomain: true, domainStatus: true, domainToken: true, domainVerificationAttempts: true,
      domainFailureReason: true, domainVerifiedAt: true, domainActivatedAt: true, domainLastCheckedAt: true, showBranding: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auditHistory = await prisma.auditLog.findMany({
    where: { targetId: userId, targetType: "user", action: { startsWith: "DOMAIN_" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, actorId: true, meta: true, createdAt: true },
  });

  return NextResponse.json({
    user: { ...user, avatar: blobStorageService.resolveMediaUrl(user.avatar) },
    auditHistory,
  });
}

// PATCH — admin actions: retry | disable
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const userId = parseInt((await params).userId);
  const { action, reason } = await request.json();
  const ip = extractIp(request);

  try {
    if (action === "retry") {
      const info = await retryDomain(userId, guard.user!.id, ip);
      return NextResponse.json({ domain: info });
    }
    if (action === "disable") {
      await disableDomain(userId, reason || "Disabled by an administrator", guard.user!.id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof DomainServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[admin/domains] PATCH error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// DELETE — force-remove a domain entirely.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const userId = parseInt((await params).userId);
  const info = await removeDomain(userId, extractIp(request));
  return NextResponse.json({ domain: info });
}
