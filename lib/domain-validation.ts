import net from "net";

export interface DomainValidationResult {
  ok: boolean;
  /** Normalized canonical form: lowercase, no protocol/path/port, no leading www., punycode-safe. */
  domain?: string;
  error?: string;
}

// Mirrors proxy.ts's APP_HOSTS fallback list — a user must never be able
// to "claim" one of the platform's own domains as their custom domain.
const RESERVED_HOSTS = new Set(
  (process.env.NEXT_PUBLIC_ALLOWED_DOMAINS?.split(",") || process.env.ALLOWED_DOMAINS?.split(",") || [
    "localhost",
    "localhost:3000",
    "albizmedia.com",
    "www.albizmedia.com",
  ]).map((h) => h.trim().toLowerCase().replace(/^www\./, ""))
);

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^[a-z]{2,63}$/;

/**
 * Single source of truth for turning user (or DNS Host-header) input into the
 * canonical stored/looked-up form. Always strips a leading `www.` so
 * `example.com` and `www.example.com` are never two independently-claimable
 * rows — that mismatch was the root cause of a domain-hijack vector and a
 * redundant 3-query resolve fallback chain.
 */
export function normalizeAndValidateDomain(input: unknown): DomainValidationResult {
  if (typeof input !== "string") return { ok: false, error: "Domain is required" };

  let value = input.trim().toLowerCase();
  if (!value) return { ok: false, error: "Domain is required" };

  // Strip protocol, then keep only the host portion (drop path/query/fragment/port).
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split("/")[0].split("?")[0].split("#")[0].split(":")[0];

  if (value.startsWith("*.") || value.includes("*")) {
    return { ok: false, error: "Wildcard domains aren't supported" };
  }

  if (value.startsWith("www.")) value = value.slice(4);
  if (!value) return { ok: false, error: "Enter a valid domain" };

  if (net.isIP(value) !== 0) {
    return { ok: false, error: "IP addresses can't be used as a custom domain" };
  }
  if (value === "localhost" || value.endsWith(".localhost")) {
    return { ok: false, error: "localhost can't be used as a custom domain" };
  }
  if (value.length > 253) {
    return { ok: false, error: "Domain is too long" };
  }

  // Route through the WHATWG URL parser purely to get IDN/punycode
  // normalization (e.g. homograph → xn--…) for free, with no extra dependency.
  let ascii: string;
  try {
    ascii = new URL(`http://${value}`).hostname;
  } catch {
    return { ok: false, error: "Enter a valid domain, e.g. example.com" };
  }
  if (!ascii) return { ok: false, error: "Enter a valid domain, e.g. example.com" };
  value = ascii;

  const labels = value.split(".");
  if (labels.length < 2) {
    return { ok: false, error: "Enter a full domain, including its extension, e.g. example.com" };
  }
  for (const label of labels) {
    if (!LABEL_RE.test(label)) {
      return { ok: false, error: `"${label}" isn't a valid part of a domain name` };
    }
  }
  const tld = labels[labels.length - 1];
  if (!TLD_RE.test(tld)) {
    return { ok: false, error: "That top-level domain doesn't look valid" };
  }

  if (RESERVED_HOSTS.has(value)) {
    return { ok: false, error: "This domain is reserved and can't be connected" };
  }

  return { ok: true, domain: value };
}

/** Generates a cryptographically random DNS TXT verification token. */
export function generateVerificationToken(): string {
  // Node's global crypto (webcrypto) is available in the Next.js server runtime.
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `albiz-domain-verify-${hex}`;
}

/** The DNS TXT record host a domain owner must publish the token under. */
export function verificationRecordHost(domain: string): string {
  return `_albiz-verify.${domain}`;
}
