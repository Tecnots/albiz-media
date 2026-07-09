import { describe, it, expect, vi, beforeEach } from "vitest";

const { executeRawMock, editorActivityCreateMock } = vi.hoisted(() => ({
  executeRawMock: vi.fn(),
  editorActivityCreateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: executeRawMock,
    editorActivity: { create: editorActivityCreateMock },
  },
}));

import { transitionPostState, WORKFLOW_TRANSITIONS } from "./editor-workflow";

// Regression coverage for audit findings C-1 (Circle/Uploader self-publish
// gap), C-7 (rejected/archived now validated states, single chokepoint for
// every status write), and H-5 (optimistic locking on the write itself).

describe("WORKFLOW_TRANSITIONS", () => {
  it("includes rejected and archived as real, validated states", () => {
    expect(WORKFLOW_TRANSITIONS.rejected).toBeDefined();
    expect(WORKFLOW_TRANSITIONS.archived).toBeDefined();
  });

  it("archive is reachable from every active state", () => {
    for (const state of ["draft", "submitted", "under_review", "revision_requested", "approved", "scheduled", "published"] as const) {
      expect(WORKFLOW_TRANSITIONS[state]).toContain("archived");
    }
  });

  it("rejected and archived only restore to draft — they are otherwise terminal", () => {
    expect(WORKFLOW_TRANSITIONS.rejected).toEqual(["draft"]);
    expect(WORKFLOW_TRANSITIONS.archived).toEqual(["draft"]);
  });
});

describe("transitionPostState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeRawMock.mockResolvedValue(1); // 1 row affected = success by default
  });

  it("is a no-op when currentStatus === newStatus", async () => {
    await transitionPostState(1, 1, "ADMIN", "published", "published", null, true, true, "noop");
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it("rejects a transition not present in WORKFLOW_TRANSITIONS", async () => {
    await expect(
      transitionPostState(1, 1, "ADMIN", "draft", "approved", null, true, true, "bad")
    ).rejects.toThrow(/Invalid state transition/);
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it("rejects a non-editor/admin trying to move a post into a moderation state", async () => {
    await expect(
      transitionPostState(1, 1, "AUTHOR", "submitted", "under_review", null, false, true, "start_review")
    ).rejects.toThrow(/Only editors or admins/);
  });

  it("rejects an editor who is not the assigned reviewer", async () => {
    await expect(
      transitionPostState(1, 1, "EDITOR", "submitted", "under_review", 999, false, false, "start_review")
    ).rejects.toThrow(/not assigned/);
  });

  it("allows the assigned editor to move a post into review", async () => {
    await transitionPostState(1, 1, "EDITOR", "submitted", "under_review", 1, false, false, "start_review");
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(editorActivityCreateMock).toHaveBeenCalledTimes(1);
  });

  it("allows ADMIN to act on a post assigned to a different editor", async () => {
    await transitionPostState(1, 1, "ADMIN", "submitted", "under_review", 999, false, false, "start_review");
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  // ── C-1: the actual bug — CIRCLE/UPLOADER previously had no publish gate ──
  it("CIRCLE publishing a type=POST (feed post) is allowed — the intended unmoderated path", async () => {
    await transitionPostState(1, 1, "CIRCLE", "draft", "published", null, false, false, "create", "POST");
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  it("CIRCLE publishing a type=ARTICLE without canPost is now rejected (was previously an unrestricted bypass)", async () => {
    await expect(
      transitionPostState(1, 1, "CIRCLE", "draft", "published", null, false, false, "create", "ARTICLE")
    ).rejects.toThrow(/permission to publish/);
  });

  it("CIRCLE publishing a type=ARTICLE WITH canPost succeeds, same gate AUTHOR has", async () => {
    await transitionPostState(1, 1, "CIRCLE", "draft", "published", null, false, true, "create", "ARTICLE");
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  it("UPLOADER publishing an ARTICLE without canPost is rejected (was previously an unrestricted bypass)", async () => {
    await expect(
      transitionPostState(1, 1, "UPLOADER", "draft", "published", null, false, false, "create", "ARTICLE")
    ).rejects.toThrow(/permission to publish/);
  });

  it("EDITOR without canPublish cannot publish", async () => {
    await expect(
      transitionPostState(1, 1, "EDITOR", "approved", "published", 1, false, false, "publish", "ARTICLE")
    ).rejects.toThrow(/publish permission/);
  });

  it("EDITOR with canPublish can publish", async () => {
    await transitionPostState(1, 1, "EDITOR", "approved", "published", 1, true, false, "publish", "ARTICLE");
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  it("ADMIN can always publish regardless of postType or canPost/canPublish", async () => {
    await transitionPostState(1, 1, "ADMIN", "approved", "published", null, false, false, "publish", "ARTICLE");
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  // ── H-5: optimistic locking ────────────────────────────────────────────────
  it("surfaces a CONFLICT error when the guarded UPDATE affects zero rows (concurrent change)", async () => {
    executeRawMock.mockResolvedValue(0);
    await expect(
      transitionPostState(1, 1, "ADMIN", "draft", "submitted", null, true, true, "submit")
    ).rejects.toThrow(/CONFLICT/);
  });

  // ── EditorActivity audit trail ─────────────────────────────────────────────
  it("logs EditorActivity for EDITOR/ADMIN actions but not for AUTHOR/CIRCLE actions", async () => {
    await transitionPostState(1, 1, "EDITOR", "submitted", "under_review", 1, false, false, "start_review");
    expect(editorActivityCreateMock).toHaveBeenCalledTimes(1);

    editorActivityCreateMock.mockClear();
    await transitionPostState(1, 1, "CIRCLE", "draft", "published", null, false, false, "create", "POST");
    expect(editorActivityCreateMock).not.toHaveBeenCalled();
  });
});
