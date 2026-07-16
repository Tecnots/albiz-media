// Shared Story "sticker" element contract — used by the Create Story editor,
// the Story viewer, and the story-creation API route. Keeping normalization
// and validation here (rather than duplicated in each) is what guarantees the
// editor's draft-reload and the viewer's render never drift apart.

export type StickerType = "poll" | "question" | "mention" | "hashtag" | "link" | "music" | "time";

export interface PollData { question: string; options: string[] }
export interface QuestionData { prompt: string }
export interface MentionData { userId: number; handle: string; name: string; avatar: string | null }
export interface HashtagData { tag: string }
export interface LinkData { url: string }
export interface MusicData {
  title: string;
  artist: string;
  source?: "library" | "upload";
  trackId?: string;
  audioUrl?: string;
  artworkUrl?: string | null;
  durationMs?: number;
  trimStart?: number;
  trimEnd?: number;
}

export type StickerData = Partial<
  PollData & QuestionData & MentionData & HashtagData & LinkData & MusicData
>;

export interface StickerElement {
  id: string;
  type: StickerType;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  data: StickerData;
}

const num = (v: unknown, fallback: number) => (typeof v === "number" && isFinite(v) ? v : fallback);

/**
 * Accepts either the current array-of-elements shape, the legacy
 * `{ [type]: {x,y,scale} }` map (no content, at most one instance per type),
 * or null/undefined — and always returns a normalized element array. Legacy
 * elements get `data: {}`, which is what makes every per-type renderer fall
 * back to its placeholder content automatically, with no explicit shape
 * branching needed anywhere else in the app.
 */
export function normalizeStoryStickers(raw: unknown): StickerElement[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((el) => el && typeof el === "object")
      .map((el: any, i) => ({
        id: typeof el.id === "string" && el.id ? el.id : String(el.type ?? i),
        type: el.type ?? el.id,
        x: num(el.x, 50),
        y: num(el.y, 50),
        scale: num(el.scale, 1),
        rotation: num(el.rotation, 0),
        opacity: num(el.opacity, 1),
        zIndex: num(el.zIndex, 20),
        data: el.data && typeof el.data === "object" ? el.data : {},
      }));
  }

  // Legacy shape: { [type]: { x, y, scale } } — position/scale only, no content.
  return Object.entries(raw as Record<string, any>).map(([type, pos]) => ({
    id: type,
    type: type as StickerType,
    x: num(pos?.x, 50),
    y: num(pos?.y, 50),
    scale: num(pos?.scale, 1),
    rotation: 0,
    opacity: 1,
    zIndex: 20,
    data: {},
  }));
}

const HASHTAG_RE = /^[a-zA-Z0-9_]{1,50}$/;

/** Server-side validation for a single element on story creation. Returns an error message, or null if valid. */
export function validateStickerElement(el: StickerElement): string | null {
  switch (el.type) {
    case "poll": {
      const options = el.data.options;
      if (!el.data.question || String(el.data.question).trim().length === 0) return "Poll is missing a question";
      if (!Array.isArray(options) || options.length < 2 || options.length > 4) return "Poll must have 2-4 options";
      if (options.some((o) => typeof o !== "string" || o.trim().length === 0)) return "Poll options can't be empty";
      return null;
    }
    case "question":
      if (!el.data.prompt || String(el.data.prompt).trim().length === 0) return "Question sticker is missing a prompt";
      return null;
    case "hashtag":
      if (!el.data.tag || !HASHTAG_RE.test(String(el.data.tag))) return "Invalid hashtag";
      return null;
    case "link":
      try {
        const u = new URL(String(el.data.url));
        if (u.protocol !== "http:" && u.protocol !== "https:") return "Link must be http(s)";
      } catch {
        return "Invalid link URL";
      }
      return null;
    case "mention":
      if (typeof el.data.userId !== "number" || !el.data.handle) return "Mention is missing a target user";
      return null;
    case "music":
      if (!el.data.title || String(el.data.title).trim().length === 0) return "Music sticker is missing a title";
      if (el.data.audioUrl) {
        const duration = el.data.durationMs ?? 0;
        const start = el.data.trimStart ?? 0;
        const end = el.data.trimEnd ?? duration;
        if (start < 0 || end <= start || (duration > 0 && end > duration)) return "Invalid music trim range";
      }
      return null;
    case "time":
      return null;
    default:
      return `Unknown sticker type: ${(el as any).type}`;
  }
}
