"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MaybeHtml = string | { html: string };

export interface TranslationFields {
  title?: string;
  description?: string;
  content?: MaybeHtml;
  paragraphs?: MaybeHtml[];
}

function fieldText(value: MaybeHtml): string {
  return typeof value === "string" ? value : value.html;
}

function fieldIsHtml(value: MaybeHtml): boolean {
  return typeof value !== "string";
}

// Macrolanguages and major regional variants that read right-to-left, drawn
// from the /api/locale language list. Checked against the base subtag only
// (e.g. "ar-EG" -> "ar") so region-qualified codes still match.
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ckb", "dv", "yi"]);

export function isRtlLanguage(languageCode: string): boolean {
  return RTL_LANGUAGES.has(languageCode.split("-")[0].toLowerCase());
}

/**
 * Single shared hook behind every "Translate" affordance in the app — Post
 * feed cards, the Article/News detail page, and every other surface that
 * renders Post/Article/Comment/Story content all use this instead of each
 * keeping their own copy of the fetch/state-machine logic. Reads the same
 * `localStorage["albiz-lang"]` preference the Settings language picker
 * writes, and preserves the existing UX contract: one Translate ⇄ "Show
 * original" toggle, no side-by-side view.
 */
export function useContentTranslation(
  contentType: "post" | "article" | "comment" | "story",
  contentId: number,
  fields: TranslationFields
) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [translated, setTranslated] = useState<Record<string, string> | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);

  // Components like the Story viewer keep a single hook instance alive
  // across different content (swapping `story` internally instead of
  // remounting per story), so state must reset when what we're translating
  // changes — otherwise the next story briefly shows the previous one's
  // cached translation.
  const requestKey = `${contentType}:${contentId}`;
  const currentKeyRef = useRef(requestKey);
  useEffect(() => {
    currentKeyRef.current = requestKey;
    setState("idle");
    setTranslated(null);
    setShowTranslated(false);
  }, [requestKey]);

  const userLang = typeof window !== "undefined" ? localStorage.getItem("albiz-lang") ?? "en" : "en";
  const hasContent =
    !!fields.title?.trim() ||
    !!fields.description?.trim() ||
    !!(fields.content && fieldText(fields.content).trim()) ||
    !!fields.paragraphs?.some((p) => fieldText(p).trim());
  const isTranslatable = hasContent && userLang !== "en";

  const handleTranslate = useCallback(async () => {
    if (translated) {
      setShowTranslated(true);
      return;
    }
    // Captured up front so a response that lands after the user has already
    // navigated to different content (e.g. the next Story) can be detected
    // and dropped instead of painting stale translations over new content.
    const thisRequestKey = requestKey;
    setState("loading");
    try {
      const htmlFields: string[] = [];
      if (fields.content && fieldIsHtml(fields.content)) htmlFields.push("content");
      fields.paragraphs?.forEach((p, i) => { if (fieldIsHtml(p)) htmlFields.push(`paragraph:${i}`); });

      const wireFields = {
        title: fields.title,
        description: fields.description,
        content: fields.content !== undefined ? fieldText(fields.content) : undefined,
        paragraphs: fields.paragraphs?.map(fieldText),
      };

      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId, fields: wireFields, htmlFields, targetLanguage: userLang }),
      });
      if (thisRequestKey !== currentKeyRef.current) return; // stale — content moved on while this was in flight
      if (!res.ok) throw new Error("Translate request failed");
      const data = await res.json();
      if (thisRequestKey !== currentKeyRef.current) return;
      if (data.fallback) {
        // Provider unavailable — quietly stay on the original content
        // rather than surfacing an error; the button just resets so the
        // user can try again later.
        setState("idle");
        return;
      }
      setTranslated(data.translations ?? {});
      setShowTranslated(true);
      setState("done");
    } catch {
      if (thisRequestKey === currentKeyRef.current) setState("idle");
    }
  }, [contentType, contentId, requestKey, fields, userLang, translated]);

  const toggleOriginal = useCallback(() => setShowTranslated(false), []);

  // Only meaningful once translated content is actually being shown — the
  // original-language content should never be forced into RTL layout.
  const isRtl = showTranslated && isRtlLanguage(userLang);

  return { state, translated, showTranslated, isTranslatable, handleTranslate, toggleOriginal, isRtl };
}
