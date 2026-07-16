import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { translateBatch } from "@/lib/translation-service";

// POST /api/translate — shared endpoint for every translatable content type
// (Post, Article/News, Comment, Story, and anything added later).
//
// Body: {
//   contentType: "post" | "article" | "comment" | "story";
//   contentId: number;
//   fields: { title?: string; description?: string; content?: string; paragraphs?: string[] };
//   htmlFields?: string[]; // flattened field names (e.g. "content", "paragraph:0") that are real HTML
//   targetLanguage: string;
// }
// Response: { translations: Record<string, string>; sourceLanguage: string | null; fallback: boolean }
//
// Each field is cached in the `Translation` table keyed by
// (contentType, contentId, field, targetLanguage) with a hash of the exact
// source text. A hash mismatch (the author edited the content) or missing row
// is treated as a cache miss — there is no separate "invalidate" step to
// remember to call from post/article edit routes.
//
// contentId is only unique WITHIN a contentType (Post, Comment, and Story
// each have their own autoincrement sequence, so ids collide across types).
// contentType is part of the cache key specifically to keep those namespaces
// separate — never widen the uniqueness check to contentId alone.

const VALID_CONTENT_TYPES = new Set(["post", "article", "comment", "story"]);
const MAX_FIELD_LENGTH = 5000; // defensive cap per field; well under Azure's per-request limits
const MAX_TOTAL_CHARS = 5000; // hard cap on total characters across all fields per request

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`translate:${authUser.id}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  try {
    const body = await req.json();
    const { contentType, contentId, fields, targetLanguage } = body ?? {};
    const htmlFields: string[] = Array.isArray(body?.htmlFields) ? body.htmlFields : [];

    if (typeof contentType !== "string" || !VALID_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }
    if (!Number.isInteger(contentId)) {
      return NextResponse.json({ error: "Invalid contentId" }, { status: 400 });
    }
    if (!targetLanguage || typeof targetLanguage !== "string") {
      return NextResponse.json({ error: "targetLanguage is required" }, { status: 400 });
    }
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ error: "fields is required" }, { status: 400 });
    }

    // Flatten the requested fields into a uniform list — `paragraphs` (an
    // array) becomes "paragraph:0", "paragraph:1", ... Fields named in
    // `htmlFields` keep their markup (real HTML, e.g. TipTap output) so
    // structure survives translation; everything else is defensively
    // stripped, since it was never supposed to contain markup.
    const entries: { field: string; text: string; isHtml: boolean }[] = [];
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (key === "paragraphs" && Array.isArray(value)) {
        value.forEach((p, i) => {
          if (typeof p === "string" && p.trim()) {
            const field = `paragraph:${i}`;
            const isHtml = htmlFields.includes(field);
            entries.push({ field, text: (isHtml ? p : stripHtml(p)).slice(0, MAX_FIELD_LENGTH), isHtml });
          }
        });
      } else if (typeof value === "string" && value.trim()) {
        const isHtml = htmlFields.includes(key);
        entries.push({ field: key, text: (isHtml ? value : stripHtml(value)).slice(0, MAX_FIELD_LENGTH), isHtml });
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({ translations: {}, sourceLanguage: null, fallback: false });
    }

    const MAX_FIELDS = 50;
    if (entries.length > MAX_FIELDS) {
      return NextResponse.json({ error: "Too many fields" }, { status: 400 });
    }

    const totalChars = entries.reduce((sum, e) => sum + e.text.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return NextResponse.json(
        { error: `Request exceeds the ${MAX_TOTAL_CHARS}-character limit (got ${totalChars})` },
        { status: 400 }
      );
    }

    const hashes = entries.map((e) => hashText(e.text));

    const cachedRows = await prisma.translation.findMany({
      where: { contentType, contentId, targetLanguage, field: { in: entries.map((e) => e.field) } },
    });
    const cacheByField = new Map(cachedRows.map((row) => [row.field, row]));

    const translations: Record<string, string> = {};
    let sourceLanguage: string | null = null;
    const misses: { field: string; text: string; hash: string; isHtml: boolean }[] = [];

    entries.forEach((e, i) => {
      const row = cacheByField.get(e.field);
      if (row && row.sourceHash === hashes[i]) {
        translations[e.field] = row.translatedText;
        sourceLanguage = sourceLanguage ?? row.sourceLanguage;
      } else {
        misses.push({ field: e.field, text: e.text, hash: hashes[i], isHtml: e.isHtml });
      }
    });

    let fallback = false;
    if (misses.length > 0) {
      const result = await translateBatch(misses.map((m) => ({ text: m.text, isHtml: m.isHtml })), targetLanguage);
      fallback = !result.ok;
      sourceLanguage = sourceLanguage ?? result.detectedSourceLanguage;

      misses.forEach((m, i) => { translations[m.field] = result.translations[i]; });

      // Only cache real translations — never persist the "fallback to
      // original" case, or a temporary Azure outage would poison the cache
      // with untranslated text that a later, working request could have
      // produced correctly.
      if (result.ok) {
        await Promise.all(
          misses.map((m, i) =>
            prisma.translation.upsert({
              where: { contentType_contentId_field_targetLanguage: { contentType, contentId, field: m.field, targetLanguage } },
              create: {
                contentType, contentId, field: m.field, targetLanguage,
                sourceHash: m.hash, sourceLanguage: result.detectedSourceLanguage, translatedText: result.translations[i],
              },
              update: {
                sourceHash: m.hash, sourceLanguage: result.detectedSourceLanguage, translatedText: result.translations[i],
              },
            })
          )
        );
      }
    }

    return NextResponse.json({ translations, sourceLanguage, fallback });
  } catch (err: any) {
    console.error("POST /api/translate error:", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
