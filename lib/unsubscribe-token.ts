import { createHmac, timingSafeEqual } from "crypto";

// Stateless, unguessable per-user unsubscribe token — no extra DB column/table
// needed. Reuses NEXTAUTH_SECRET (already required in every environment) with
// a purpose-specific prefix so this can't be confused with session tokens.
function sign(userId: number): string {
  const secret = process.env.NEXTAUTH_SECRET!;
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("base64url");
}

export function generateUnsubscribeToken(userId: number): string {
  return `${userId}.${sign(userId)}`;
}

export function verifyUnsubscribeToken(token: string): number | null {
  const [idStr, sig] = token.split(".");
  const userId = Number(idStr);
  if (!idStr || !sig || !Number.isInteger(userId) || userId <= 0) return null;

  const expected = sign(userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}
