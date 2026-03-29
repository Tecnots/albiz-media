import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// GET — list all sections
export async function GET() {
  try {
    const sections = await prisma.articleSection.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ sections });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error", sections: [] }, { status: 500 });
  }
}

// POST — create section
export async function POST(request: Request) {
  try {
    const { name, slug, description, color, active } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const finalSlug = (slug?.trim() || toSlug(name)).toLowerCase();

    const existing = await prisma.articleSection.findUnique({ where: { slug: finalSlug } });
    if (existing) return NextResponse.json({ error: "A section with this slug already exists" }, { status: 409 });

    const section = await prisma.articleSection.create({
      data: { name: name.trim(), slug: finalSlug, description: description?.trim() || null, color: color || "#525252", active: active ?? true },
    });
    return NextResponse.json({ section });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// PATCH — update section
export async function PATCH(request: Request) {
  try {
    const { id, name, slug, description, color, active } = await request.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (slug !== undefined) data.slug = slug.trim().toLowerCase();
    if (description !== undefined) data.description = description?.trim() || null;
    if (color !== undefined) data.color = color;
    if (active !== undefined) data.active = active;

    const section = await prisma.articleSection.update({ where: { id }, data });
    return NextResponse.json({ section });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// DELETE — remove section (clears FK on posts first)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await prisma.$executeRaw`UPDATE "Post" SET "sectionId" = NULL WHERE "sectionId" = ${id}`;
    await prisma.articleSection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
