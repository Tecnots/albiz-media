import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { fanOutCampaign } from "@/lib/campaign-sender";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const recipientCount = await fanOutCampaign(id);

    await logActivity({
      eventType: "CAMPAIGN_SENT",
      userId: user.id,
      meta: JSON.stringify({ campaignId: id, recipientCount }),
    });

    return NextResponse.json({ success: true, recipientCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Campaign not found") {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (msg.startsWith("STATUS_CHANGED:")) {
      const currentStatus = msg.split(":")[1];
      return NextResponse.json(
        { error: `Campaign is '${currentStatus}' — can only send from 'draft'` },
        { status: 409 }
      );
    }
    // Audience configuration errors (e.g. missing audienceFilter.role) are user errors, not server errors.
    if (msg.includes("audienceFilter.role required") || msg.startsWith("Unknown audience type")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[send-campaign] fanOutCampaign failed:", err);
    return NextResponse.json({ error: "Failed to send campaign" }, { status: 500 });
  }
}