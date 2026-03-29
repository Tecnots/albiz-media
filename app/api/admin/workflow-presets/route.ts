import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_STAGES = ["draft", "submitted", "under_review", "revision_requested", "approved", "published"];

export async function GET() {
  try {
    const presets = await prisma.workflowPreset.findMany({
      orderBy: { createdAt: "asc" },
      include: { sections: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json({ presets });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error", presets: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, description, stages } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const preset = await prisma.workflowPreset.create({
      data: { name: name.trim(), description: description?.trim() || null, stages: stages ?? DEFAULT_STAGES },
    });
    return NextResponse.json({ preset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, name, description, stages } = await request.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (stages !== undefined) data.stages = stages;
    const preset = await prisma.workflowPreset.update({ where: { id }, data });
    return NextResponse.json({ preset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    // Unlink sections before deleting
    await prisma.articleSection.updateMany({ where: { workflowPresetId: id }, data: { workflowPresetId: null } });
    await prisma.workflowPreset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
