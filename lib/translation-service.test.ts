import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { translateBatch } from "./translation-service";

const originalFetch = global.fetch;
const originalKey = process.env.AZURE_TRANSLATOR_KEY;
const originalRegion = process.env.AZURE_TRANSLATOR_REGION;

describe("translateBatch", () => {
  beforeEach(() => {
    process.env.AZURE_TRANSLATOR_KEY = "test-key";
    process.env.AZURE_TRANSLATOR_REGION = "test-region";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.AZURE_TRANSLATOR_KEY = originalKey;
    process.env.AZURE_TRANSLATOR_REGION = originalRegion;
    vi.restoreAllMocks();
  });

  it("returns ok:true immediately for an empty batch without calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;
    const result = await translateBatch([], "ar");
    expect(result).toEqual({ translations: [], detectedSourceLanguage: null, ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to the originals, ok:false, when AZURE_TRANSLATOR_KEY is not set — never throws", async () => {
    delete process.env.AZURE_TRANSLATOR_KEY;
    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(false);
    expect(result.translations).toEqual(["hello"]);
  });

  it("returns translated text and detected source language on a successful Azure response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { translations: [{ text: "مرحبا" }], detectedLanguage: { language: "en" } },
      ],
    }) as any;

    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(true);
    expect(result.translations).toEqual(["مرحبا"]);
    expect(result.detectedSourceLanguage).toBe("en");
  });

  it("falls back to originals, ok:false, on a non-2xx Azure response — never throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid subscription key",
    }) as any;

    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(false);
    expect(result.translations).toEqual(["hello"]);
  });

  it("falls back to originals, ok:false, on an unexpected response shape (mismatched length)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ translations: [{ text: "only one" }] }],
    }) as any;

    const result = await translateBatch(
      [{ text: "a", isHtml: false }, { text: "b", isHtml: false }],
      "ar"
    );
    expect(result.ok).toBe(false);
    expect(result.translations).toEqual(["a", "b"]);
  });

  it("falls back to originals, ok:false, when fetch itself rejects (network error) — never throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as any;
    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(false);
    expect(result.translations).toEqual(["hello"]);
  });

  it("never sends a hardcoded source language — Azure must auto-detect", async () => {
    let requestedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string) => {
      requestedUrl = url;
      return Promise.resolve({ ok: true, json: async () => [{ translations: [{ text: "x" }] }] });
    }) as any;

    await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(requestedUrl).not.toMatch(/[?&]from=/);
    expect(requestedUrl).toMatch(/[?&]to=ar\b/);
  });

  it("plain-text (isHtml:false) input is HTML-escaped before being sent — the exact regression this service fixed", async () => {
    let sentBody: any = null;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      sentBody = JSON.parse(init.body);
      return Promise.resolve({ ok: true, json: async () => [{ translations: [{ text: "ok" }] }] });
    }) as any;

    // Plain text a real user might type — the "<3"/"&" here previously broke
    // translation when a caller wrongly marked plain post content as isHtml.
    await translateBatch([{ text: "great work <3 by R&D team!", isHtml: false }], "ar");

    expect(sentBody[0].text).toBe("great work &lt;3 by R&amp;D team!");
    expect(sentBody[0].text).not.toContain("<3");
  });

  it("real HTML (isHtml:true) input is sent with tags intact, not escaped", async () => {
    let sentBody: any = null;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      sentBody = JSON.parse(init.body);
      return Promise.resolve({ ok: true, json: async () => [{ translations: [{ text: "ok" }] }] });
    }) as any;

    await translateBatch([{ text: "<p>Check <b>this</b> out</p>", isHtml: true }], "ar");

    expect(sentBody[0].text).toBe("<p>Check <b>this</b> out</p>");
  });

  it("protects @mentions, #hashtags, URLs, and emails from translation and unwraps them cleanly", async () => {
    let sentBody: any = null;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      sentBody = JSON.parse(init.body);
      // Echo Azure preserving notranslate spans verbatim, as the real API does.
      return Promise.resolve({ ok: true, json: async () => [{ translations: [{ text: sentBody[0].text }] }] });
    }) as any;

    const source = "great news @albizmedia #launch see https://example.com or mail me@example.com";
    const result = await translateBatch([{ text: source, isHtml: false }], "ar");

    expect(sentBody[0].text).toContain('<span class="notranslate">@albizmedia</span>');
    expect(sentBody[0].text).toContain('<span class="notranslate">#launch</span>');
    expect(sentBody[0].text).toContain('<span class="notranslate">https://example.com</span>');
    expect(sentBody[0].text).toContain('<span class="notranslate">me@example.com</span>');
    // Round-trips back to the original once unwrapped/unescaped.
    expect(result.translations[0]).toBe(source);
  });

  it("in HTML mode, tag attributes (e.g. href with an @ or # in it) are never touched by token-protection", async () => {
    let sentBody: any = null;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      sentBody = JSON.parse(init.body);
      return Promise.resolve({ ok: true, json: async () => [{ translations: [{ text: "ok" }] }] });
    }) as any;

    await translateBatch(
      [{ text: '<a href="https://example.com/#section?u=me@example.com">click @here</a>', isHtml: true }],
      "ar"
    );

    // The href attribute itself must survive untouched — only the visible
    // text node ("click @here") gets a protection span.
    expect(sentBody[0].text).toContain('href="https://example.com/#section?u=me@example.com"');
    expect(sentBody[0].text).toContain('<span class="notranslate">@here</span>');
  });
});
