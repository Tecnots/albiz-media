import { describe, it, expect } from "vitest";
import { normalizeAndValidateDomain, generateVerificationToken, verificationRecordHost } from "./domain-validation";

describe("normalizeAndValidateDomain", () => {
  it("rejects empty/missing input", () => {
    expect(normalizeAndValidateDomain("").ok).toBe(false);
    expect(normalizeAndValidateDomain("   ").ok).toBe(false);
    expect(normalizeAndValidateDomain(undefined).ok).toBe(false);
    expect(normalizeAndValidateDomain(null).ok).toBe(false);
    expect(normalizeAndValidateDomain(123 as any).ok).toBe(false);
  });

  it("normalizes case and whitespace", () => {
    const r = normalizeAndValidateDomain("  ExAmple.CoM  ");
    expect(r.ok).toBe(true);
    expect(r.domain).toBe("example.com");
  });

  it("strips http/https protocols", () => {
    expect(normalizeAndValidateDomain("http://example.com").domain).toBe("example.com");
    expect(normalizeAndValidateDomain("https://example.com").domain).toBe("example.com");
  });

  it("strips path, query string, fragment, and port", () => {
    expect(normalizeAndValidateDomain("example.com/some/path").domain).toBe("example.com");
    expect(normalizeAndValidateDomain("example.com?query=1").domain).toBe("example.com");
    expect(normalizeAndValidateDomain("example.com#frag").domain).toBe("example.com");
    expect(normalizeAndValidateDomain("example.com:8080").domain).toBe("example.com");
    expect(normalizeAndValidateDomain("https://example.com:8080/path?q=1#f").domain).toBe("example.com");
  });

  it("strips a leading www. so www and bare form can never be claimed as two different rows", () => {
    expect(normalizeAndValidateDomain("www.example.com").domain).toBe("example.com");
    expect(normalizeAndValidateDomain("example.com").domain).toBe("example.com");
    expect(normalizeAndValidateDomain("WWW.Example.com").domain).toBe("example.com");
  });

  it("rejects wildcard domains", () => {
    expect(normalizeAndValidateDomain("*.example.com").ok).toBe(false);
    expect(normalizeAndValidateDomain("sub.*.example.com").ok).toBe(false);
  });

  it("rejects IP addresses (v4 and v6)", () => {
    expect(normalizeAndValidateDomain("192.168.1.1").ok).toBe(false);
    expect(normalizeAndValidateDomain("8.8.8.8").ok).toBe(false);
    expect(normalizeAndValidateDomain("::1").ok).toBe(false);
    expect(normalizeAndValidateDomain("2001:db8::1").ok).toBe(false);
  });

  it("rejects localhost and its subdomains", () => {
    expect(normalizeAndValidateDomain("localhost").ok).toBe(false);
    expect(normalizeAndValidateDomain("app.localhost").ok).toBe(false);
  });

  it("rejects overly long domains", () => {
    const long = "a".repeat(250) + ".com";
    expect(normalizeAndValidateDomain(long).ok).toBe(false);
  });

  it("rejects single-label hosts (no TLD)", () => {
    expect(normalizeAndValidateDomain("example").ok).toBe(false);
    expect(normalizeAndValidateDomain("localhost123").ok).toBe(false);
  });

  it("rejects invalid label characters and malformed hyphenation", () => {
    expect(normalizeAndValidateDomain("exa mple.com").ok).toBe(false);
    expect(normalizeAndValidateDomain("-example.com").ok).toBe(false);
    expect(normalizeAndValidateDomain("example-.com").ok).toBe(false);
    expect(normalizeAndValidateDomain("exa_mple.com").ok).toBe(false);
  });

  it("rejects an implausible top-level domain", () => {
    expect(normalizeAndValidateDomain("example.123").ok).toBe(false);
    expect(normalizeAndValidateDomain("example.c").ok).toBe(false);
  });

  it("accepts valid multi-label subdomains", () => {
    const r = normalizeAndValidateDomain("blog.my-site.example.co.uk");
    expect(r.ok).toBe(true);
    expect(r.domain).toBe("blog.my-site.example.co.uk");
  });

  it("punycode-normalizes IDN/homograph domains", () => {
    // Cyrillic 'а' (U+0430) instead of Latin 'a' — should normalize to an ASCII xn-- form,
    // never silently pass through looking identical to the real "apple.com".
    const r = normalizeAndValidateDomain("аpple.com");
    expect(r.ok).toBe(true);
    expect(r.domain).not.toBe("apple.com");
    expect(r.domain?.startsWith("xn--")).toBe(true);
  });

  it("rejects the platform's own domain(s)", () => {
    expect(normalizeAndValidateDomain("albizmedia.com").ok).toBe(false);
    expect(normalizeAndValidateDomain("www.albizmedia.com").ok).toBe(false);
  });

  it("rejects duplicate/repeated dots", () => {
    expect(normalizeAndValidateDomain("example..com").ok).toBe(false);
  });
});

describe("generateVerificationToken", () => {
  it("generates a unique, prefixed, sufficiently random token each call", () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
    expect(a.startsWith("albiz-domain-verify-")).toBe(true);
    expect(a.length).toBeGreaterThan(30);
  });
});

describe("verificationRecordHost", () => {
  it("builds the expected TXT record host", () => {
    expect(verificationRecordHost("example.com")).toBe("_albiz-verify.example.com");
  });
});
