/**
 * Validates a user-supplied media URL (video/thumbnail/image) before it's
 * stored and later fetched/rendered by the app or a downstream worker (e.g.
 * thumbnail generation). Previously these fields passed through with only
 * `.trim()` — no protocol check, no private/internal-host check — a
 * plausible SSRF/open-redirect surface (audit finding M-12).
 *
 * This is intentionally conservative: only http(s) URLs to a public host are
 * accepted. It does not attempt DNS resolution (that's a job for the fetch
 * layer / thumbnail worker, which should apply the same private-IP check
 * after resolving, since a public hostname can still resolve to a private IP
 * — DNS-rebinding — this check only rejects the cheap, obvious cases at
 * write time).
 */

const PRIVATE_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local, including cloud metadata endpoints (169.254.169.254)
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isSafeMediaUrl(url: string): boolean {
  if (!url || typeof url !== "string" || url.length > 2048) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (!parsed.hostname) return false;

  // Allow localhost in non-production so local dev/test media (e.g. a local
  // blob-storage emulator) keeps working — every other private/link-local
  // range, including the cloud metadata endpoint, is always rejected.
  const isLocalDevHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (isLocalDevHost && process.env.NODE_ENV !== "production") return true;

  if (PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(parsed.hostname))) return false;

  return true;
}

/** Returns the URL if safe, otherwise null — convenient for optional-field assignment. */
export function sanitizeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return isSafeMediaUrl(trimmed) ? trimmed : null;
}

/**
 * Same as isSafeMediaUrl, but also accepts an app-relative path (e.g. a
 * local blob-storage key like "/uploads/…") — for fields such as Post.image
 * that can legitimately hold either a relative storage key or a full URL.
 */
export function isSafeMediaReference(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true; // relative path, not protocol-relative
  return isSafeMediaUrl(value);
}
