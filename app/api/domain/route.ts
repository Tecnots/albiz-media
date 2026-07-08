import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { extractIp } from "@/lib/audit";
import { getDomainInfo, updateBranding, removeDomain, DomainServiceError } from "@/lib/domain-service";

// GET: fetch current domain settings for a user
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId || authUser.id !== userId) return unauthorized();

  try {
    const info = await getDomainInfo(userId);
    return NextResponse.json({
      domain: info.domain || "",
      domainStatus: info.domainStatus,
      domainToken: info.domainToken,
      showBranding: info.showBranding,
      verificationRecordHost: info.verificationRecordHost,
      attempts: info.attempts,
      failureReason: info.failureReason,
      verifiedAt: info.verifiedAt,
      activatedAt: info.activatedAt,
    });
  } catch (e) {
    if (e instanceof DomainServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/domain] GET error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// PATCH: update domain settings (branding toggle)
export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { userId, showBranding } = await request.json();
  if (!userId || authUser.id !== userId) return unauthorized();

  try {
    const result = await updateBranding(userId, !!showBranding);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/domain] PATCH error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// DELETE: remove custom domain
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { userId } = await request.json();
  if (!userId || authUser.id !== userId) return unauthorized();

  try {
    const info = await removeDomain(userId, extractIp(request));
    return NextResponse.json({ domain: info.domain || "", domainStatus: info.domainStatus });
  } catch (e) {
    console.error("[api/domain] DELETE error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
