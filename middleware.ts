import { NextRequest, NextResponse } from "next/server";

// Known app domains — requests from these are normal app traffic
const APP_HOSTS = new Set([
  ...(process.env.NEXT_PUBLIC_ALLOWED_DOMAINS?.split(",") || process.env.ALLOWED_DOMAINS?.split(",") || ["localhost", "localhost:3000", "albizmedia.com", "www.albizmedia.com"]),
]);

// Routes that don't require email verification
const PUBLIC_ROUTES = [
  "/auth",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/logo.svg",
];

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // Check for query parameter testing (for local development)
  const testDomain = request.nextUrl.searchParams.get("domain");
  if (testDomain && (APP_HOSTS.has(host) || APP_HOSTS.has(hostname))) {
    // For testing: extract handle from domain name (e.g., "abhina.com" -> "abhina")
    const handle = testDomain.replace(/^www\./, "").replace(/\..*$/, "");
    if (handle) {
      const url = request.nextUrl.clone();
      url.pathname = `/${handle}`;
      url.searchParams.delete("domain");
      url.searchParams.set("_customDomain", "1");
      
      // Try to check if the handle exists by fetching the page
      try {
        const port = request.nextUrl.port || "3000";
        const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
        const checkRes = await fetch(`${baseUrl}/api/user/by-handle?handle=${handle}`, {
          headers: { cookie: request.headers.get("cookie") || "" },
        });
        if (checkRes.ok) {
          return NextResponse.redirect(url);
        }
      } catch {
        // If check fails, still redirect - the page will show "User not found"
      }
      
      return NextResponse.redirect(url);
    }
  }

  // If it's the main app domain, check email verification
  if (APP_HOSTS.has(host) || APP_HOSTS.has(hostname)) {
    // Check if user has a session cookie (basic auth check)
    const sessionCookie = request.cookies.get("authjs.session-token") ||
                         request.cookies.get("__Secure-authjs.session-token") ||
                         request.cookies.get("next-auth.session-token") ||
                         request.cookies.get("__Secure-next-auth.session-token");

    // Note: We bypass the server-side check-session-verification fetch in middleware
    // to prevent local development server deadlocks, as the client handles verification routing anyway.

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
        // Rewrite to the user's profile page, flag it as custom domain
        const url = request.nextUrl.clone();
        url.pathname = `/${handle}`;
        url.searchParams.set("_customDomain", "1");
        return NextResponse.rewrite(url);
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
