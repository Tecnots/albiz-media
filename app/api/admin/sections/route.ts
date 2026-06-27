import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN" && user.role !== "AUTHOR" && user.role !== "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sections = await prisma.articleSection.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        active: true,
        workflowPresetId: true,
        workflowPreset: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ sections });
  } catch (err) {
    console.error("[admin/sections GET]", err);
    return NextResponse.json({ error: "Failed to load sections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { name, slug: rawSlug, description, color } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const slug = rawSlug?.trim()
      ? rawSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
      : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const existing = await prisma.articleSection.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "A section with this slug already exists" }, { status: 409 });

    const section = await prisma.articleSection.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        color: color || "#525252",
        active: true,
      },
      select: {
        id: true, name: true, slug: true, description: true,
        color: true, active: true, workflowPresetId: true,
        workflowPreset: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ section });
  } catch (err) {
    console.error("[admin/sections POST]", err);
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id, name, slug: rawSlug, description, color, active, workflowPresetId } = await req.json();
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      data.name = name.trim();
      // If slug also provided use it; otherwise re-derive from name
      const slug = rawSlug?.trim()
        ? rawSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
        : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      data.slug = slug;
    } else if (rawSlug !== undefined) {
      data.slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    }

    if (description !== undefined) data.description = description?.trim() || null;
    if (color !== undefined) data.color = color;
    if (active !== undefined) data.active = active;
    if (workflowPresetId !== undefined) {
      data.workflowPresetId = workflowPresetId === null ? null : Number(workflowPresetId);
    }

    const section = await prisma.articleSection.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true, name: true, slug: true, description: true,
        color: true, active: true, workflowPresetId: true,
        workflowPreset: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ section });
  } catch (err) {
    console.error("[admin/sections PATCH]", err);
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Accept id from query param (primary) or request body (fallback)
    const url = new URL(req.url);
    const paramId = url.searchParams.get("id");
    const id = paramId ? Number(paramId) : (await req.json().catch(() => ({}))).id;
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    // Soft-delete to preserve foreign key references from existing articles
    await prisma.articleSection.update({
      where: { id: Number(id) },
      data: { active: false },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/sections DELETE]", err);
    return NextResponse.json({ error: "Failed to deactivate section" }, { status: 500 });
  }
}