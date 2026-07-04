import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Known app domains — requests from these are normal app traffic
const APP_HOSTS = new Set([
  ...(process.env.NEXT_PUBLIC_ALLOWED_DOMAINS?.split(",") || process.env.ALLOWED_DOMAINS?.split(",") || ["localhost", "localhost:3000", "albizmedia.com", "www.albizmedia.com"]),
]);

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

  // 2c. Enforce Uploader (Shorts Creator) Routes
  if (path.startsWith("/uploader")) {
    if (role !== "SHORTS_CREATOR" && role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Enforce Protected User Routes
  const protectedUserRoutes = ["/settings", "/saved", "/messages", "/notifications", "/circle"];
  if (protectedUserRoutes.some(route => path.startsWith(route))) {
    if (!session) return NextResponse.redirect(new URL("/?auth=login", request.url));
  }

  // Check for query parameter testing (for local development)
  const testDomain = request.nextUrl.searchParams.get("domain");
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
    const res = await fetch(`${baseUrl}/api/domain/resolve?domain=${encodeURIComponent(hostname)}`);
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

export const config = {
  // Only run middleware on pages, not on API routes, static files, etc.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
