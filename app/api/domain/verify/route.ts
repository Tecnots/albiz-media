import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { extractIp } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { verifyDomain, DomainServiceError } from "@/lib/domain-service";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`domain-verify:${authUser.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const { userId } = await request.json();
  if (!userId || authUser.id !== userId) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  try {
    // Runs a real DNS TXT lookup against the domain's live nameservers and,
    // on success, kicks off SSL provisioning — this always returns 200 with
    // the resulting status, since the *check itself* succeeded even when the
    // *result* is a verification failure (surfaced via domainStatus/failureReason,
    // not as an HTTP error).
    const info = await verifyDomain(userId, extractIp(request));
    return NextResponse.json({
      domain: info.domain,
      domainStatus: info.domainStatus,
      failureReason: info.failureReason,
    });
  } catch (e) {
    if (e instanceof DomainServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/domain/verify] error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
