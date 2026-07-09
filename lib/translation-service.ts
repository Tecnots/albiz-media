// Shared translation service — the single place every content type (Post,
// Article/News, and anything added later) goes through to get text
// translated. Backed by Azure AI Translator, which is the only provider
// evaluated that has zero language gaps across the app's full 130-language
// selector, including every South Asian language it supports.
//
// Two production concerns are handled here, once, instead of per-caller:
//   1. Source language is NEVER supplied — Azure auto-detects it on every
//      request. The previous implementation hardcoded `from: "en"`, which is
//      what caused non-English content to translate into garbage (a wrong
//      declared source language produces nonsense that MT providers still
//      report with high confidence).
//   2. @mentions, #hashtags, URLs, and email addresses are protected from
//      being mangled by wrapping them in Azure's native `notranslate` HTML
//      span before sending (via `textType=html`) — the engine is instructed
//      to pass that span through byte-for-byte rather than translating it,
//      which is materially more reliable than a homemade placeholder-token
//      scheme (a plain "@mention" already gets corrupted by NMT models, so a
//      made-up sentinel token is not guaranteed to survive untouched either).

const AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate";
const AZURE_API_VERSION = "3.0";

export interface TranslateBatchResult {
  /** Same length/order as the input `texts`. Echoes the originals back when `ok` is false. */
  translations: string[];
  detectedSourceLanguage: string | null;
  ok: boolean;
}

// ─── Protected-token handling ────────────────────────────────────────────────
// One alternation, matched in a single pass — order in the alternation still
// matters (URLs/emails before the generic @mention pattern, so an email's
// "@domain" portion is claimed first), but critically every character is
// only ever considered part of at most one match. Running each pattern as
// its own separate `.replace()` (the previous approach) re-scans the whole
// string per pattern, so the @mention pass would re-match and double-wrap
// the "@domain" portion an earlier pass had already wrapped, corrupting the
// markup (nested `<span class="notranslate">` inside another).
const PROTECTED_PATTERN = new RegExp(
  [
    /https?:\/\/[^\s<]+/, // URLs
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // emails
    /@[A-Za-z0-9_.]+/, // @mentions
    /#[A-Za-z0-9_]+/, // #hashtags
  ].map((r) => r.source).join("|"),
  "g"
);

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeHtml(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function wrapProtectedTokens(text: string): string {
  return text.replace(PROTECTED_PATTERN, (match) => `<span class="notranslate">${match}</span>`);
}

/**
 * Wraps every protected token in a `notranslate` span.
 *
 * Plain text (`isHtml: false`) is escaped first, since it may contain literal
 * `<`/`>`/`&` that would otherwise be misread as markup once sent with
 * `textType=html`. Real HTML (`isHtml: true`, e.g. TipTap output) is split on
 * its tags first so token-wrapping only ever touches text nodes — tag
 * segments (and their attributes, like `href`) pass through byte-for-byte,
 * preserving the source document's structure.
 */
function protectTokens(text: string, isHtml: boolean): string {
  if (!isHtml) return wrapProtectedTokens(escapeHtml(text));
  return text
    .split(/(<[^>]+>)/g)
    .map((segment) => (segment.startsWith("<") ? segment : wrapProtectedTokens(segment)))
    .join("");
}

/**
 * Strips the notranslate wrapper Azure preserved verbatim. Plain text
 * (`isHtml: false`) is then unescaped back to a raw string. Real HTML
 * (`isHtml: true`) is left as valid markup — unescaping the whole response
 * would corrupt legitimate HTML entities before it ever reaches
 * `sanitizeHtml()`/`dangerouslySetInnerHTML`.
 */
function unwrapTranslated(html: string, isHtml: boolean): string {
  const unwrapped = html.replace(/<span class="notranslate">([\s\S]*?)<\/span>/g, "$1");
  return isHtml ? unwrapped : unescapeHtml(unwrapped);
}

// ─── Azure call ───────────────────────────────────────────────────────────────

/**
 * Translates a batch of plain-text strings into `targetLanguage` in a single
 * HTTP request. Source language is always auto-detected. On any failure
 * (missing credentials, network error, non-2xx, malformed response), falls
 * back to echoing the original texts with `ok: false` — callers should treat
 * that as "show the original content", never as a thrown error.
 */
export async function translateBatch(items: { text: string; isHtml: boolean }[], targetLanguage: string): Promise<TranslateBatchResult> {
  if (items.length === 0) return { translations: [], detectedSourceLanguage: null, ok: true };

  const texts = items.map((i) => i.text);
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (!key) {
    console.error("[translation-service] AZURE_TRANSLATOR_KEY is not set — falling back to original content");
    return { translations: texts, detectedSourceLanguage: null, ok: false };
  }

  try {
    const url = `${AZURE_ENDPOINT}?api-version=${AZURE_API_VERSION}&to=${encodeURIComponent(targetLanguage)}&textType=html`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        ...(region ? { "Ocp-Apim-Subscription-Region": region } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(items.map((item) => ({ text: protectTokens(item.text, item.isHtml) }))),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error("[translation-service] Azure request failed:", res.status, await res.text().catch(() => ""));
      return { translations: texts, detectedSourceLanguage: null, ok: false };
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length !== items.length) {
      console.error("[translation-service] Unexpected Azure response shape");
      return { translations: texts, detectedSourceLanguage: null, ok: false };
    }

    const translations = data.map((entry: any, i: number) => {
      const translated = entry?.translations?.[0]?.text;
      return typeof translated === "string" ? unwrapTranslated(translated, items[i].isHtml) : texts[i];
    });
    const detectedSourceLanguage = data[0]?.detectedLanguage?.language ?? null;

    return { translations, detectedSourceLanguage, ok: true };
  } catch (err) {
    console.error("[translation-service] Translation request failed:", err);
    return { translations: texts, detectedSourceLanguage: null, ok: false };
  }
}
