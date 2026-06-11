import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/app/lib/auth";

// Detect country from Vercel geo headers and persist to user record.
// Vercel injects x-vercel-ip-country on all edge/serverless requests.
// Falls back gracefully in local dev (no header → null).
export async function POST(req: NextRequest) {
  // Read Vercel's built-in geo header — no external service needed
  const countryCode = req.headers.get("x-vercel-ip-country") ?? null;
  const city        = req.headers.get("x-vercel-ip-city") ?? null;

  if (!countryCode) {
    return NextResponse.json({ countryCode: null, updated: false });
  }

  // Persist to user record if authenticated
  const authUser = await getAuthUser(req);
  if (authUser?.id) {
    try {
      await prisma.$executeRaw`
        UPDATE "User"
        SET
          "countryCode"      = ${countryCode},
          "countrySource"    = 'IP',
          "countryUpdatedAt" = NOW()
        WHERE id = ${authUser.id}
          AND (
            "countryCode" IS NULL
            OR "countryUpdatedAt" < NOW() - INTERVAL '7 days'
            OR "countrySource" = 'IP'
          )
      `;
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ countryCode, city, updated: !!authUser?.id });
}

// Allow GET so client can probe without CSRF concerns
export async function GET(req: NextRequest) {
  const countryCode = req.headers.get("x-vercel-ip-country") ?? null;
  const city        = req.headers.get("x-vercel-ip-city") ?? null;
  return NextResponse.json({ countryCode, city });
}
