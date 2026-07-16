import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { postFindUnique, editorSectionAssignmentFindUnique, getAuthUserMock } = vi.hoisted(() => ({
  postFindUnique: vi.fn(),
  editorSectionAssignmentFindUnique: vi.fn(),
  getAuthUserMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: postFindUnique },
    editorSectionAssignment: { findUnique: editorSectionAssignmentFindUnique },
  },
}));
vi.mock("@/app/lib/auth", () => ({ getAuthUser: getAuthUserMock, unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }) }));

import { GET } from "@/app/api/editor/article/[postId]/route";

function req() {
  return new NextRequest("https://albizmedia.com/api/editor/article/1", { method: "GET" });
}
function params() {
  return { params: Promise.resolve({ postId: "1" }) };
}

const notesPayload = [{ id: 1, note: "internal note", type: "general", priority: "minor", resolvedAt: null, resolvedBy: null, createdAt: new Date(), editor: { id: 7, name: "Editor", avatar: null } }];
// NextResponse.json() round-trips through JSON, so Date objects become ISO
// strings by the time the test reads the response body back out.
const notesPayloadSerialized = JSON.parse(JSON.stringify(notesPayload));

const basePost = {
  id: 1,
  title: "An article",
  sectionId: 3,
  assignedEditorId: 7,
  editorNotes: notesPayload,
};

// Regression coverage for audit findings H-1 (editorNotes leaked to any
// section-mate editor, not just the assigned one) and L-2 (sectionless
// articles skipped the assignment check entirely).

describe("GET /api/editor/article/[postId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postFindUnique.mockResolvedValue({ ...basePost });
  });

  it("rejects a non-editor/admin role", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "AUTHOR" });
    const res = await GET(req(), params());
    expect(res.status).toBe(403);
  });

  it("rejects a section-mate editor with no EditorSectionAssignment row for this section", async () => {
    getAuthUserMock.mockResolvedValue({ id: 55, role: "EDITOR" });
    editorSectionAssignmentFindUnique.mockResolvedValue(null);
    const res = await GET(req(), params());
    expect(res.status).toBe(403);
  });

  it("strips editorNotes for a section-mate editor who is NOT the assigned editor", async () => {
    getAuthUserMock.mockResolvedValue({ id: 55, role: "EDITOR" });
    editorSectionAssignmentFindUnique.mockResolvedValue({ canPublish: false });
    const res = await GET(req(), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.article.editorNotes).toEqual([]);
  });

  it("includes editorNotes for the specifically assigned editor", async () => {
    getAuthUserMock.mockResolvedValue({ id: 7, role: "EDITOR" });
    editorSectionAssignmentFindUnique.mockResolvedValue({ canPublish: false });
    const res = await GET(req(), params());
    const body = await res.json();
    expect(body.article.editorNotes).toEqual(notesPayloadSerialized);
  });

  it("includes editorNotes for ADMIN unconditionally", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    const res = await GET(req(), params());
    const body = await res.json();
    expect(body.article.editorNotes).toEqual(notesPayloadSerialized);
    expect(body.article.canPublish).toBe(true);
  });

  it("requires the caller to be the specifically assigned editor when the article has no section (L-2)", async () => {
    postFindUnique.mockResolvedValue({ ...basePost, sectionId: null, assignedEditorId: 7 });
    getAuthUserMock.mockResolvedValue({ id: 55, role: "EDITOR" });
    const res = await GET(req(), params());
    expect(res.status).toBe(403);
    expect(editorSectionAssignmentFindUnique).not.toHaveBeenCalled();
  });

  it("allows the assigned editor to view a sectionless article", async () => {
    postFindUnique.mockResolvedValue({ ...basePost, sectionId: null, assignedEditorId: 7 });
    getAuthUserMock.mockResolvedValue({ id: 7, role: "EDITOR" });
    const res = await GET(req(), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.article.editorNotes).toEqual(notesPayloadSerialized);
  });
});
