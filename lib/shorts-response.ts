import { blobStorageService } from "@/lib/blob-storage";

export interface ShortCreatorRow {
  id: number;
  name: string;
  handle?: string | null;
  avatar: string | null;
  verified?: boolean | null;
  countryCode?: string | null;
}

// Shared response shape for a Short across feed/saved/single-short endpoints —
// resolves videoUrl/thumbnailUrl through blobStorageService (they're stored as
// bare blob names) so every route returns directly-playable/-displayable URLs.
export function buildShortSummary(
  short: any,
  creator: ShortCreatorRow | null,
  status: { liked?: boolean; saved?: boolean } = {},
) {
  return {
    id: short.id,
    title: short.title,
    thumbnailUrl: blobStorageService.resolveMediaUrl(short.thumbnailUrl ?? null),
    videoUrl: blobStorageService.resolveMediaUrl(short.videoUrl ?? null),
    views: Number(short.views ?? 0),
    likes: Number(short.likes ?? 0),
    shares: Number(short.shares ?? 0),
    comments: Number(short.comments ?? 0),
    publishedAt: short.publishedAt ?? short.createdAt ?? null,
    liked: Boolean(status.liked),
    saved: Boolean(status.saved),
    user: creator
      ? {
          id: creator.id,
          name: creator.name,
          handle: creator.handle ?? null,
          avatar: blobStorageService.resolveMediaUrl(creator.avatar ?? null),
          verified: Boolean(creator.verified),
          country: (creator.countryCode ?? "").toLowerCase(),
        }
      : null,
  };
}
