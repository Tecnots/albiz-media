// Shared translation service — the single place every content type (Post,
// Article/News, Comment, Story) goes through to get text translated.
// Backed by the NIA translation pipeline (Claude Haiku via OpenAI-compatible
// chat completions API), matching the architecture used in NIA Forms.
//
// Two production concerns are handled here, once, instead of per-caller:
//   1. Source language is NEVER hardcoded — the model auto-detects it on every
//      request. Hardcoding `from: "en"` on multilingual content produces
//      garbage translations.
//   2. @mentions, #hashtags, URLs, and email addresses are protected from
//      being mangled via system prompt instructions (the model is instructed
//      to preserve them verbatim).

const NIA_BASE_URL = process.env.NIA_BASE_URL ?? "https://nia.naslabs.ai/api/v1";
const NIA_MODEL = process.env.NIA_TRANSLATE_MODEL ?? "anthropic/claude-haiku-4-5";

export interface TranslateBatchResult {
  /** Same length/order as the input `texts`. Echoes the originals back when `ok` is false. */
  translations: string[];
  detectedSourceLanguage: string | null;
  ok: boolean;
}

// ─── Language metadata ──────────────────────────────────────────────────────
// Human-readable names and script hints to pin the model to the correct
// script. Without explicit script hints, Haiku occasionally confuses South
// Indian scripts (e.g. emits Malayalam glyphs when asked for Tamil).

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic", bn: "Bengali", bg: "Bulgarian", ca: "Catalan", zh: "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)", hr: "Croatian", cs: "Czech", da: "Danish", nl: "Dutch",
  en: "English", et: "Estonian", fi: "Finnish", fr: "French", de: "German", el: "Greek",
  gu: "Gujarati", he: "Hebrew", hi: "Hindi", hu: "Hungarian", id: "Indonesian", it: "Italian",
  ja: "Japanese", kn: "Kannada", ko: "Korean", lv: "Latvian", lt: "Lithuanian", ms: "Malay",
  ml: "Malayalam", mr: "Marathi", ne: "Nepali", no: "Norwegian", fa: "Persian", pl: "Polish",
  pt: "Portuguese", pa: "Punjabi", ro: "Romanian", ru: "Russian", sr: "Serbian", si: "Sinhala",
  sk: "Slovak", sl: "Slovenian", es: "Spanish", sw: "Swahili", sv: "Swedish", ta: "Tamil",
  te: "Telugu", th: "Thai", tr: "Turkish", uk: "Ukrainian", ur: "Urdu", vi: "Vietnamese",
  ps: "Pashto", sd: "Sindhi", ckb: "Central Kurdish", dv: "Dhivehi", yi: "Yiddish",
  am: "Amharic", my: "Burmese", km: "Khmer", lo: "Lao", mn: "Mongolian", zu: "Zulu",
};

const LANG_SCRIPT_HINT: Record<string, string> = {
  hi: "Devanagari script (e.g. हिन्दी) — NOT Gujarati, Bengali, or Gurmukhi script",
  bn: "Bengali script (e.g. বাংলা) — NOT Devanagari, Assamese, or Odia script",
  ta: "Tamil script (e.g. தமிழ்) — NOT Malayalam, Kannada, or Telugu script",
  te: "Telugu script (e.g. తెలుగు) — NOT Kannada, Tamil, or Malayalam script",
  kn: "Kannada script (e.g. ಕನ್ನಡ) — NOT Telugu, Tamil, or Malayalam script",
  ml: "Malayalam script (e.g. മലയാളം) — NOT Tamil, Kannada, or Telugu script",
  gu: "Gujarati script (e.g. ગુજરાતી) — NOT Devanagari script",
  pa: "Gurmukhi script (e.g. ਪੰਜਾਬੀ) — NOT Devanagari or Shahmukhi script",
  mr: "Devanagari script (e.g. मराठी) — same script as Hindi but Marathi vocabulary",
  ne: "Devanagari script (e.g. नेपाली) — same script as Hindi but Nepali vocabulary",
  si: "Sinhala script (e.g. සිංහල)",
  ar: "Arabic script, right-to-left (e.g. العربية)",
  ur: "Nastaliq/Arabic script, right-to-left (e.g. اردو) — NOT Devanagari",
  fa: "Persian/Arabic script, right-to-left (e.g. فارسی)",
  he: "Hebrew script, right-to-left (e.g. עברית)",
  ps: "Pashto/Arabic script, right-to-left (e.g. پښتو)",
  sd: "Arabic script, right-to-left (e.g. سنڌي)",
  ckb: "Arabic script, right-to-left (e.g. کوردی)",
  yi: "Hebrew script, right-to-left (e.g. ייִדיש)",
  ja: "Japanese (mix of Kanji, Hiragana, Katakana)",
  ko: "Korean Hangul (e.g. 한국어)",
  zh: "Simplified Chinese characters (简体中文)",
  "zh-TW": "Traditional Chinese characters (繁體中文)",
  th: "Thai script (e.g. ภาษาไทย)",
  km: "Khmer script (e.g. ភាសាខ្មែរ)",
  my: "Myanmar/Burmese script (e.g. မြန်မာ)",
  lo: "Lao script (e.g. ລາວ)",
  am: "Ethiopic/Ge'ez script (e.g. አማርኛ)",
  dv: "Thaana script, right-to-left (e.g. ދިވެހި)",
};

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(targetLang: string): string {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const scriptHint = LANG_SCRIPT_HINT[targetLang];

  return [
    `You are a professional translator. Translate the provided texts into ${langName}.`,
    scriptHint ? `IMPORTANT: You MUST use ${scriptHint}.` : null,
    "",
    "Rules:",
    "1. You will receive a JSON array of objects, each with an \"id\" (integer) and \"text\" (string).",
    "2. Return a JSON array of the same length, same order, same ids, with the \"text\" fields translated.",
    "3. If a text is null, empty, or whitespace-only, keep it exactly as-is.",
    "4. Preserve ALL @mentions, #hashtags, URLs, and email addresses EXACTLY as they appear — do NOT translate, transliterate, or modify them.",
    "5. Preserve ALL HTML tags and attributes exactly. Only translate the visible text content between tags.",
    "6. Keep Arabic numerals for numbers, dates, and units.",
    "7. Use natural, conversational phrasing appropriate for social media content.",
    "8. Also return a \"detectedLanguage\" field with the ISO 639-1 code of the source language you detected.",
    "",
    "Output format (raw JSON only, no markdown fences):",
    '{ "detectedLanguage": "en", "items": [{ "id": 0, "text": "translated text" }, ...] }',
  ].filter((l) => l !== null).join("\n");
}

// ─── NIA API call ───────────────────────────────────────────────────────────

/**
 * Translates a batch of text strings into `targetLanguage` via the NIA
 * translation pipeline (Claude Haiku). Source language is auto-detected by
 * the model. On any failure (missing credentials, network error, non-2xx,
 * malformed response), falls back to echoing the original texts with
 * `ok: false` — callers treat that as "show the original content".
 */
export async function translateBatch(
  items: { text: string; isHtml: boolean }[],
  targetLanguage: string
): Promise<TranslateBatchResult> {
  if (items.length === 0) return { translations: [], detectedSourceLanguage: null, ok: true };

  const texts = items.map((i) => i.text);
  const apiKey = process.env.NIA_API_KEY;
  if (!apiKey) {
    console.error("[translation-service] NIA_API_KEY is not set — falling back to original content");
    return { translations: texts, detectedSourceLanguage: null, ok: false };
  }

  try {
    const payload = items.map((item, i) => ({ id: i, text: item.text }));

    const res = await fetch(`${NIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: NIA_MODEL,
        temperature: 0.2,
        max_tokens: 4000,
        messages: [
          { role: "system", content: buildSystemPrompt(targetLanguage) },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      console.error("[translation-service] NIA request failed:", res.status, await res.text().catch(() => ""));
      return { translations: texts, detectedSourceLanguage: null, ok: false };
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[translation-service] Model returned invalid JSON:", cleaned.slice(0, 200));
      return { translations: texts, detectedSourceLanguage: null, ok: false };
    }

    const responseItems: any[] = parsed?.items;
    if (!Array.isArray(responseItems) || responseItems.length !== items.length) {
      console.error("[translation-service] Unexpected response shape: expected", items.length, "items, got", responseItems?.length);
      return { translations: texts, detectedSourceLanguage: null, ok: false };
    }

    const translations = responseItems.map((entry: any, i: number) => {
      const translated = entry?.text;
      return typeof translated === "string" ? translated : texts[i];
    });
    const detectedSourceLanguage = typeof parsed?.detectedLanguage === "string" ? parsed.detectedLanguage : null;

    return { translations, detectedSourceLanguage, ok: true };
  } catch (err) {
    console.error("[translation-service] Translation request failed:", err);
    return { translations: texts, detectedSourceLanguage: null, ok: false };
  }
}
