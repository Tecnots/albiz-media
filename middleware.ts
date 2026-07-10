import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { extractIp } from "./lib/extract-ip";

// TEMPORARILY DISABLED FOR DEBUGGING — Vercel preview was failing with
// MIDDLEWARE_INVOCATION_FAILED / "ReferenceError: __dirname is not defined".
// Bypassing the NextAuth-wrapped middleware below (RBAC/auth/authorization
// logic) to confirm whether this file is the root cause. Nothing was
// deleted — see the commented-out block and the re-enable notes at the
// bottom of this file.
// const { auth } = NextAuth(authConfig);

// Known app domains — requests from these are normal app traffic
const APP_HOSTS = new Set([
  ...(process.env.NEXT_PUBLIC_ALLOWED_DOMAINS?.split(",") || process.env.ALLOWED_DOMAINS?.split(",") || ["localhost", "localhost:3000", "albizmedia.com", "www.albizmedia.com"]),
]);

/* TEMPORARILY DISABLED FOR DEBUGGING — original RBAC/auth/authorization middleware.
export default auth(async function middleware(request: NextRequest & { auth?: any }) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const path = request.nextUrl.pathname;
  const session = request.auth;
  const role = session?.user?.role;

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
    if (!session) return NextResponse.redirect(new URL("/?auth=login", request.url));
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
    if (session?.user?.handle && path.slice(1).toLowerCase() === session.user.handle.toLowerCase()) {
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
        if (session?.user) {
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
});
*/

// TEMPORARILY DISABLED FOR DEBUGGING — bypass: let every request through
// unmodified so we can confirm whether the RBAC/auth middleware above is
// what's causing the Vercel preview's MIDDLEWARE_INVOCATION_FAILED error.
export default function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Only run middleware on pages, not on API routes, static files, etc.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
