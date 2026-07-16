import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const userDelegate = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  };
  return {
    prisma: {
      user: userDelegate,
      $transaction: vi.fn(async (fn: any) => fn({ user: userDelegate })),
    },
  };
});

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
  extractIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/job-queue", () => ({
  enqueue: vi.fn(async () => "job-id"),
}));

vi.mock("@/lib/domain-cache", () => ({
  getCachedDomainResolution: vi.fn(async () => null),
  setCachedDomainResolution: vi.fn(async () => {}),
  invalidateDomainCache: vi.fn(async () => {}),
}));

vi.mock("@/lib/domain-ssl-provider", () => ({
  getSslProvider: vi.fn(() => null),
}));

vi.mock("dns", () => ({
  promises: {
    resolveTxt: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { enqueue } from "@/lib/job-queue";
import { getCachedDomainResolution, setCachedDomainResolution, invalidateDomainCache } from "@/lib/domain-cache";
import { getSslProvider } from "@/lib/domain-ssl-provider";
import { promises as dns } from "dns";
import {
  addDomain,
  verifyDomain,
  pollSslProvisioning,
  resolveDomain,
  disableDomain,
  retryDomain,
  reconcileDomains,
  DomainServiceError,
} from "./domain-service";

const userFindUnique = prisma.user.findUnique as any;
const userFindFirst = prisma.user.findFirst as any;
const userUpdate = prisma.user.update as any;
const userUpdateMany = prisma.user.updateMany as any;
const userFindMany = prisma.user.findMany as any;
const resolveTxt = dns.resolveTxt as any;
const mockedGetSslProvider = getSslProvider as any;

const baseUser = {
  customDomain: "example.com",
  domainStatus: "PENDING",
  domainToken: "albiz-domain-verify-abc123",
  showBranding: true,
  domainVerificationAttempts: 0,
  domainFailureReason: null,
  domainVerifiedAt: null,
  domainActivatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetSslProvider.mockReturnValue(null);
  // Default: echo back baseUser merged with whatever `data` this call wrote,
  // so assertions on the *returned* DomainInfo reflect the actual update —
  // just like a real UPDATE ... RETURNING would. Individual tests can still
  // override with mockResolvedValueOnce for a specific call.
  userUpdate.mockImplementation(async (args: any) => ({ ...baseUser, ...args?.data }));
});

describe("addDomain", () => {
  it("rejects an invalid domain before touching the database", async () => {
    await expect(addDomain(1, "not a domain")).rejects.toThrow(DomainServiceError);
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a domain already claimed by another user (409)", async () => {
    userFindFirst.mockResolvedValueOnce({ id: 2 });
    await expect(addDomain(1, "example.com")).rejects.toMatchObject({ status: 409 });
  });

  it("normalizes, stores, and audit-logs a successful claim", async () => {
    userFindFirst.mockResolvedValueOnce(null);
    userUpdate.mockResolvedValueOnce({ ...baseUser });
    const info = await addDomain(1, "WWW.Example.com", "1.2.3.4");
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customDomain: "example.com", domainStatus: "PENDING" }),
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "DOMAIN_ADD" }));
    expect(info.domain).toBe("example.com");
  });

  it("surfaces a unique-constraint race as a clean 409, not a raw DB error", async () => {
    userFindFirst.mockResolvedValueOnce(null);
    userUpdate.mockRejectedValueOnce({ code: "P2002" });
    await expect(addDomain(1, "example.com")).rejects.toMatchObject({ status: 409 });
  });
});

describe("verifyDomain — DNS ownership check", () => {
  it("fails with a 'no domain configured' error when nothing is set", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser, customDomain: null });
    await expect(verifyDomain(1)).rejects.toMatchObject({ status: 400 });
  });

  it("marks FAILED with a propagation-friendly message on ENOTFOUND", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser });
    resolveTxt.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));

    const info = await verifyDomain(1);
    expect(info.domainStatus).toBe("FAILED");
    expect(info.failureReason).toMatch(/propagat/i);
  });

  it("marks FAILED with an NXDOMAIN-specific message", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser });
    resolveTxt.mockRejectedValueOnce(Object.assign(new Error("nx"), { code: "NXDOMAIN" }));

    const info = await verifyDomain(1);
    expect(info.domainStatus).toBe("FAILED");
    expect(info.failureReason).toMatch(/doesn't appear to exist/i);
  });

  it("marks FAILED with a timeout-specific message when the DNS lookup times out", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser });
    // Exercises the same catch branch a real timeout would hit, without
    // waiting out the actual 8s timer in the test suite.
    resolveTxt.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ETIMEOUT" }));

    const info = await verifyDomain(1);
    expect(info.domainStatus).toBe("FAILED");
    expect(info.failureReason).toMatch(/timed out/i);
  });

  it("marks FAILED when the TXT record exists but doesn't match the token", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser });
    resolveTxt.mockResolvedValueOnce([["some-other-value"]]);

    const info = await verifyDomain(1);
    expect(info.domainStatus).toBe("FAILED");
    expect(info.failureReason).toMatch(/doesn't match/i);
  });

  it("progresses to DNS_VERIFIED then notes SSL isn't configured when no provider is set", async () => {
    userFindUnique
      .mockResolvedValueOnce({ ...baseUser }) // initial load in verifyDomain
      .mockResolvedValueOnce({ ...baseUser, customDomain: "example.com" }); // load inside startSslProvisioning
    userUpdate.mockResolvedValue({ ...baseUser, domainStatus: "DNS_VERIFIED" });
    resolveTxt.mockResolvedValueOnce([[baseUser.domainToken]]);
    mockedGetSslProvider.mockReturnValue(null);

    await verifyDomain(1);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "DOMAIN_DNS_VERIFIED" }));
    // No provider configured — must not silently claim success.
    expect(enqueue).not.toHaveBeenCalledWith("domain-provision-ssl", expect.anything());
  });

  it("attaches to the SSL provider and enqueues polling once DNS is verified", async () => {
    userFindUnique
      .mockResolvedValueOnce({ ...baseUser })
      .mockResolvedValueOnce({ ...baseUser, customDomain: "example.com" });
    userUpdate.mockResolvedValue({ ...baseUser, domainStatus: "SSL_PROVISIONING" });
    resolveTxt.mockResolvedValueOnce([[baseUser.domainToken]]);
    const attach = vi.fn(async () => ({ providerId: "example.com" }));
    mockedGetSslProvider.mockReturnValue({ attach, getStatus: vi.fn(), detach: vi.fn() });

    await verifyDomain(1);
    expect(attach).toHaveBeenCalledWith("example.com");
    expect(enqueue).toHaveBeenCalledWith("domain-provision-ssl", { userId: 1, attempt: 1 });
    expect(invalidateDomainCache).toHaveBeenCalledWith("example.com");
  });
});

describe("pollSslProvisioning", () => {
  it("activates the domain once the provider reports verified + configured", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser, domainStatus: "SSL_PROVISIONING" });
    const getStatus = vi.fn(async () => ({ verified: true, misconfigured: false, providerId: "example.com" }));
    mockedGetSslProvider.mockReturnValue({ attach: vi.fn(), getStatus, detach: vi.fn() });

    await pollSslProvisioning(1, 1);
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ domainStatus: "ACTIVE" }) }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "DOMAIN_ACTIVE" }));
  });

  it("re-enqueues with backoff while still misconfigured and under the attempt cap", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser, domainStatus: "SSL_PROVISIONING" });
    const getStatus = vi.fn(async () => ({ verified: false, misconfigured: true, providerId: "example.com" }));
    mockedGetSslProvider.mockReturnValue({ attach: vi.fn(), getStatus, detach: vi.fn() });

    await pollSslProvisioning(1, 2);
    expect(enqueue).toHaveBeenCalledWith("domain-provision-ssl", { userId: 1, attempt: 3 }, expect.objectContaining({ scheduledAt: expect.any(Date) }));
  });

  it("gives up and marks FAILED once the attempt cap is exceeded", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser, domainStatus: "SSL_PROVISIONING" });
    const getStatus = vi.fn(async () => ({ verified: false, misconfigured: true, providerId: "example.com" }));
    mockedGetSslProvider.mockReturnValue({ attach: vi.fn(), getStatus, detach: vi.fn() });

    await pollSslProvisioning(1, 30);
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ domainStatus: "FAILED" }) }));
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does nothing if the domain moved on (e.g. removed) since the job was queued", async () => {
    userFindUnique.mockResolvedValueOnce({ ...baseUser, domainStatus: "ACTIVE" });
    await pollSslProvisioning(1, 1);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});

describe("resolveDomain — the hot path", () => {
  it("returns a cached positive hit without touching the database", async () => {
    (getCachedDomainResolution as any).mockResolvedValueOnce({ handle: "cacheduser" });
    const handle = await resolveDomain("example.com");
    expect(handle).toBe("cacheduser");
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("returns null on a cached negative result without touching the database", async () => {
    (getCachedDomainResolution as any).mockResolvedValueOnce({ notFound: true });
    const handle = await resolveDomain("example.com");
    expect(handle).toBeNull();
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("falls back to the database on a cache miss, then populates the cache", async () => {
    (getCachedDomainResolution as any).mockResolvedValueOnce(null);
    userFindFirst.mockResolvedValueOnce({ handle: "dbuser" });
    const handle = await resolveDomain("example.com");
    expect(handle).toBe("dbuser");
    expect(setCachedDomainResolution).toHaveBeenCalledWith("example.com", "dbuser");
  });

  it("excludes banned and deactivated users from resolution at the query level", async () => {
    (getCachedDomainResolution as any).mockResolvedValueOnce(null);
    userFindFirst.mockResolvedValueOnce(null);
    await resolveDomain("example.com");
    expect(userFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ domainStatus: "ACTIVE", banned: false, deactivatedAt: null }),
    }));
  });

  it("normalizes www off the incoming hostname before looking it up", async () => {
    (getCachedDomainResolution as any).mockResolvedValueOnce(null);
    userFindFirst.mockResolvedValueOnce(null);
    await resolveDomain("www.example.com");
    expect(getCachedDomainResolution).toHaveBeenCalledWith("example.com");
  });

  it("treats an unparseable hostname as not-found rather than throwing", async () => {
    const handle = await resolveDomain("not a domain");
    expect(handle).toBeNull();
  });
});

describe("disableDomain (ban/deactivate/admin)", () => {
  it("is a no-op when the user has no domain", async () => {
    userFindUnique.mockResolvedValueOnce({ customDomain: null, domainStatus: "PENDING" });
    await disableDomain(1, "banned");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("sets DISABLED, invalidates the cache, and audit-logs with the reason", async () => {
    userFindUnique.mockResolvedValueOnce({ customDomain: "example.com", domainStatus: "ACTIVE" });
    await disableDomain(5, "Account was banned", 99);
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ domainStatus: "DISABLED", domainFailureReason: "Account was banned" }),
    }));
    expect(invalidateDomainCache).toHaveBeenCalledWith("example.com");
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "DOMAIN_DISABLED", actorId: 99 }));
  });
});

describe("retryDomain", () => {
  it("resets a FAILED/DISABLED domain back to PENDING and re-runs verification", async () => {
    userFindUnique
      .mockResolvedValueOnce({ ...baseUser, domainStatus: "DISABLED" }) // retryDomain's own lookup
      .mockResolvedValueOnce({ ...baseUser, domainStatus: "PENDING" }) // verifyDomain's lookup
      .mockResolvedValueOnce({ ...baseUser, domainStatus: "DNS_VERIFIED" }); // startSslProvisioning's lookup
    resolveTxt.mockResolvedValueOnce([[baseUser.domainToken]]);

    await retryDomain(1, 42, "1.2.3.4");
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ domainStatus: "PENDING" }) }));
  });
});

describe("reconcileDomains", () => {
  it("flags drift when an ACTIVE domain's TXT record disappears on recheck", async () => {
    userFindMany
      .mockResolvedValueOnce([{ id: 1, customDomain: "example.com", domainToken: "tok" }]) // active domains
      .mockResolvedValueOnce([]); // stale claims
    resolveTxt.mockRejectedValueOnce(Object.assign(new Error("gone"), { code: "ENOTFOUND" }));

    const result = await reconcileDomains();
    expect(result.drifted).toBe(1);
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ domainStatus: "FAILED" }) }));
  });

  it("expires long-abandoned unverified claims and frees the domain string", async () => {
    userFindMany
      .mockResolvedValueOnce([]) // active domains
      .mockResolvedValueOnce([{ id: 2, customDomain: "abandoned.com" }]); // stale claims

    const result = await reconcileDomains();
    expect(result.expired).toBe(1);
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customDomain: null }) }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "DOMAIN_REMOVED", meta: expect.objectContaining({ reason: "expired_unclaimed" }) }));
  });
});
