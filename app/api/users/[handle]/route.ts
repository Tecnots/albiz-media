import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { comparePassword } from "@/app/lib/auth-crypto";
import { blobStorageService } from "@/lib/blob-storage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;

    // Try full query with related tables; fall back to scalar-only if schema is behind
    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: { handle },
        include: {
          experience: { orderBy: { order: "asc" } },
          education: { orderBy: { order: "asc" } },
          skills: true,
          interests: true,
          customTabs: { orderBy: { order: "asc" } },
        },
      });
    } catch {
      user = await prisma.user.findUnique({ where: { handle } });
      if (user) {
        user.experience = [];
        user.education = [];
        user.skills = [];
        user.interests = [];
        user.customTabs = [];
      }
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch showBranding via raw SQL (column may not exist on older DB migrations)
    let showBranding = true;
    try {
      const brandingRows = await prisma.$queryRaw<any[]>`SELECT "showBranding" FROM "User" WHERE id = ${user.id} LIMIT 1`;
      showBranding = brandingRows[0]?.showBranding ?? true;
    } catch {
      // Column doesn't exist yet — default to true
    }

    // Fetch highlights via raw SQL (table may not exist on older DB migrations)
    let highlightRows: any[] = [];
    try {
      highlightRows = await prisma.$queryRaw<any[]>`
      SELECT id, name, cover, images, "storyCount", "order", COALESCE(visibility, 'public') as visibility
      FROM "UserHighlight"
      WHERE "userId" = ${user.id}
      ORDER BY "order" ASC
    `;
    } catch {
      // Table doesn't exist yet — return empty array
    }

    // Fetch latest CircleUpgradeRequest for pre-filling profile edit form
    let circleUpgradeRequest: any = null;
    try {
      circleUpgradeRequest = await prisma.circleUpgradeRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      // Table may not exist on older migrations
    }

    // Only expose circleUpgradeRequest to the profile owner or an admin
    const authUser = await getAuthUser(request).catch(() => null);
    const isOwner = authUser && authUser.id === user.id;
    const isAdmin = authUser && (authUser as any).role === "ADMIN";

    return NextResponse.json({
      id: user.id,
      name: user.name,
      handle: user.handle,
      title: user.title,
      avatar: blobStorageService.resolveMediaUrl(user.avatar),
      verified: user.verified,
      isPremium: user.isPremium,
      hasStory: user.hasStory,
      role: user.role,
      bio: user.bio,
      location: user.location,
      website: user.website,
      coverPhoto: blobStorageService.resolveMediaUrl(user.coverPhoto),
      joinedDate: user.joinedDate,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      followers: user.followers,
      followingCount: user.followingCount,
      country: user.country,
      district: user.district,
      city: user.city,
      pincode: user.pincode,
      showBranding,
      experience: user.experience.map((e: any) => ({
        id: e.id, role: e.role, company: e.company, logo: blobStorageService.resolveMediaUrl(e.logo),
        period: e.period, description: e.description,
      })),
      education: user.education.map((e: any) => ({
        id: e.id, school: e.school, degree: e.degree, period: e.period, logo: blobStorageService.resolveMediaUrl(e.logo),
      })),
      skills: user.skills.map((s: any) => s.name),
      interests: user.interests.map((i: any) => i.name),
      customTabs: user.customTabs.map((t: any) => ({
        id: t.id, title: t.title, content: t.content,
      })),
      highlights: highlightRows
        .filter(h => isOwner || isAdmin || h.visibility !== "hidden")
        .map(h => ({
          id: h.id, name: h.name, cover: blobStorageService.resolveMediaUrl(h.cover), images: (h.images || []).map((img: string) => blobStorageService.resolveMediaUrl(img)), storyCount: h.storyCount, visibility: h.visibility || "public",
        })),
      ...(isOwner || isAdmin ? {
        circleUpgradeRequest: circleUpgradeRequest ? {
          fullName: circleUpgradeRequest.fullName,
          professionalTitle: circleUpgradeRequest.professionalTitle,
          company: circleUpgradeRequest.company,
          location: circleUpgradeRequest.location,
          country: circleUpgradeRequest.country,
          district: circleUpgradeRequest.district,
          city: circleUpgradeRequest.city,
          pincode: circleUpgradeRequest.pincode,
          website: circleUpgradeRequest.website,
          linkedin: circleUpgradeRequest.linkedin,
          bio: circleUpgradeRequest.bio,
          reason: circleUpgradeRequest.reason,
        } : null,
      } : {}),
    });
  } catch (err: any) {
    console.error("[GET /api/users/[handle]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json();

    const existingUser = await prisma.user.findUnique({ where: { handle } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (authUser.id !== existingUser.id) {
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
        bio: "bio" in body ? body.bio : existingUser.bio,
        location: "location" in body ? body.location : existingUser.location,
        country: "country" in body ? body.country : existingUser.country,
        district: "district" in body ? body.district : existingUser.district,
        city: "city" in body ? body.city : existingUser.city,
        pincode: "pincode" in body ? body.pincode : existingUser.pincode,
        website: "website" in body ? body.website : existingUser.website,
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

    // Replace highlights via raw SQL (cached Prisma client doesn't know UserHighlight)
    await prisma.$executeRaw`DELETE FROM "UserHighlight" WHERE "userId" = ${user.id}`;
    if (body.highlights?.length) {
      for (let i = 0; i < body.highlights.length; i++) {
        const h = body.highlights[i];
        const name = h.name || "";
        const cover = h.cover?.startsWith("blob:") ? `https://picsum.photos/seed/hl-${user.id}-${i}/200/200` : (h.cover || "");
        const images = (h.images || []).map((img: string) =>
          img.startsWith("blob:") ? `https://picsum.photos/seed/hlimg-${user.id}-${i}-${Math.random().toString(36).slice(2, 8)}/400/700` : img
        );
        const storyCount = images.length || h.storyCount || 0;
        const visibility = h.visibility === "hidden" ? "hidden" : "public";
        await prisma.$executeRaw`
          INSERT INTO "UserHighlight" ("userId", name, cover, images, "storyCount", "order", visibility)
          VALUES (${user.id}, ${name}, ${cover}, ${images}, ${storyCount}, ${i}, ${visibility})
        `;
      }
    }

    return NextResponse.json({ success: true, handle: user.handle });
  } catch (err: any) {
    console.error("[PUT /api/users/[handle]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — Add a story image to a highlight (or create a new one)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const user = await prisma.user.findUnique({ where: { handle } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (authUser.id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { action } = body;

    if (action === "addToHighlight") {
      const { highlightId, imageUrl, highlightName } = body;

      if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });

      if (highlightId) {
        // Add to existing highlight
        const rows = await prisma.$queryRaw<any[]>`
          SELECT id, images, cover, "storyCount" FROM "UserHighlight"
          WHERE id = ${highlightId} AND "userId" = ${user.id}
          LIMIT 1
        `;
        if (!rows.length) return NextResponse.json({ error: "Highlight not found" }, { status: 404 });

        const hl = rows[0];
        const existingImages: string[] = hl.images || [];
        if (existingImages.includes(imageUrl)) {
          return NextResponse.json({ success: true, alreadyAdded: true });
        }
        const newImages = [...existingImages, imageUrl];
        const newCover = hl.cover || imageUrl;
        await prisma.$executeRaw`
          UPDATE "UserHighlight"
          SET images = ${newImages}, "storyCount" = ${newImages.length}, cover = ${newCover}
          WHERE id = ${highlightId} AND "userId" = ${user.id}
        `;
        return NextResponse.json({ success: true, highlightId });
      } else {
        // Create new highlight
        const name = highlightName || "Highlight";
        const maxOrder = await prisma.$queryRaw<any[]>`
          SELECT COALESCE(MAX("order"), -1) as max_order FROM "UserHighlight" WHERE "userId" = ${user.id}
        `;
        const nextOrder = (maxOrder[0]?.max_order ?? -1) + 1;
        const images = [imageUrl];
        const storyCount = 1;
        const visibility = "public";
        await prisma.$executeRaw`
          INSERT INTO "UserHighlight" ("userId", name, cover, images, "storyCount", "order", visibility)
          VALUES (${user.id}, ${name}, ${imageUrl}, ${images}, ${storyCount}, ${nextOrder}, ${visibility})
        `;
        // Get the created highlight ID
        const created = await prisma.$queryRaw<any[]>`
          SELECT id FROM "UserHighlight" WHERE "userId" = ${user.id} ORDER BY id DESC LIMIT 1
        `;
        return NextResponse.json({ success: true, highlightId: created[0]?.id });
      }
    }

    if (action === "getHighlights") {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT id, name, cover, images, "storyCount", "order", COALESCE(visibility, 'public') as visibility
        FROM "UserHighlight"
        WHERE "userId" = ${user.id}
        ORDER BY "order" ASC
      `;
      return NextResponse.json(rows.map(h => ({
        id: h.id, name: h.name, cover: blobStorageService.resolveMediaUrl(h.cover),
        images: (h.images || []).map((img: string) => blobStorageService.resolveMediaUrl(img)),
        storyCount: h.storyCount, visibility: h.visibility || "public",
      })));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("[PATCH /api/users/[handle]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { handle } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (authUser.id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Validate password using hash comparison
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Delete related records in the correct order to avoid foreign key constraints
    // Delete post comments and likes first
    await prisma.postComment.deleteMany({ where: { post: { userId: user.id } } });
    await prisma.postLike.deleteMany({ where: { post: { userId: user.id } } });

    // Delete posts
    await prisma.post.deleteMany({ where: { userId: user.id } });

    // Delete notifications
    await prisma.notification.deleteMany({ where: { userId: user.id } });

    // Delete conversations and messages
    await prisma.message.deleteMany({ where: { conversation: { userId: user.id } } });
    await prisma.conversation.deleteMany({ where: { userId: user.id } });

    // Delete follow relationships
    await prisma.userFollow.deleteMany({ where: { followerId: user.id } });
    await prisma.userFollow.deleteMany({ where: { followingId: user.id } });

    // Delete blocked users
    await prisma.blockedUser.deleteMany({ where: { blockerId: user.id } });
    await prisma.blockedUser.deleteMany({ where: { blockedId: user.id } });

    // Delete stories
    await prisma.story.deleteMany({ where: { userId: user.id } });

    // Delete profile data
    await prisma.userExperience.deleteMany({ where: { userId: user.id } });
    await prisma.userEducation.deleteMany({ where: { userId: user.id } });
    await prisma.userSkill.deleteMany({ where: { userId: user.id } });
    await prisma.userInterest.deleteMany({ where: { userId: user.id } });
    await prisma.userCustomTab.deleteMany({ where: { userId: user.id } });
    await prisma.userHighlight.deleteMany({ where: { userId: user.id } });

    // Delete saved posts
    await prisma.savedPost.deleteMany({ where: { userId: user.id } });

    // Delete social connections and messages
    await prisma.socialMessage.deleteMany({ where: { connection: { userId: user.id } } });
    await prisma.socialConnection.deleteMany({ where: { userId: user.id } });

    // Delete circle upgrade requests
    await prisma.circleUpgradeRequest.deleteMany({ where: { userId: user.id } });

    // Delete auth accounts and sessions
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });

    // Finally delete the user
    await prisma.user.delete({ where: { id: user.id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/users/[handle]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
