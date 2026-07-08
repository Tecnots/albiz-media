import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { musicProvider } from "@/app/lib/music/provider";

// GET /api/music/search?q=&category= — Story music sticker picker. Talks to
// the catalog only through musicProvider, so swapping the backing provider
// (e.g. to a paid catalog later) never touches this route.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const category = req.nextUrl.searchParams.get("category") ?? undefined;

  const { tracks } = await musicProvider.search(q, category);
  return NextResponse.json({ tracks });
}
