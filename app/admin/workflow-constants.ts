import type { PostStatus } from "@/lib/editor-workflow";

// Keyed by PostStatus (not a bare array) so this file fails to typecheck if
// lib/editor-workflow.ts's PostStatus union ever gains a value this doesn't
// know about — this was previously a hand-maintained array that silently
// drifted from the real state machine (missing "scheduled" entirely, and
// two of five independently-maintained status vocabularies in the codebase
// disagreed with each other — audit finding M-2). This doesn't make every
// vocabulary share one array, but it does make the compiler catch drift here.
const STAGE_CONFIG: Record<PostStatus, { label: string; color: string; locked: boolean }> = {
  draft:              { label: "Draft",              color: "#525252", locked: true },
  submitted:          { label: "Submitted",          color: "#3B82F6", locked: false },
  under_review:       { label: "Under Review",       color: "#F59E0B", locked: false },
  revision_requested: { label: "Revision Requested", color: "#F44444", locked: false },
  approved:           { label: "Approved",           color: "#84CC16", locked: false },
  scheduled:          { label: "Scheduled",          color: "#8B5CF6", locked: false },
  published:          { label: "Published",          color: "#22C55E", locked: true },
  rejected:           { label: "Rejected",           color: "#DC2626", locked: true },
  archived:           { label: "Archived",           color: "#737373", locked: true },
};

const STAGE_ORDER: PostStatus[] = [
  "draft", "submitted", "under_review", "revision_requested",
  "approved", "scheduled", "published", "rejected", "archived",
];

export const ALL_STAGES = STAGE_ORDER.map((key) => ({ key, ...STAGE_CONFIG[key] }));

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "ar", label: "Arabic" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
];
