import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { findManyMock, upsertMock, getAuthUserMock, rateLimitMock, translateBatchMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  upsertMock: vi.fn(),
  getAuthUserMock: vi.fn(),
  rateLimitMock: vi.fn(),
  translateBatchMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { translation: { findMany: findManyMock, upsert: upsertMock } },
}));
vi.mock("@/app/lib/auth", () => ({
  getAuthUser: getAuthUserMock,
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));
vi.mock("@/lib/translation-service", () => ({ translateBatch: translateBatchMock }));

import { POST } from "@/app/api/translate/route";

function req(body: unknown) {
  return new NextRequest("https://albizmedia.com/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue({ id: 1 });
    rateLimitMock.mockResolvedValue({ allowed: true });
    findManyMock.mockResolvedValue([]);
    upsertMock.mockResolvedValue({});
    translateBatchMock.mockResolvedValue({ translations: ["translated"], detectedSourceLanguage: "en", ok: true });
  });

  it("rejects unauthenticated requests", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const res = await POST(req({ contentType: "post", contentId: 1, fields: { content: "hi" }, targetLanguage: "ar" }));
    expect(res.status).toBe(401);
    expect(translateBatchMock).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, error: { error: "Too many requests" }, resetAt: Date.now() + 5000 });
    const res = await POST(req({ contentType: "post", contentId: 1, fields: { content: "hi" }, targetLanguage: "ar" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("rejects an invalid contentType", async () => {
    const res = await POST(req({ contentType: "note", contentId: 1, fields: { content: "hi" }, targetLanguage: "ar" }));
    expect(res.status).toBe(400);
  });

  it.each(["post", "article", "comment", "story"])("accepts contentType %s", async (contentType) => {
    const res = await POST(req({ contentType, contentId: 1, fields: { content: "hi" }, targetLanguage: "ar" }));
    expect(res.status).toBe(200);
  });

  it("rejects a non-integer contentId", async () => {
    const res = await POST(req({ contentType: "post", contentId: "1", fields: { content: "hi" }, targetLanguage: "ar" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing targetLanguage", async () => {
    const res = await POST(req({ contentType: "post", contentId: 1, fields: { content: "hi" } }));
    expect(res.status).toBe(400);
  });

  it("returns an empty result without calling the translation service when fields carry no translatable text", async () => {
    const res = await POST(req({ contentType: "post", contentId: 1, fields: { content: "   " }, targetLanguage: "ar" }));
    const data = await res.json();
    expect(data).toEqual({ translations: {}, sourceLanguage: null, fallback: false });
    expect(translateBatchMock).not.toHaveBeenCalled();
  });

  it("rejects more than 50 fields", async () => {
    const paragraphs = Array.from({ length: 51 }, (_, i) => `paragraph ${i}`);
    const res = await POST(req({ contentType: "article", contentId: 1, fields: { paragraphs }, targetLanguage: "ar" }));
    expect(res.status).toBe(400);
  });

  it("rejects a request exceeding the total character cap across multiple fields (each field is capped individually, so this requires >1 field)", async () => {
    const res = await POST(
      req({
        contentType: "article",
        contentId: 1,
        fields: { title: "t".repeat(3000), description: "d".repeat(3000) },
        targetLanguage: "ar",
      })
    );
    expect(res.status).toBe(400);
  });

  it("serves a cache hit without calling the translation service", async () => {
    findManyMock.mockResolvedValue([
      { field: "content", sourceHash: require("crypto").createHash("sha256").update("hello").digest("hex"), sourceLanguage: "en", translatedText: "مرحبا" },
    ]);
    const res = await POST(req({ contentType: "post", contentId: 1, fields: { content: "hello" }, targetLanguage: "ar" }));
    const data = await res.json();
    expect(data.translations.content).toBe("مرحبا");
    expect(data.fallback).toBe(false);
    expect(translateBatchMock).not.toHaveBeenCalled();
  });

  it("treats a stale cache row (source text edited since) as a miss and re-translates", async () => {
    findManyMock.mockResolvedValue([
      { field: "content", sourceHash: "stale-hash-from-old-content", sourceLanguage: "en", translatedText: "old translation" },
    ]);
    const res = await POST(req({ contentType: "post", contentId: 1, fields: { content: "new content" }, targetLanguage: "ar" }));
    const data = await res.json();
    expect(translateBatchMock).toHaveBeenCalled();
    expect(data.translations.content).toBe("translated");
  });

  it("upserts the cache keyed by (contentType, contentId, field, targetLanguage) after a successful translation", async () => {
    await POST(req({ contentType: "comment", contentId: 42, fields: { content: "hello" }, targetLanguage: "ar" }));
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contentType_contentId_field_targetLanguage: { contentType: "comment", contentId: 42, field: "content", targetLanguage: "ar" } },
      })
    );
  });

  it("never writes to the cache when the provider falls back (would poison it with untranslated text)", async () => {
    translateBatchMock.mockResolvedValue({ translations: ["hello"], detectedSourceLanguage: null, ok: false });
    const res = await POST(req({ contentType: "post", contentId: 1, fields: { content: "hello" }, targetLanguage: "ar" }));
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("flattens paragraphs into paragraph:0, paragraph:1, ... and only sends non-blank ones", async () => {
    await POST(
      req({
        contentType: "article",
        contentId: 1,
        fields: { paragraphs: ["first", "   ", "third"] },
        targetLanguage: "ar",
      })
    );
    const [items] = translateBatchMock.mock.calls[0];
    expect(items).toHaveLength(2);
  });

  it("strips markup from a field not listed in htmlFields, but preserves it for one that is", async () => {
    await POST(
      req({
        contentType: "post",
        contentId: 1,
        fields: { content: "<b>bold</b> text" },
        htmlFields: [],
        targetLanguage: "ar",
      })
    );
    let [items] = translateBatchMock.mock.calls[0];
    expect(items[0].text).toBe("bold text");
    expect(items[0].isHtml).toBe(false);

    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue({ id: 1 });
    rateLimitMock.mockResolvedValue({ allowed: true });
    findManyMock.mockResolvedValue([]);
    translateBatchMock.mockResolvedValue({ translations: ["translated"], detectedSourceLanguage: "en", ok: true });

    await POST(
      req({
        contentType: "post",
        contentId: 1,
        fields: { content: "<b>bold</b> text" },
        htmlFields: ["content"],
        targetLanguage: "ar",
      })
    );
    [items] = translateBatchMock.mock.calls[0];
    expect(items[0].text).toBe("<b>bold</b> text");
    expect(items[0].isHtml).toBe(true);
  });

  it("keeps Post and Comment translation caches isolated even when their ids collide (each type has its own id sequence)", async () => {
    await POST(req({ contentType: "post", contentId: 7, fields: { content: "hello" }, targetLanguage: "ar" }));
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contentType: "post", contentId: 7 }) })
    );

    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue({ id: 1 });
    rateLimitMock.mockResolvedValue({ allowed: true });
    findManyMock.mockResolvedValue([]);
    translateBatchMock.mockResolvedValue({ translations: ["translated"], detectedSourceLanguage: "en", ok: true });

    await POST(req({ contentType: "comment", contentId: 7, fields: { content: "hello" }, targetLanguage: "ar" }));
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contentType: "comment", contentId: 7 }) })
    );
  });
});
