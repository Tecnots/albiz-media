/**
 * Centralized Custom Domain service. Every API route, background job, and
 * admin action goes through this file — it is the single place that knows
 * how to validate, verify, provision, resolve, disable, and remove a custom
 * domain. Nothing else should touch `customDomain`/`domainStatus`/etc.
 * directly via Prisma.
 */

import { promises as dns } from "dns";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { enqueue } from "@/lib/job-queue";
import { normalizeAndValidateDomain, generateVerificationToken, verificationRecordHost } from "@/lib/domain-validation";
import { getSslProvider } from "@/lib/domain-ssl-provider";
import { getCachedDomainResolution, setCachedDomainResolution, invalidateDomainCache } from "@/lib/domain-cache";

const DNS_TIMEOUT_MS = 8000;
const MAX_SSL_POLL_ATTEMPTS = 30; // ~30 cron ticks with backoff — see lib/workers/domain-worker.ts
const RECONCILE_STALE_CLAIM_DAYS = 30;

export interface DomainInfo {
  domain: string | null;
  domainStatus: string;
  domainToken: string | null;
  showBranding: boolean;
  verificationRecordHost: string | null;
  attempts: number;
  failureReason: string | null;
  verifiedAt: Date | null;
  activatedAt: Date | null;
}

export class DomainServiceError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function toDomainInfo(u: {
  customDomain: string | null;
  domainStatus: string;
  domainToken: string | null;
  showBranding: boolean;
  domainVerificationAttempts: number;
  domainFailureReason: string | null;
  domainVerifiedAt: Date | null;
  domainActivatedAt: Date | null;
}): DomainInfo {
  return {
    domain: u.customDomain,
    domainStatus: u.domainStatus,
    domainToken: u.domainToken,
    showBranding: u.showBranding,
    verificationRecordHost: u.customDomain ? verificationRecordHost(u.customDomain) : null,
    attempts: u.domainVerificationAttempts,
    failureReason: u.domainFailureReason,
    verifiedAt: u.domainVerifiedAt,
    activatedAt: u.domainActivatedAt,
  };
}

const SELECT_FIELDS = {
  customDomain: true,
  domainStatus: true,
  domainToken: true,
  showBranding: true,
  domainVerificationAttempts: true,
  domainFailureReason: true,
  domainVerifiedAt: true,
  domainActivatedAt: true,
} as const;

export async function getDomainInfo(userId: number): Promise<DomainInfo> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SELECT_FIELDS });
  if (!user) throw new DomainServiceError("User not found", 404);
  return toDomainInfo(user);
}

export async function addDomain(userId: number, rawDomain: string, ip?: string | null): Promise<DomainInfo> {
  const result = normalizeAndValidateDomain(rawDomain);
  if (!result.ok || !result.domain) {
    throw new DomainServiceError(result.error || "Invalid domain", 422);
  }
  const domain = result.domain;
  const token = generateVerificationToken();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { customDomain: domain, NOT: { id: userId } }, select: { id: true } });
      if (existing) throw new DomainServiceError("Domain already in use", 409);

      return tx.user.update({
        where: { id: userId },
        data: {
          customDomain: domain,
          domainStatus: "PENDING",
          domainToken: token,
          domainVerificationAttempts: 0,
          domainVerifiedAt: null,
          domainActivatedAt: null,
          domainFailureReason: null,
        },
        select: SELECT_FIELDS,
      });
    });

    await writeAuditLog({ action: "DOMAIN_ADD", actorId: userId, targetId: userId, targetType: "user", meta: { domain }, ip });
    return toDomainInfo(updated);
  } catch (err: any) {
    if (err instanceof DomainServiceError) throw err;
    if (err?.code === "P2002") throw new DomainServiceError("Domain already in use", 409);
    throw err;
  }
}

export async function updateBranding(userId: number, showBranding: boolean): Promise<{ showBranding: boolean }> {
  const updated = await prisma.user.update({ where: { id: userId }, data: { showBranding }, select: { showBranding: true } });
  return updated;
}

export async function removeDomain(userId: number, ip?: string | null): Promise<DomainInfo> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { customDomain: true } });
  const domain = user?.customDomain ?? null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      customDomain: null,
      domainStatus: "PENDING",
      domainToken: null,
      domainVerificationAttempts: 0,
      domainVerifiedAt: null,
      domainActivatedAt: null,
      domainFailureReason: null,
      domainProviderId: null,
    },
    select: SELECT_FIELDS,
  });

  if (domain) {
    await invalidateDomainCache(domain);
    const provider = getSslProvider();
    if (provider) {
      await provider.detach(domain).catch((err) => console.error("[DomainService] provider detach failed:", err.message));
    }
    await writeAuditLog({ action: "DOMAIN_REMOVED", actorId: userId, targetId: userId, targetType: "user", meta: { domain }, ip });
  }

  return toDomainInfo(updated);
}

/** Real DNS TXT ownership check + kicks off SSL provisioning on success. Synchronous — DNS lookups are fast. */
export async function verifyDomain(userId: number, ip?: string | null): Promise<DomainInfo> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SELECT_FIELDS });
  if (!user) throw new DomainServiceError("User not found", 404);
  if (!user.customDomain) throw new DomainServiceError("No domain configured", 400);
  if (!user.domainToken) throw new DomainServiceError("No verification token found — remove and re-add the domain", 400);

  const domain = user.customDomain;
  const recordHost = verificationRecordHost(domain);

  await prisma.user.update({
    where: { id: userId },
    data: {
      domainStatus: "DNS_VERIFYING",
      domainVerificationAttempts: { increment: 1 },
      domainLastCheckedAt: new Date(),
    },
  });
  await writeAuditLog({ action: "DOMAIN_VERIFY_ATTEMPT", actorId: userId, targetId: userId, targetType: "user", meta: { domain }, ip });

  const dnsResult = await checkTxtRecord(recordHost, user.domainToken);
  if (!dnsResult.ok) {
    const failed = await prisma.user.update({
      where: { id: userId },
      data: { domainStatus: "FAILED", domainFailureReason: dnsResult.reason },
      select: SELECT_FIELDS,
    });
    await writeAuditLog({ action: "DOMAIN_FAILED", actorId: userId, targetId: userId, targetType: "user", meta: { domain, stage: "dns", reason: dnsResult.reason }, ip });
    return toDomainInfo(failed);
  }

  const verified = await prisma.user.update({
    where: { id: userId },
    data: { domainStatus: "DNS_VERIFIED", domainVerifiedAt: new Date(), domainFailureReason: null },
    select: SELECT_FIELDS,
  });
  await writeAuditLog({ action: "DOMAIN_DNS_VERIFIED", actorId: userId, targetId: userId, targetType: "user", meta: { domain }, ip });

  // DNS ownership is proven — kick off SSL provisioning. Certificate issuance
  // is never instant, so this only *starts* the process; a background job
  // polls it to completion (see lib/workers/domain-worker.ts).
  return startSslProvisioning(userId, ip);
}

async function startSslProvisioning(userId: number, ip?: string | null): Promise<DomainInfo> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SELECT_FIELDS });
  if (!user?.customDomain) throw new DomainServiceError("No domain configured", 400);
  const domain = user.customDomain;

  const provider = getSslProvider();
  if (!provider) {
    // Not a user error — the platform hasn't configured SSL provisioning yet.
    // DNS ownership is still recorded as verified so nothing is lost once it is.
    const noted = await prisma.user.update({
      where: { id: userId },
      data: { domainFailureReason: "SSL provisioning isn't configured on this platform yet — contact support." },
      select: SELECT_FIELDS,
    });
    return toDomainInfo(noted);
  }

  try {
    const { providerId } = await provider.attach(domain);
    const provisioning = await prisma.user.update({
      where: { id: userId },
      data: { domainStatus: "SSL_PROVISIONING", domainProviderId: providerId, domainFailureReason: null },
      select: SELECT_FIELDS,
    });
    await writeAuditLog({ action: "DOMAIN_SSL_PROVISIONING", actorId: userId, targetId: userId, targetType: "user", meta: { domain }, ip });
    await invalidateDomainCache(domain);
    await enqueue("domain-provision-ssl", { userId, attempt: 1 });
    return toDomainInfo(provisioning);
  } catch (err: any) {
    const failed = await prisma.user.update({
      where: { id: userId },
      data: { domainStatus: "FAILED", domainFailureReason: `SSL provisioning failed: ${err.message}` },
      select: SELECT_FIELDS,
    });
    await writeAuditLog({ action: "DOMAIN_FAILED", actorId: userId, targetId: userId, targetType: "user", meta: { domain, stage: "ssl", reason: err.message }, ip });
    return toDomainInfo(failed);
  }
}

/** Called by the domain-provision-ssl background job to poll certificate issuance to completion. */
export async function pollSslProvisioning(userId: number, attempt: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SELECT_FIELDS });
  if (!user?.customDomain || user.domainStatus !== "SSL_PROVISIONING") return; // state moved on (removed/disabled/retried) — nothing to do

  const domain = user.customDomain;
  const provider = getSslProvider();
  if (!provider) return; // configuration gap already recorded by startSslProvisioning

  try {
    const status = await provider.getStatus(domain);
    if (status.verified && !status.misconfigured) {
      await prisma.user.update({
        where: { id: userId },
        data: { domainStatus: "ACTIVE", domainActivatedAt: new Date(), domainFailureReason: null },
      });
      await writeAuditLog({ action: "DOMAIN_ACTIVE", actorId: null, targetId: userId, targetType: "user", meta: { domain } });
      await invalidateDomainCache(domain);
      return;
    }
  } catch (err: any) {
    console.error(`[DomainService] SSL poll error for user ${userId}:`, err.message);
  }

  if (attempt >= MAX_SSL_POLL_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { domainStatus: "FAILED", domainFailureReason: "SSL certificate could not be issued — check that your DNS record points to the address shown above, then retry." },
    });
    await writeAuditLog({ action: "DOMAIN_FAILED", actorId: null, targetId: userId, targetType: "user", meta: { domain, stage: "ssl-timeout" } });
    return;
  }

  await enqueue("domain-provision-ssl", { userId, attempt: attempt + 1 }, { scheduledAt: new Date(Date.now() + backoffMs(attempt)) });
}

function backoffMs(attempt: number): number {
  return Math.min(30_000 * attempt, 5 * 60_000); // 30s, 60s, 90s… capped at 5 min
}

async function checkTxtRecord(recordHost: string, expectedToken: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const records = await Promise.race([
      dns.resolveTxt(recordHost),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT_CUSTOM" })), DNS_TIMEOUT_MS)
      ),
    ]);
    const flat = records.flat().map((v) => v.trim());
    if (flat.includes(expectedToken)) return { ok: true };
    return { ok: false, reason: "TXT record found, but its value doesn't match your verification token — double-check you copied it exactly." };
  } catch (err: any) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") {
      return { ok: false, reason: "No TXT record found yet. DNS changes can take up to 48 hours to propagate — try again shortly." };
    }
    if (err?.code === "ETIMEOUT_CUSTOM" || err?.code === "ETIMEOUT") {
      return { ok: false, reason: "The DNS lookup timed out. This is usually temporary — please try again." };
    }
    if (err?.code === "NXDOMAIN") {
      return { ok: false, reason: "This domain doesn't appear to exist. Double-check it's spelled correctly and registered." };
    }
    return { ok: false, reason: `DNS lookup failed (${err?.code || err?.message || "unknown error"}). Please try again.` };
  }
}

export async function disableDomain(userId: number, reason: string, actorId?: number | null): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { customDomain: true, domainStatus: true } });
  if (!user?.customDomain || user.domainStatus === "DISABLED") return;

  await prisma.user.update({
    where: { id: userId },
    data: { domainStatus: "DISABLED", domainFailureReason: reason },
  });
  await invalidateDomainCache(user.customDomain);
  await writeAuditLog({ action: "DOMAIN_DISABLED", actorId: actorId ?? null, targetId: userId, targetType: "user", meta: { domain: user.customDomain, reason } });
}

/** Admin/self action to bring a DISABLED or FAILED domain back into the verification flow. */
export async function retryDomain(userId: number, actorId: number, ip?: string | null): Promise<DomainInfo> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SELECT_FIELDS });
  if (!user?.customDomain) throw new DomainServiceError("No domain configured", 400);

  await prisma.user.update({
    where: { id: userId },
    data: { domainStatus: "PENDING", domainFailureReason: null },
  });
  await writeAuditLog({ action: "DOMAIN_VERIFY_ATTEMPT", actorId, targetId: userId, targetType: "user", meta: { domain: user.customDomain, trigger: "retry" }, ip });
  return verifyDomain(userId, ip);
}

/**
 * Resolves an incoming Host header to the handle it should serve, via cache
 * first. This is the single hot path invoked on every custom-domain request.
 */
export async function resolveDomain(hostnameRaw: string): Promise<string | null> {
  const result = normalizeAndValidateDomain(hostnameRaw);
  if (!result.ok || !result.domain) return null;
  const domain = result.domain;

  const cached = await getCachedDomainResolution(domain);
  if (cached) return "notFound" in cached ? null : cached.handle;

  const user = await prisma.user.findFirst({
    where: { customDomain: domain, domainStatus: "ACTIVE", banned: false, deactivatedAt: null },
    select: { handle: true },
  });

  await setCachedDomainResolution(domain, user?.handle ?? null);
  return user?.handle ?? null;
}

/** Daily reconciliation: re-checks ACTIVE domains for drift, expires long-abandoned claims. */
export async function reconcileDomains(): Promise<{ reverified: number; drifted: number; expired: number }> {
  let reverified = 0;
  let drifted = 0;
  let expired = 0;

  const activeDomains = await prisma.user.findMany({
    where: { domainStatus: "ACTIVE", customDomain: { not: null } },
    select: { id: true, customDomain: true, domainToken: true },
  });

  for (const u of activeDomains) {
    if (!u.customDomain || !u.domainToken) continue;
    reverified++;
    const dnsResult = await checkTxtRecord(verificationRecordHost(u.customDomain), u.domainToken);
    if (!dnsResult.ok) {
      drifted++;
      await prisma.user.update({
        where: { id: u.id },
        data: { domainStatus: "FAILED", domainFailureReason: `DNS record no longer found on periodic recheck: ${dnsResult.reason}` },
      });
      await invalidateDomainCache(u.customDomain);
      await writeAuditLog({ action: "DOMAIN_FAILED", actorId: null, targetId: u.id, targetType: "user", meta: { domain: u.customDomain, stage: "reconcile-drift" } });
    } else {
      await prisma.user.update({ where: { id: u.id }, data: { domainLastCheckedAt: new Date() } });
    }
  }

  const staleCutoff = new Date(Date.now() - RECONCILE_STALE_CLAIM_DAYS * 24 * 60 * 60 * 1000);
  const staleClaims = await prisma.user.findMany({
    where: {
      customDomain: { not: null },
      domainVerifiedAt: null,
      domainStatus: { in: ["PENDING", "FAILED"] },
      createdAt: { lt: staleCutoff },
    },
    select: { id: true, customDomain: true },
  });

  for (const u of staleClaims) {
    if (!u.customDomain) continue;
    expired++;
    await prisma.user.update({
      where: { id: u.id },
      data: { customDomain: null, domainStatus: "PENDING", domainToken: null, domainFailureReason: null },
    });
    await invalidateDomainCache(u.customDomain);
    await writeAuditLog({ action: "DOMAIN_REMOVED", actorId: null, targetId: u.id, targetType: "user", meta: { domain: u.customDomain, reason: "expired_unclaimed" } });
  }

  return { reverified, drifted, expired };
}
