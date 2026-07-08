import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/places/autocomplete?input=...&sessiontoken=... — server-side proxy to
// Google's Places API (New) so the API key never reaches the client and requests
// can be rate-limited. Requires GOOGLE_MAPS_SERVER_API_KEY (a server-only key,
// NOT the browser-exposed NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — that one is typically
// HTTP-referrer restricted and will reject requests with no browser Referer).
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

  const input = req.nextUrl.searchParams.get("input")?.trim() ?? "";
  const sessionToken = req.nextUrl.searchParams.get("sessiontoken") ?? undefined;
  if (input.length < 1) return NextResponse.json({ suggestions: [] });

  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Location search is not configured", suggestions: [] }, { status: 503 });
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({ input, sessionToken }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("Places autocomplete error:", res.status, errBody);
      return NextResponse.json({ error: "Location search failed", suggestions: [] }, { status: 502 });
    }
    const json = await res.json();
    const suggestions = (json.suggestions ?? [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => ({
        placeId: s.placePrediction.placeId,
        description: s.placePrediction.text?.text ?? "",
        mainText: s.placePrediction.structuredFormat?.mainText?.text ?? "",
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? "",
      }));
    return NextResponse.json({ suggestions });
  } catch (e: any) {
    console.error("Places autocomplete error:", e);
    return NextResponse.json({ error: "Location search failed", suggestions: [] }, { status: 500 });
  }
}
