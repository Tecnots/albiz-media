import { describe, it, expect, vi, beforeEach } from "vitest";

const { editorSectionAssignmentFindUnique } = vi.hoisted(() => ({
  editorSectionAssignmentFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { editorSectionAssignment: { findUnique: editorSectionAssignmentFindUnique } },
}));

vi.mock("./auth", () => ({ getAuthUser: vi.fn() }));

import { isAssignedEditor, isOwnerOrAdmin, hasSectionAssignment, hasSectionPublishRight } from "./auth-guards";

// Regression coverage for audit findings C-8 / H-1 / M-1: these are the
// primitives every per-article/per-section authorization check now shares,
// replacing ad-hoc role-only checks that let any EDITOR act on articles or
// sections they weren't actually assigned to.

describe("isAssignedEditor", () => {
  it("ADMIN is always considered assigned, regardless of assignedEditorId", () => {
    expect(isAssignedEditor({ id: 5, role: "ADMIN" }, { assignedEditorId: 999 })).toBe(true);
    expect(isAssignedEditor({ id: 5, role: "ADMIN" }, { assignedEditorId: null })).toBe(true);
  });

  it("EDITOR matches only when assignedEditorId equals their own id", () => {
    expect(isAssignedEditor({ id: 5, role: "EDITOR" }, { assignedEditorId: 5 })).toBe(true);
    expect(isAssignedEditor({ id: 5, role: "EDITOR" }, { assignedEditorId: 6 })).toBe(false);
  });

  it("EDITOR with no assignment at all (null) is never considered assigned", () => {
    expect(isAssignedEditor({ id: 5, role: "EDITOR" }, { assignedEditorId: null })).toBe(false);
  });

  it("every other role is never considered assigned", () => {
    expect(isAssignedEditor({ id: 5, role: "AUTHOR" }, { assignedEditorId: 5 })).toBe(false);
    expect(isAssignedEditor({ id: 5, role: "CIRCLE" }, { assignedEditorId: 5 })).toBe(false);
  });
});

describe("isOwnerOrAdmin", () => {
  it("owner matches their own resource", () => {
    expect(isOwnerOrAdmin({ id: 5, role: "AUTHOR" }, 5)).toBe(true);
  });

  it("non-owner, non-admin is rejected", () => {
    expect(isOwnerOrAdmin({ id: 5, role: "AUTHOR" }, 6)).toBe(false);
  });

  it("ADMIN matches any resource", () => {
    expect(isOwnerOrAdmin({ id: 5, role: "ADMIN" }, 999)).toBe(true);
  });
});

describe("hasSectionAssignment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when sectionId is null/undefined without querying the DB", async () => {
    expect(await hasSectionAssignment(1, null)).toBe(false);
    expect(await hasSectionAssignment(1, undefined)).toBe(false);
    expect(editorSectionAssignmentFindUnique).not.toHaveBeenCalled();
  });

  it("returns true when an assignment row exists", async () => {
    editorSectionAssignmentFindUnique.mockResolvedValue({ editorId: 1, sectionId: 2, canPublish: false });
    expect(await hasSectionAssignment(1, 2)).toBe(true);
    expect(editorSectionAssignmentFindUnique).toHaveBeenCalledWith({
      where: { editorId_sectionId: { editorId: 1, sectionId: 2 } },
    });
  });

  it("returns false when no assignment row exists", async () => {
    editorSectionAssignmentFindUnique.mockResolvedValue(null);
    expect(await hasSectionAssignment(1, 2)).toBe(false);
  });
});

describe("hasSectionPublishRight", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when the assignment exists but canPublish is false", async () => {
    editorSectionAssignmentFindUnique.mockResolvedValue({ editorId: 1, sectionId: 2, canPublish: false });
    expect(await hasSectionPublishRight(1, 2)).toBe(false);
  });

  it("returns true only when canPublish is explicitly true", async () => {
    editorSectionAssignmentFindUnique.mockResolvedValue({ editorId: 1, sectionId: 2, canPublish: true });
    expect(await hasSectionPublishRight(1, 2)).toBe(true);
  });

  it("returns false with no assignment row at all", async () => {
    editorSectionAssignmentFindUnique.mockResolvedValue(null);
    expect(await hasSectionPublishRight(1, 2)).toBe(false);
  });
});
