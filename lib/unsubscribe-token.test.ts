import { describe, it, expect, beforeEach } from "vitest";
import { generateUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

describe("unsubscribe-token", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-hmac-signing";
  });

  it("round-trips a valid token back to the original userId", () => {
    const token = generateUnsubscribeToken(42);
    expect(verifyUnsubscribeToken(token)).toBe(42);
  });

  it("rejects a tampered userId with a stale signature", () => {
    const token = generateUnsubscribeToken(42);
    const [, sig] = token.split(".");
    const tampered = `43.${sig}`;
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it("rejects a garbage/malformed token", () => {
    expect(verifyUnsubscribeToken("not-a-real-token")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("abc.def")).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = generateUnsubscribeToken(7);
    process.env.NEXTAUTH_SECRET = "a-different-secret";
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });
});
