import { NextRequest, NextResponse } from "next/server";

// ── Simple LRU cache (in-process) ────────────────────────────────────────────
// Keyed by "text|from|to". Evicts oldest when exceeding MAX_ENTRIES.
const MAX_ENTRIES = 500;
const cache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  return cache.get(key);
}

function cacheSet(key: string, value: string) {
  if (cache.size >= MAX_ENTRIES) {
    // Evict the oldest entry
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, value);
}

// ── Translation via MyMemory (free, no key required for reasonable usage) ────
// Falls back to original text on any failure.
async function translateText(text: string, from: string, to: string): Promise<string> {
  const key = `${text}|${from}|${to}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AlbizMedia/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return text;

    const data: any = await res.json();
    const translated: string = data?.responseData?.translatedText;
    if (!translated || data?.responseStatus !== 200) return text;

    cacheSet(key, translated);
    return translated;
  } catch {
    return text;
  }
}

// ── Route: POST /api/translate ────────────────────────────────────────────────
// Body: { text: string; from?: string; to: string }
// Response: { translated: string; cached: boolean }
export async function POST(req: NextRequest) {
  try {
    const { text, from = "en", to } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (!to || typeof to !== "string") {
      return NextResponse.json({ error: "to language code is required" }, { status: 400 });
    }
    if (from === to) {
      return NextResponse.json({ translated: text, cached: true });
    }
    // Limit text length to 500 chars per request (MyMemory free tier)
    const trimmed = text.slice(0, 500);
    const cacheKey = `${trimmed}|${from}|${to}`;
    const wasCached = cache.has(cacheKey);

    const translated = await translateText(trimmed, from, to);
    return NextResponse.json(
      { translated, cached: wasCached },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}