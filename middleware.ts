import { NextRequest, NextResponse } from "next/server";

// Known app domains — requests from these are normal app traffic
const APP_HOSTS = new Set([
  "localhost",
  "localhost:3000",
  "albizmedia.com",
  "www.albizmedia.com",
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

  // If it's the main app domain, check email verification
  if (APP_HOSTS.has(host) || APP_HOSTS.has(hostname)) {
    // Check if user has a session cookie (basic auth check)
    const sessionCookie = request.cookies.get("next-auth.session-token") || 
                         request.cookies.get("__Secure-next-auth.session-token");
    
    if (sessionCookie) {
      // User has a session, check email verification via API
      try {
        const response = await fetch(`${request.nextUrl.origin}/api/auth/check-session-verification`, {
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          // If user is not verified, we'll still allow access but the frontend will handle verification
          // The verification email should have been sent during signup
        }
      } catch (error) {
        console.error("Middleware error checking email verification:", error);
      }
    }
    
    return NextResponse.next();
  }

  // Custom domain detected — look up which user owns it
  try {
    const port = request.nextUrl.port || "3000";
    const res = await fetch(`http://localhost:${port}/api/domain/resolve?domain=${encodeURIComponent(hostname)}`);
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
