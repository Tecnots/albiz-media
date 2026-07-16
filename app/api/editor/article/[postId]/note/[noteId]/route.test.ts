import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  editorNoteFindUnique,
  editorNoteUpdate,
  postFindUnique,
  hasSectionAssignmentMock,
  getAuthUserMock,
  editorPreferencesFindUnique,
  notificationUpsert,
} = vi.hoisted(() => ({
  editorNoteFindUnique: vi.fn(),
  editorNoteUpdate: vi.fn(),
  postFindUnique: vi.fn(),
  hasSectionAssignmentMock: vi.fn(),
  getAuthUserMock: vi.fn(),
  editorPreferencesFindUnique: vi.fn(),
  notificationUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    editorNote: { findUnique: editorNoteFindUnique, update: editorNoteUpdate },
    post: { findUnique: postFindUnique },
    editorPreferences: { findUnique: editorPreferencesFindUnique },
    notification: { upsert: notificationUpsert },
  },
}));
vi.mock("@/app/lib/auth", () => ({ getAuthUser: getAuthUserMock, unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }) }));
vi.mock("@/app/lib/auth-guards", () => ({ hasSectionAssignment: hasSectionAssignmentMock }));

import { PATCH } from "@/app/api/editor/article/[postId]/note/[noteId]/route";

function req(body: unknown) {
  return new NextRequest("https://albizmedia.com/api/editor/article/1/note/1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function params() {
  return { params: Promise.resolve({ postId: "1", noteId: "1" }) };
}

// Regression coverage for audit finding C-8: the note resolve/unresolve
// endpoint previously accepted any EDITOR/ADMIN regardless of whether they
// were assigned to the article or its section — any editor could tamper
// with review notes on any article system-wide.

describe("PATCH /api/editor/article/[postId]/note/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorNoteFindUnique.mockResolvedValue({ id: 1, postId: 1, editorId: 99 });
    postFindUnique.mockResolvedValue({ userId: 5, title: "An article", assignedEditorId: 7, sectionId: 3 });
    editorNoteUpdate.mockResolvedValue({ id: 1, resolvedAt: new Date(), resolvedBy: 1 });
    editorPreferencesFindUnique.mockResolvedValue(null);
    notificationUpsert.mockResolvedValue({});
    hasSectionAssignmentMock.mockResolvedValue(false);
  });

  it("rejects an EDITOR who is neither the assigned editor nor section-assigned", async () => {
    getAuthUserMock.mockResolvedValue({ id: 42, role: "EDITOR" });
    hasSectionAssignmentMock.mockResolvedValue(false);
    const res = await PATCH(req({ resolved: true }), params());
    expect(res.status).toBe(403);
    expect(editorNoteUpdate).not.toHaveBeenCalled();
  });

  it("allows the specifically assigned editor (assignedEditorId match)", async () => {
    getAuthUserMock.mockResolvedValue({ id: 7, role: "EDITOR" });
    const res = await PATCH(req({ resolved: true }), params());
    expect(res.status).toBe(200);
    expect(editorNoteUpdate).toHaveBeenCalled();
  });

  it("allows a different editor who is section-assigned, even without being the specific assignedEditorId", async () => {
    getAuthUserMock.mockResolvedValue({ id: 55, role: "EDITOR" });
    hasSectionAssignmentMock.mockResolvedValue(true);
    const res = await PATCH(req({ resolved: true }), params());
    expect(res.status).toBe(200);
  });

  it("allows the post's own author to resolve", async () => {
    getAuthUserMock.mockResolvedValue({ id: 5, role: "AUTHOR" });
    const res = await PATCH(req({ resolved: true }), params());
    expect(res.status).toBe(200);
  });

  it("rejects an unrelated AUTHOR (not the post's author, not an editor)", async () => {
    getAuthUserMock.mockResolvedValue({ id: 999, role: "AUTHOR" });
    const res = await PATCH(req({ resolved: true }), params());
    expect(res.status).toBe(403);
  });

  it("allows ADMIN unconditionally", async () => {
    getAuthUserMock.mockResolvedValue({ id: 1, role: "ADMIN" });
    const res = await PATCH(req({ resolved: true }), params());
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated callers", async () => {
    getAuthUserMock.mockResolvedValue(null);
    const res = await PATCH(req({ resolved: true }), params());
    expect(res.status).toBe(401);
  });
});
