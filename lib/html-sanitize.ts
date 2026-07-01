/**
 * Whitelist-based HTML sanitizer for Circle post content.
 *
 * Allows safe formatting tags while stripping all executable code vectors:
 * script/style blocks, event handlers, javascript: / data: URIs, and
 * any tag not on the explicit allowlist.
 *
 * To upgrade: replace this file with `sanitize-html` or `isomorphic-dompurify`.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "i", "strong", "em", "u", "s", "del",
  "ul", "ol", "li", "a", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "span", "div",
]);

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
  span: ["class"],
  div: ["class"],
  p: ["class"],
  code: ["class"],
  pre: ["class"],
};

// Only allow http/https/mailto links in href
const SAFE_HREF = /^(?:https?|mailto):/i;

/**
 * Sanitize an HTML string, removing all XSS vectors while preserving
 * safe rich-text formatting produced by editors like Tiptap.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  let result = html;

  // 1. Remove entire script/style/template blocks (including their content)
  result = result.replace(
    /<(script|style|template|noscript|iframe|object|embed|applet|form|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  // Catch self-closing variants of the above
  result = result.replace(
    /<(script|style|template|noscript|iframe|object|embed|applet|form|svg|input|button|select|textarea)\b[^>]*\/?>/gi,
    ""
  );

  // 2. Remove all event handler attributes (onclick, onload, onerror, etc.)
  result = result.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]*)/gi, "");

  // 3. Remove javascript: / vbscript: / data: in any attribute
  result = result.replace(
    /(\b(?:href|src|action|formaction|xlink:href|xml:base)\s*=\s*["']?)\s*(?:javascript|vbscript|data|blob):[^\s"'>]*/gi,
    "$1"
  );

  // 4. Remove base and meta-refresh tags (can hijack relative URLs)
  result = result.replace(/<base\b[^>]*>/gi, "");
  result = result.replace(/<meta\b[^>]*(?:http-equiv\s*=\s*["']?refresh)[^>]*>/gi, "");

  // 5. Strip tags that are not in the allowlist, preserving their inner text
  result = result.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Closing tag of a disallowed element — drop it
      if (match.startsWith("</")) return "";
      // Opening tag of a disallowed element — drop the tag, keep content
      return "";
    }
    return match;
  });

  // 6. Strip disallowed attributes from remaining tags
  result = result.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (_match, rawTag, attrStr) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";

    const allowed = ALLOWED_ATTRS[tag] ?? [];
    if (allowed.length === 0) return `<${tag}>`;

    // Parse and filter attributes
    const attrs: string[] = [];
    const attrRe = /([a-z][a-z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/gi;
    let m;
    while ((m = attrRe.exec(attrStr)) !== null) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? "";
      if (!allowed.includes(name)) continue;

      // Validate href values
      if (name === "href") {
        if (!SAFE_HREF.test(value.trim())) continue;
      }

      // Force rel="noopener noreferrer" on external links
      if (name === "target" && value === "_blank") {
        attrs.push(`target="_blank"`);
        if (!attrStr.includes("rel=")) attrs.push(`rel="noopener noreferrer"`);
        continue;
      }

      attrs.push(value ? `${name}="${value.replace(/"/g, "&quot;")}"` : name);
    }

    return attrs.length > 0 ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
  });

  return result;
}

/**
 * Strip ALL HTML tags — returns plain text only.
 * Use for notification snippets, meta descriptions, etc.
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}
