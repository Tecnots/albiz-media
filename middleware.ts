import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { extractIp } from "./lib/extract-ip";

// Known app domains — requests from these are normal app traffic
const APP_HOSTS = new Set([
  ...(process.env.NEXT_PUBLIC_ALLOWED_DOMAINS?.split(",") || process.env.ALLOWED_DOMAINS?.split(",") || ["localhost", "localhost:3000", "albizmedia.com", "www.albizmedia.com"]),
]);

export default async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const path = request.nextUrl.pathname;
  // Read the session directly from the JWT cookie instead of wrapping this
  // middleware in NextAuth's `auth()` HOC — that HOC calls next-auth's
  // internal `reqWithEnvURL`, which destructures `req.nextUrl.href` whenever
  // AUTH_URL/NEXTAUTH_URL is set (it is, here) and was crashing every
  // request with MIDDLEWARE_INVOCATION_FAILED. `getToken` never touches
  // `nextUrl`, only `request.headers`, so it sidesteps that crash entirely.
  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:",
  })) as any;
  const role = token?.role;

  // 1. Enforce Admin Routes
  if (path.startsWith("/admin")) {
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. Enforce Author Routes
  if (path.startsWith("/authors")) {
    if (role !== "AUTHOR" && role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
  }

  // 2b. Enforce Editor Routes
  if (path.startsWith("/editor")) {
    if (role !== "EDITOR" && role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
  }

  // 2c. "/uploaders" (plural) has no page of its own — send it to the real destination
  // instead of letting it fall through to the [handle] profile lookup.
  if (path === "/uploaders" || path.startsWith("/uploaders/")) {
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin/uploaders", request.url));
    return NextResponse.redirect(new URL("/uploader", request.url));
  }

  // 2d. Enforce Uploader Routes
  if (path.startsWith("/uploader")) {
    if (role !== "UPLOADER" && role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Enforce Protected User Routes
  const protectedUserRoutes = ["/settings", "/saved", "/messages", "/notifications", "/circle"];
  if (protectedUserRoutes.some(route => path.startsWith(route))) {
    if (!token) return NextResponse.redirect(new URL("/?auth=login", request.url));
  }

  // Check for query parameter testing (local development only — this used to
  // run in production too, and a crafted `?domain=` value could ride a
  // same-origin redirect to an arbitrary internal path via `..` segment
  // collapsing once reassigned onto url.pathname).
  const testDomain = process.env.NODE_ENV === "development" ? request.nextUrl.searchParams.get("domain") : null;
  if (testDomain && (APP_HOSTS.has(host) || APP_HOSTS.has(hostname))) {
    // For testing: extract handle from domain name (e.g., "abhina.com" -> "abhina")
    const handle = testDomain.replace(/^www\./, "").replace(/\..*$/, "");
    if (handle) {
      const url = request.nextUrl.clone();
      url.pathname = `/p/${handle}`;
      url.searchParams.delete("domain");
      url.searchParams.delete("_customDomain");
      return NextResponse.redirect(url);
    }
  }

  if (APP_HOSTS.has(host) || APP_HOSTS.has(hostname)) {
    if (token?.handle && path.slice(1).toLowerCase() === (token.handle as string).toLowerCase()) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Custom domain detected — look up which user owns it
  try {
    const port = request.nextUrl.port || "3000";
    const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
    // Forward the real visitor IP so /api/domain/resolve's rate limiter keys
    // on the actual caller instead of collapsing every custom-domain visitor
    // platform-wide onto a single "unknown" bucket.
    const clientIp = extractIp(request);
    const res = await fetch(`${baseUrl}/api/domain/resolve?domain=${encodeURIComponent(hostname)}`, {
      headers: clientIp ? { "x-forwarded-for": clientIp } : undefined,
    });
    if (res.ok) {
      const { handle } = await res.json();
      if (handle) {
        const url = request.nextUrl.clone();
        if (token) {
          url.pathname = "/";
          return NextResponse.rewrite(url);
        } else {
          url.pathname = `/p/${handle}`;
          return NextResponse.rewrite(url);
        }
      }
    }
  } catch {
    // Fall through to normal routing on error
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on pages, not on API routes, static files, etc.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
