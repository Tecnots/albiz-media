import { NextRequest, NextResponse } from "next/server";
import { getProfileSocialData } from "@/lib/profile-social";
import { getAuthUser } from "@/app/lib/auth";

// GET /api/users/profile-social?userId=1
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  let viewerId: number | null = null;
  try {
    const auth = await getAuthUser(request);
    viewerId = auth?.id ?? null;
  } catch {
    // Not authenticated — mutual connections won't be computed
  }

  try {
    const data = await getProfileSocialData(userId, viewerId);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[profile-social]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
