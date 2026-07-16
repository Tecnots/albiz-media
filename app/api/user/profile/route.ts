import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

function normalizeUrl(raw: unknown): string | null | { error: string } {
  if (raw === undefined || raw === null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { error: "Website must use http or https" };
    }
    return u.href.slice(0, 500);
  } catch {
    return { error: "Website is not a valid URL" };
  }
}

export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json();
    const { name, title, bio, location, website, avatar, gender, birthYear } = body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (title !== undefined) updates.title = title;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) {
      const normalized = normalizeUrl(website);
      if (normalized && typeof normalized === "object" && "error" in normalized) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }
      updates.website = normalized;
    }
    if (avatar !== undefined) updates.avatar = avatar;
    if (gender !== undefined) updates.gender = gender || null;
    if (birthYear !== undefined) {
      const yr = parseInt(birthYear);
      updates.birthYear = (!isNaN(yr) && yr >= 1900 && yr <= new Date().getFullYear()) ? yr : null;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: authUser.id },
        data: updates,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
