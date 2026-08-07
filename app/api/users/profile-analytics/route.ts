import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/lib/auth";
import { getProfileAnalytics } from "@/lib/profile-analytics";

export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only the profile owner or an admin can access analytics
  if (authUser.id !== userId && authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getProfileAnalytics(userId);
    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[profile-analytics]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
