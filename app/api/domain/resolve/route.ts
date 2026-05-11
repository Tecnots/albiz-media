import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Used by middleware to resolve a custom domain to a user handle
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { customDomain: domain, domainStatus: "ACTIVE" },
    select: { handle: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json({ handle: user.handle });
}
