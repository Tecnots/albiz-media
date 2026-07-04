import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendRawEmail } from "@/lib/workers/email-worker";
import { campaignEmailTemplate } from "@/lib/circle-email-templates";
import { sendPushToUser } from "@/lib/fcm-send";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const testEmail = (body.email as string | undefined)?.trim() || user.email;

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: { name: true, subject: true, bodyHtml: true, metadata: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const meta = campaign.metadata as Record<string, unknown> | null;
  const channels = (meta?.channels as string[]) ?? ["email"];
  const errors: string[] = [];

  // Test email
  if (channels.includes("email")) {
    try {
      const { subject, html } = campaignEmailTemplate({
        recipientName: user.name,
        subject: `[TEST] ${campaign.subject}`,
        bodyHtml: campaign.bodyHtml,
      });
      await sendRawEmail(testEmail, subject, html);
    } catch (e) {
      errors.push(`Email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Test push — sends to the requesting admin only
  if (channels.includes("push")) {
    try {
      await sendPushToUser(user.id, {
        title: `[TEST] ${(meta?.messageTitle as string) || campaign.name}`,
        body: (meta?.notificationBody as string) || campaign.subject,
        url: "/",
      });
    } catch (e) {
      errors.push(`Push: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 207 });
  }

  return NextResponse.json({ success: true, sentTo: testEmail, channels });
}
