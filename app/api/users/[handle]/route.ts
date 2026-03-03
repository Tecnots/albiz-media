import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = await prisma.user.findUnique({
    where: { handle },
    include: {
      experience: { orderBy: { order: "asc" } },
      education: { orderBy: { order: "asc" } },
      skills: true,
      interests: true,
      customTabs: { orderBy: { order: "asc" } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch showBranding via raw SQL (Prisma client cache may not have this field yet)
  const brandingRows = await prisma.$queryRaw<any[]>`SELECT "showBranding" FROM "User" WHERE id = ${user.id} LIMIT 1`;
  const showBranding = brandingRows[0]?.showBranding ?? true;

  return NextResponse.json({
    id: user.id,
    name: user.name,
    handle: user.handle,
    title: user.title,
    avatar: user.avatar,
    verified: user.verified,
    isPremium: user.isPremium,
    hasStory: user.hasStory,
    role: user.role,
    bio: user.bio,
    location: user.location,
    website: user.website,
    coverPhoto: user.coverPhoto,
    joinedDate: user.joinedDate,
    followers: user.followers,
    followingCount: user.followingCount,
    showBranding,
    experience: user.experience.map(e => ({
      id: e.id, role: e.role, company: e.company, logo: e.logo,
      period: e.period, description: e.description,
    })),
    education: user.education.map(e => ({
      id: e.id, school: e.school, degree: e.degree, period: e.period, logo: e.logo,
    })),
    skills: user.skills.map(s => s.name),
    interests: user.interests.map(i => i.name),
    customTabs: user.customTabs.map(t => ({
      id: t.id, title: t.title, content: t.content,
    })),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  try {
    const body = await request.json();

    const existingUser = await prisma.user.findUnique({ where: { handle } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (body.requestingUserId !== existingUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (body.handle && body.handle !== handle) {
      const taken = await prisma.user.findUnique({ where: { handle: body.handle } });
      if (taken) {
        return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
      }
    }

    // Skip blob: URLs for avatar/coverPhoto — they can't be stored in DB
    const avatarValue = body.avatar?.startsWith("blob:") ? existingUser.avatar : (body.avatar || existingUser.avatar);
    const coverValue = body.coverPhoto?.startsWith("blob:") ? existingUser.coverPhoto : (body.coverPhoto || existingUser.coverPhoto);

    // Update user scalar fields
    const user = await prisma.user.update({
      where: { handle },
      data: {
        name: body.name || existingUser.name,
        handle: body.handle || existingUser.handle,
        title: body.title || existingUser.title,
        bio: body.bio ?? existingUser.bio,
        location: body.location ?? existingUser.location,
        website: body.website ?? existingUser.website,
        avatar: avatarValue,
        coverPhoto: coverValue,
      },
    });

    // Replace experience
    await prisma.userExperience.deleteMany({ where: { userId: user.id } });
    if (body.experience?.length) {
      await prisma.userExperience.createMany({
        data: body.experience.map((e: any, i: number) => ({
          userId: user.id, role: e.role || "", company: e.company || "",
          logo: e.logo || "", period: e.period || "", description: e.description || "", order: i,
        })),
      });
    }

    // Replace education
    await prisma.userEducation.deleteMany({ where: { userId: user.id } });
    if (body.education?.length) {
      await prisma.userEducation.createMany({
        data: body.education.map((e: any, i: number) => ({
          userId: user.id, school: e.school || "", degree: e.degree || "",
          period: e.period || "", logo: e.logo || "", order: i,
        })),
      });
    }

    // Replace skills
    await prisma.userSkill.deleteMany({ where: { userId: user.id } });
    if (body.skills?.length) {
      await prisma.userSkill.createMany({
        data: body.skills.map((name: string) => ({ userId: user.id, name })),
      });
    }

    // Replace interests
    await prisma.userInterest.deleteMany({ where: { userId: user.id } });
    if (body.interests?.length) {
      await prisma.userInterest.createMany({
        data: body.interests.map((name: string) => ({ userId: user.id, name })),
      });
    }

    // Replace custom tabs
    await prisma.userCustomTab.deleteMany({ where: { userId: user.id } });
    if (body.customTabs?.length) {
      await prisma.userCustomTab.createMany({
        data: body.customTabs.map((t: any, i: number) => ({
          userId: user.id, title: t.title || "", content: t.content || "", order: i,
        })),
      });
    }

    return NextResponse.json({ success: true, handle: user.handle });
  } catch (err: any) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
