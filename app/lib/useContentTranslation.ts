"use client";

import { useCallback, useState } from "react";

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

/**
 * Single shared hook behind every "Translate" affordance in the app — Post
 * feed cards and the Article/News detail page both use this instead of each
 * keeping their own copy of the fetch/state-machine logic. Reads the same
 * `localStorage["albiz-lang"]` preference the Settings language picker
 * writes, and preserves the existing UX contract: one Translate ⇄ "Show
 * original" toggle, no side-by-side view.
 */
export function useContentTranslation(
  contentType: "post" | "article",
  contentId: number,
  fields: TranslationFields
) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [translated, setTranslated] = useState<Record<string, string> | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);

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
      if (!res.ok) throw new Error("Translate request failed");
      const data = await res.json();
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
      setState("idle");
    }
  }, [contentType, contentId, fields, userLang, translated]);

  const toggleOriginal = useCallback(() => setShowTranslated(false), []);

  return { state, translated, showTranslated, isTranslatable, handleTranslate, toggleOriginal };
}
