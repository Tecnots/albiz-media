import { describe, it, expect } from "vitest";
import { isSafeMediaUrl, isSafeMediaReference, sanitizeMediaUrl } from "./url-validation";

// Regression coverage for audit finding M-12: videoUrl/thumbnailUrl/image
// previously accepted any string with no protocol/host validation at all.

describe("isSafeMediaUrl", () => {
  it("accepts a normal public https URL", () => {
    expect(isSafeMediaUrl("https://cdn.example.com/video.mp4")).toBe(true);
  });

  it("accepts http", () => {
    expect(isSafeMediaUrl("http://cdn.example.com/video.mp4")).toBe(true);
  });

  it("rejects non-http(s) protocols", () => {
    expect(isSafeMediaUrl("ftp://cdn.example.com/video.mp4")).toBe(false);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeMediaUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeMediaUrl("not a url")).toBe(false);
    expect(isSafeMediaUrl("")).toBe(false);
  });

  it("rejects the cloud metadata endpoint (SSRF target)", () => {
    expect(isSafeMediaUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("rejects RFC1918 private ranges", () => {
    expect(isSafeMediaUrl("http://10.0.0.5/x")).toBe(false);
    expect(isSafeMediaUrl("http://172.16.0.1/x")).toBe(false);
    expect(isSafeMediaUrl("http://172.31.255.255/x")).toBe(false);
    expect(isSafeMediaUrl("http://192.168.1.1/x")).toBe(false);
  });

  it("does not misclassify a public IP in the 172.x range that looks similar to 172.16-31", () => {
    expect(isSafeMediaUrl("http://172.32.0.1/x")).toBe(true);
    expect(isSafeMediaUrl("http://172.15.0.1/x")).toBe(true);
  });

  it("rejects an oversized URL", () => {
    expect(isSafeMediaUrl("https://example.com/" + "a".repeat(3000))).toBe(false);
  });

  it("rejects localhost/127.0.0.1 in production", () => {
    const prev = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    try {
      expect(isSafeMediaUrl("http://localhost/x")).toBe(false);
      expect(isSafeMediaUrl("http://127.0.0.1/x")).toBe(false);
    } finally {
      (process.env as any).NODE_ENV = prev;
    }
  });

  it("allows localhost outside production for local dev media", () => {
    const prev = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "test";
    try {
      expect(isSafeMediaUrl("http://localhost:3000/x")).toBe(true);
    } finally {
      (process.env as any).NODE_ENV = prev;
    }
  });
});

describe("isSafeMediaReference", () => {
  it("accepts an app-relative path", () => {
    expect(isSafeMediaReference("/uploads/foo.png")).toBe(true);
  });

  it("rejects a protocol-relative URL (a common SSRF/open-redirect bypass)", () => {
    expect(isSafeMediaReference("//evil.example.com/x")).toBe(false);
  });

  it("still rejects unsafe absolute URLs", () => {
    expect(isSafeMediaReference("http://169.254.169.254/")).toBe(false);
  });

  it("still accepts safe absolute URLs", () => {
    expect(isSafeMediaReference("https://cdn.example.com/x.png")).toBe(true);
  });
});

describe("sanitizeMediaUrl", () => {
  it("returns null for empty input", () => {
    expect(sanitizeMediaUrl(null)).toBeNull();
    expect(sanitizeMediaUrl(undefined)).toBeNull();
    expect(sanitizeMediaUrl("")).toBeNull();
  });

  it("returns the URL unchanged when safe", () => {
    expect(sanitizeMediaUrl("https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png");
  });

  it("returns null for unsafe URLs rather than throwing", () => {
    expect(sanitizeMediaUrl("http://10.0.0.1/x")).toBeNull();
  });
});
