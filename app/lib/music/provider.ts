import { prisma } from "@/lib/prisma";
import { blobStorageService } from "@/lib/blob-storage";

// Provider abstraction for the Story music sticker's library — the editor
// and /api/music/search never talk to a catalog directly, only through this
// interface, so a paid catalog (Epidemic Sound, Soundstripe, etc.) can be
// dropped in later as a second implementation without touching either.
export interface Track {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  audioUrl: string;
  artworkUrl: string | null;
  category: string;
}

export interface MusicProvider {
  search(query: string, category?: string): Promise<{ tracks: Track[] }>;
  categories(): Promise<string[]>;
}

// Default provider: a curated, self-hosted library. Tracks are added via
// /admin/music, with audio files going through the existing /api/upload
// pipeline like any other media — this class only ever reads MusicTrack.
class LocalLibraryProvider implements MusicProvider {
  async search(query: string, category?: string): Promise<{ tracks: Track[] }> {
    const q = query.trim();
    const tracks = await prisma.musicTrack.findMany({
      where: {
        active: true,
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { artist: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return {
      tracks: tracks.map((t) => ({
        id: String(t.id),
        title: t.title,
        artist: t.artist,
        durationMs: t.durationMs,
        audioUrl: blobStorageService.resolveMediaUrl(t.audioUrl) ?? t.audioUrl,
        artworkUrl: t.artworkUrl ? blobStorageService.resolveMediaUrl(t.artworkUrl) : null,
        category: t.category,
      })),
    };
  }

  async categories(): Promise<string[]> {
    const rows = await prisma.musicTrack.findMany({
      where: { active: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return rows.map((r) => r.category);
  }
}

export const musicProvider: MusicProvider = new LocalLibraryProvider();
