import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET: get user interests
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json([]);

  const interests = await prisma.userInterest.findMany({
    where: { userId },
  });

  return NextResponse.json(interests.map(i => i.name));
}

// POST: save user interests
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { userId, interests } = await request.json();
    
    if (!userId || !Array.isArray(interests)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Verify the user is saving their own interests
    if (authUser.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete existing interests
    await prisma.userInterest.deleteMany({
      where: { userId },
    });

    // Create new interests
    if (interests.length > 0) {
      await prisma.userInterest.createMany({
        data: interests.map((name: string) => ({
          userId,
          name,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Save interests error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: remove a specific interest
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const { userId, interest } = await request.json();
    
    if (!userId || !interest) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    if (authUser.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.userInterest.deleteMany({
      where: { userId, name: interest },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
