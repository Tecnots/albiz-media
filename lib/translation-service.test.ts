import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { translateBatch } from "./translation-service";

const originalFetch = global.fetch;
const originalKey = process.env.NIA_API_KEY;

/** Helper: wrap translated items into the NIA chat completions response shape. */
function niaChatResponse(items: { id: number; text: string }[], detectedLanguage = "en") {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({ detectedLanguage, items }),
          },
        },
      ],
    }),
  };
}

describe("translateBatch", () => {
  beforeEach(() => {
    process.env.NIA_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NIA_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns ok:true immediately for an empty batch without calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;
    const result = await translateBatch([], "ar");
    expect(result).toEqual({ translations: [], detectedSourceLanguage: null, ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to the originals, ok:false, when NIA_API_KEY is not set — never throws", async () => {
    delete process.env.NIA_API_KEY;
    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(false);
    expect(result.translations).toEqual(["hello"]);
  });

  it("returns translated text and detected source language on a successful NIA response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      niaChatResponse([{ id: 0, text: "مرحبا" }], "en")
    ) as any;

    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(true);
    expect(result.translations).toEqual(["مرحبا"]);
    expect(result.detectedSourceLanguage).toBe("en");
  });

  it("falls back to originals, ok:false, on a non-2xx NIA response — never throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid api key",
    }) as any;

    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(false);
    expect(result.translations).toEqual(["hello"]);
  });

  it("falls back to originals, ok:false, on an unexpected response shape (mismatched length)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      niaChatResponse([{ id: 0, text: "only one" }], "en")
    ) as any;

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

  it("sends texts as JSON array with ids to the NIA chat completions endpoint", async () => {
    let sentBody: any = null;
    let sentUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string, init: any) => {
      sentUrl = url;
      sentBody = JSON.parse(init.body);
      return Promise.resolve(niaChatResponse([{ id: 0, text: "translated" }]));
    }) as any;

    await translateBatch([{ text: "hello world", isHtml: false }], "ar");

    expect(sentUrl).toContain("/chat/completions");
    expect(sentBody.model).toBeDefined();
    expect(sentBody.temperature).toBe(0.2);
    expect(sentBody.messages).toHaveLength(2);
    expect(sentBody.messages[0].role).toBe("system");
    expect(sentBody.messages[0].content).toContain("Arabic");
    const userPayload = JSON.parse(sentBody.messages[1].content);
    expect(userPayload).toEqual([{ id: 0, text: "hello world" }]);
  });

  it("handles model response wrapped in markdown code fences", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "```json\n" + JSON.stringify({ detectedLanguage: "en", items: [{ id: 0, text: "hola" }] }) + "\n```",
            },
          },
        ],
      }),
    }) as any;

    const result = await translateBatch([{ text: "hello", isHtml: false }], "es");
    expect(result.ok).toBe(true);
    expect(result.translations).toEqual(["hola"]);
  });

  it("falls back to originals, ok:false, on invalid JSON from model — never throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Sorry, I can't translate that." } }],
      }),
    }) as any;

    const result = await translateBatch([{ text: "hello", isHtml: false }], "ar");
    expect(result.ok).toBe(false);
    expect(result.translations).toEqual(["hello"]);
  });

  it("includes script hints for South Indian languages", async () => {
    let sentBody: any = null;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      sentBody = JSON.parse(init.body);
      return Promise.resolve(niaChatResponse([{ id: 0, text: "வணக்கம்" }]));
    }) as any;

    await translateBatch([{ text: "hello", isHtml: false }], "ta");
    expect(sentBody.messages[0].content).toContain("Tamil script");
    expect(sentBody.messages[0].content).toContain("NOT Malayalam");
  });

  it("translates multiple items in a single request preserving order", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      niaChatResponse([
        { id: 0, text: "bonjour" },
        { id: 1, text: "monde" },
        { id: 2, text: "comment allez-vous" },
      ], "en")
    ) as any;

    const result = await translateBatch(
      [
        { text: "hello", isHtml: false },
        { text: "world", isHtml: false },
        { text: "how are you", isHtml: false },
      ],
      "fr"
    );
    expect(result.ok).toBe(true);
    expect(result.translations).toEqual(["bonjour", "monde", "comment allez-vous"]);
  });
});
