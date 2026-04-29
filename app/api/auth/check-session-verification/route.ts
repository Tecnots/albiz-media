import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (user) {
      return NextResponse.json({ 
        verified: true,
        userId: user.id,
        emailVerified: user.emailVerified
      });
    }
    
    return NextResponse.json({ verified: false });
  } catch (error) {
    console.error("Check session verification error:", error);
    return NextResponse.json({ verified: false }, { status: 401 });
  }
}
