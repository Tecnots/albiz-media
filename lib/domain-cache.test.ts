import { describe, it, expect, beforeEach } from "vitest";
import { getCachedDomainResolution, setCachedDomainResolution, invalidateDomainCache } from "./domain-cache";

// No REDIS_URL is set in the test environment, so these exercise the
// in-memory fallback path — the same graceful-degradation contract used in
// production when Redis is unavailable.

describe("domain-cache (in-memory fallback)", () => {
  beforeEach(async () => {
    await invalidateDomainCache("example.com");
    await invalidateDomainCache("nope.com");
  });

  it("returns null on a cold cache (cache miss)", async () => {
    expect(await getCachedDomainResolution("example.com")).toBeNull();
  });

  it("caches and returns a positive resolution", async () => {
    await setCachedDomainResolution("example.com", "someuser");
    const cached = await getCachedDomainResolution("example.com");
    expect(cached).toEqual({ handle: "someuser" });
  });

  it("caches a negative (not-found) resolution distinctly from a miss", async () => {
    await setCachedDomainResolution("nope.com", null);
    const cached = await getCachedDomainResolution("nope.com");
    expect(cached).toEqual({ notFound: true });
  });

  it("invalidation clears a previously cached entry", async () => {
    await setCachedDomainResolution("example.com", "someuser");
    expect(await getCachedDomainResolution("example.com")).toEqual({ handle: "someuser" });
    await invalidateDomainCache("example.com");
    expect(await getCachedDomainResolution("example.com")).toBeNull();
  });

  it("keeps different domains isolated from each other", async () => {
    await setCachedDomainResolution("example.com", "userA");
    await setCachedDomainResolution("nope.com", null);
    expect(await getCachedDomainResolution("example.com")).toEqual({ handle: "userA" });
    expect(await getCachedDomainResolution("nope.com")).toEqual({ notFound: true });
  });
});
