import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Used by middleware to resolve a custom domain to a user handle
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  // Try with exact match first, then without www, then with www
  const user = await prisma.user.findFirst({
    where: { customDomain: domain, domainStatus: "ACTIVE" },
    select: { handle: true },
  });

  if (!user) {
    // Try without www prefix
    const withoutWww = domain.replace(/^www\./, "");
    const userWithoutWww = await prisma.user.findFirst({
      where: { customDomain: withoutWww, domainStatus: "ACTIVE" },
      select: { handle: true },
    });

    if (!userWithoutWww) {
      // Try with www prefix
      const withWww = domain.startsWith("www.") ? domain : `www.${domain}`;
      const userWithWww = await prisma.user.findFirst({
        where: { customDomain: withWww, domainStatus: "ACTIVE" },
        select: { handle: true },
      });

      if (!userWithWww) {
        return NextResponse.json({ error: "Domain not found" }, { status: 404 });
      }

      return NextResponse.json({ handle: userWithWww.handle });
    }

    return NextResponse.json({ handle: userWithoutWww.handle });
  }

  return NextResponse.json({ handle: user.handle });
}
