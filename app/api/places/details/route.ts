import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/places/details?placeId=... — resolves a placeId (from /api/places/autocomplete)
// to a display name + lat/lng, so the story's structured location fields can be filled in.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const limit = await rateLimit(`places:${authUser.id}`, 30, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(limit.error, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  const placeId = req.nextUrl.searchParams.get("placeId")?.trim();
  if (!placeId) return NextResponse.json({ error: "Missing placeId" }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Location search is not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,displayName,formattedAddress,location" },
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Places details error:", res.status, errBody);
      return NextResponse.json({ error: "Failed to resolve location" }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json({
      placeId: json.id ?? placeId,
      name: json.displayName?.text ?? json.formattedAddress ?? "",
      formattedAddress: json.formattedAddress ?? "",
      lat: json.location?.latitude ?? null,
      lng: json.location?.longitude ?? null,
    });
  } catch (e: any) {
    console.error("Places details error:", e);
    return NextResponse.json({ error: "Failed to resolve location" }, { status: 500 });
  }
}
