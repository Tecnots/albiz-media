import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { extractIp } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { addDomain, DomainServiceError } from "@/lib/domain-service";

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`domain-add:${authUser.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const { userId, domain } = await request.json();
  if (!userId || !domain || authUser.id !== userId) {
    return NextResponse.json({ error: "Missing or invalid userId or domain" }, { status: 400 });
  }

  try {
    const info = await addDomain(userId, domain, extractIp(request));
    return NextResponse.json({
      domain: info.domain,
      domainStatus: info.domainStatus,
      domainToken: info.domainToken,
      verificationRecordHost: info.verificationRecordHost,
    });
  } catch (e) {
    if (e instanceof DomainServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/domain/add] error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
