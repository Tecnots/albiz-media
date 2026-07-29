import { scrypt, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// ─── Password hashing ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  // Legacy: plaintext passwords from demo seed (no dot separator format)
  if (!stored.includes(".")) return password === stored;
  const [hash, salt] = stored.split(".");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(hash, "hex");
  if (buf.length !== storedBuf.length) return false;
  return timingSafeEqual(buf, storedBuf);
}

// ─── Token generation ────────────────────────────────────────────────────────

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// ─── Auto-login token (post-email-verification) ────────────────────────────

const AUTO_LOGIN_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getAutoLoginSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
  return secret;
}

/**
 * Creates a short-lived HMAC-signed token that allows a one-time
 * password-less sign-in immediately after email verification.
 * The token is stateless — validity is determined by HMAC integrity + expiry.
 */
export function createAutoLoginToken(userId: number): string {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + AUTO_LOGIN_TTL_MS });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", getAutoLoginSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

/**
 * Verifies and decodes an auto-login token.
 * Returns the userId if valid, or null if expired/tampered.
 */
export function verifyAutoLoginToken(token: string): number | null {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = createHmac("sha256", getAutoLoginSecret())
    .update(payloadB64)
    .digest("base64url");

  // Timing-safe comparison to prevent signature oracle attacks
  if (sig.length !== expectedSig.length) return null;
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (typeof uid !== "number" || typeof exp !== "number") return null;
    if (Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}
