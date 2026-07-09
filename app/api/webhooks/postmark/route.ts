import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/admin-notifier";

// Postmark webhooks are authenticated via HTTP Basic Auth configured on the
// webhook URL itself (Servers → Webhooks in the Postmark dashboard —
// https://user:pass@albizmedia.com/api/webhooks/postmark). Verify it here too
// since the URL/credentials could otherwise be replayed by anyone who finds them.
function isAuthorized(request: NextRequest): boolean {
  const user = process.env.POSTMARK_WEBHOOK_USER;
  const pass = process.env.POSTMARK_WEBHOOK_PASS;
  if (!user || !pass) {
    console.error("[POSTMARK WEBHOOK] POSTMARK_WEBHOOK_USER/PASS not configured — endpoint is unprotected");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  return header === expected;
}

interface PostmarkWebhookEvent {
  RecordType: "Bounce" | "SpamComplaint" | "Delivery" | "Open" | "Click" | "SubscriptionChange";
  Email?: string;
  Type?: string; // Bounce sub-type: HardBounce, SoftBounce, Transient, Blocked, ...
  TypeCode?: number;
  Description?: string;
  MessageID?: string;
}

// Bounce sub-types that mean "this address will never accept mail again" —
// repeatedly retrying these is what tanks sender reputation, so they go
// straight to the suppression list. Soft/transient bounces are left alone;
// Postmark itself only auto-suppresses after repeated soft bounces.
const HARD_BOUNCE_TYPES = new Set(["HardBounce", "Blocked", "SpamNotification", "ManuallyDeactivated"]);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event: PostmarkWebhookEvent = await request.json();
  const email = event.Email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Missing Email" }, { status: 400 });
  }

  if (event.RecordType === "SpamComplaint") {
    await prisma.emailSuppression.upsert({
      where: { email },
      create: { email, reason: "complaint", source: "postmark" },
      update: {},
    });
    // A spam complaint is the single most actionable signal in this whole
    // pipeline — every one directly damages domain/IP reputation with the
    // ISP that reported it. Surface it immediately rather than waiting for
    // a periodic digest.
    await notifyAdmin({
      type: "SYSTEM",
      title: "Spam complaint received",
      message: `A recipient marked an email as spam. The address has been added to the suppression list.`,
      metadata: { email, recordType: event.RecordType },
    });
  } else if (event.RecordType === "Bounce" && event.Type && HARD_BOUNCE_TYPES.has(event.Type)) {
    await prisma.emailSuppression.upsert({
      where: { email },
      create: { email, reason: `bounce:${event.Type}`, source: "postmark" },
      update: {},
    });
  }

  return NextResponse.json({ success: true });
}
