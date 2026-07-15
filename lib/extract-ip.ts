// Zero-dependency on purpose: proxy.ts pulls this in on every request and
// must never transitively reach Prisma (e.g. `pg`, which lib/prisma.ts uses).
export function extractIp(request: Request): string | null {
  const headers = (request as any).headers as Headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}
