import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit";

// No REDIS_URL in the test environment, so this exercises the in-memory
// sliding-window fallback — same code path used when Redis is unavailable in
// production. Validates the specific fix to the Custom Domain resolve route:
// traffic to one IP/domain must never consume another's budget.

describe("checkRateLimit — per-key isolation", () => {
  it("allows requests under the limit", async () => {
    const key = `test:${Math.random()}`;
    const result = await checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks once a single key exceeds its limit", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) await checkRateLimit(key, 3, 60_000);
    const fourth = await checkRateLimit(key, 3, 60_000);
    expect(fourth.allowed).toBe(false);
  });

  it("keeps two different keys (e.g. two different domains) completely isolated", async () => {
    const domainA = `domain-resolve:domain:a-${Math.random()}.com`;
    const domainB = `domain-resolve:domain:b-${Math.random()}.com`;

    // Exhaust domain A's budget.
    for (let i = 0; i < 5; i++) await checkRateLimit(domainA, 5, 60_000);
    const aBlocked = await checkRateLimit(domainA, 5, 60_000);
    expect(aBlocked.allowed).toBe(false);

    // Domain B must be entirely unaffected — this is the exact bug that was
    // fixed (all custom-domain traffic previously collapsed onto one shared
    // "unknown" IP bucket because middleware never forwarded the real IP).
    const bStillAllowed = await checkRateLimit(domainB, 5, 60_000);
    expect(bStillAllowed.allowed).toBe(true);
  });

  it("keeps per-IP and per-domain buckets independent even for the same request", async () => {
    const ipKey = `domain-resolve:ip:${Math.random()}`;
    const domainKey = `domain-resolve:domain:${Math.random()}.com`;

    for (let i = 0; i < 2; i++) await checkRateLimit(ipKey, 2, 60_000);
    const ipBlocked = await checkRateLimit(ipKey, 2, 60_000);
    expect(ipBlocked.allowed).toBe(false);

    // A brand-new domain key for a different visitor sharing that IP is unaffected.
    const domainAllowed = await checkRateLimit(domainKey, 600, 60_000);
    expect(domainAllowed.allowed).toBe(true);
  });
});
