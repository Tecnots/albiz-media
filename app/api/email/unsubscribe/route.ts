import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

const PAGE_STYLE =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px;";
const CARD_STYLE =
  "max-width:380px;text-align:center;";

function page(body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Albiz</title></head><body style="${PAGE_STYLE}"><div style="${CARD_STYLE}">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function unsubscribe(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  const prefs = (user?.notificationPrefs as Record<string, any> | null) ?? {};
  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: { ...prefs, email: { ...prefs.email, marketing: false } } },
  });
}

// User clicked the link in the email body — show a confirmation screen rather
// than unsubscribing directly on GET, since email security scanners (Gmail
// image proxy, Outlook Safe Links) prefetch links and would otherwise trigger
// accidental unsubscribes.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("u");
  const userId = token ? verifyUnsubscribeToken(token) : null;

  if (!userId) {
    return page(`<p style="font-size:15px;color:#a3a3a3;">This unsubscribe link is invalid or has expired.</p>`);
  }

  return page(`
    <p style="font-size:17px;font-weight:600;margin:0 0 8px;">Unsubscribe from marketing emails?</p>
    <p style="font-size:14px;color:#a3a3a3;margin:0 0 24px;">You'll still receive account-related emails like sign-in codes and password resets.</p>
    <form method="POST" action="/api/email/unsubscribe?u=${encodeURIComponent(token!)}">
      <button type="submit" style="background:#F44444;color:#fff;border:0;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:600;cursor:pointer;">Unsubscribe</button>
    </form>
  `);
}

// One-click unsubscribe (RFC 8058) — mail clients that support
// List-Unsubscribe-Post send this directly when the user clicks their native
// "Unsubscribe" button, no confirmation page. Also used by the GET page's form above.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("u");
  const userId = token ? verifyUnsubscribeToken(token) : null;

  if (!userId) {
    return NextResponse.json({ error: "Invalid or expired unsubscribe link" }, { status: 400 });
  }

  await unsubscribe(userId);

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return page(`<p style="font-size:17px;font-weight:600;">You're unsubscribed.</p>`);
  }
  return NextResponse.json({ success: true });
}
