import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    return NextResponse.json({ 
      authenticated: !!authUser,
      userId: authUser?.id || null,
      email: authUser?.email || null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
