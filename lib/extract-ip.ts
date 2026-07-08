// Zero-dependency on purpose: middleware.ts runs on the Edge runtime and
// cannot pull in Node-only modules (e.g. `pg`, which lib/prisma.ts uses) —
// this must never import anything that transitively reaches Prisma.
export function extractIp(request: Request): string | null {
  const headers = (request as any).headers as Headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}
