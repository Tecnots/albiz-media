import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const presets = await prisma.workflowPreset.findMany({
      include: {
        sections: { select: { id: true, name: true, color: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ presets });
  } catch (err) {
    console.error("[workflow-presets GET]", err);
    return NextResponse.json({ error: "Failed to load presets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { name, description, stages } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ error: "At least one stage is required" }, { status: 400 });
    }

    const preset = await prisma.workflowPreset.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        stages,
      },
      include: {
        sections: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json({ preset });
  } catch (err) {
    console.error("[workflow-presets POST]", err);
    return NextResponse.json({ error: "Failed to create preset" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id, name, description, stages } = await request.json();
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (stages !== undefined) data.stages = stages;

    const preset = await prisma.workflowPreset.update({
      where: { id: Number(id) },
      data,
      include: {
        sections: { select: { id: true, name: true, color: true } },
      },
    });
    return NextResponse.json({ preset });
  } catch (err) {
    console.error("[workflow-presets PATCH]", err);
    return NextResponse.json({ error: "Failed to update preset" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    // Clear preset from any sections that reference it before deleting
    await prisma.articleSection.updateMany({
      where: { workflowPresetId: id },
      data: { workflowPresetId: null },
    });

    await prisma.workflowPreset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[workflow-presets DELETE]", err);
    return NextResponse.json({ error: "Failed to delete preset" }, { status: 500 });
  }
}