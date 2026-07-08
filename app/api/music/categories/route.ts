import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { musicProvider } from "@/app/lib/music/provider";

// GET /api/music/categories — category chips for the music picker's browse view.
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized();

  const categories = await musicProvider.categories();
  return NextResponse.json({ categories });
}
