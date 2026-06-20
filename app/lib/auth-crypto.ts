import { scrypt, randomBytes, timingSafeEqual } from "crypto";
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
