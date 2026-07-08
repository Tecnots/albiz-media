"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search, X, Play, Pause, Upload, Loader2, Music as MusicIcon } from "lucide-react";
import { api } from "@/app/lib/api";
import type { MusicData } from "@/app/lib/storySticker";

interface Track {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  audioUrl: string;
  artworkUrl: string | null;
  category: string;
}

function formatDuration(ms: number) {
  const secs = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

// Same debounced-popover shape as HashtagPicker/MentionPicker: browse or
// search the curated library (provider abstraction: app/lib/music/provider.ts,
// reached via /api/music/search), or upload your own audio through the
// app's existing upload pipeline. Selecting either path moves into a small
// trim step before the final MusicData is handed back to the Story editor.
export function MusicPicker({
  onSelect,
  onClose,
}: {
  onSelect: (data: MusicData) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Track | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    api.getMusicCategories().then((res) => setCategories(res.categories ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api.searchMusic(query.trim(), activeCategory ?? undefined)
        .then((res) => setTracks(res.tracks ?? []))
        .catch(() => setTracks([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, activeCategory]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const togglePreview = (track: Track) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new window.Audio(track.audioUrl);
    audio.play().catch(() => {});
    audio.addEventListener("ended", () => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  const chooseTrack = (track: Track) => {
    audioRef.current?.pause();
    setPlayingId(null);
    setSelected(track);
    setTrimStart(0);
    setTrimEnd(Math.min(15, track.durationMs / 1000));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "music");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) return;
      const { url } = await res.json();
      const durationMs = await new Promise<number>((resolve) => {
        const probe = new window.Audio(url);
        probe.addEventListener("loadedmetadata", () => resolve(probe.duration * 1000));
        probe.addEventListener("error", () => resolve(0));
      });
      chooseTrack({
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "",
        durationMs,
        audioUrl: url,
        artworkUrl: null,
        category: "upload",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (selected) {
    const isUpload = selected.category === "upload";
    return (
      <div
        className="absolute z-40 top-full mt-1 left-0 w-72 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[#efefef] overflow-hidden p-3"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-[#efefef] bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
            {selected.artworkUrl ? (
              <Image src={selected.artworkUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
            ) : (
              <MusicIcon className="w-4 h-4 text-[#a3a3a3]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#0a0a0a] truncate">{selected.title}</p>
            {selected.artist && <p className="text-[11px] text-[#a3a3a3] truncate">{selected.artist}</p>}
          </div>
          <button type="button" onClick={() => togglePreview(selected)} className="w-7 h-7 rounded-full bg-[#f5f5f5] hover:bg-[#ebebeb] flex items-center justify-center flex-shrink-0">
            {playingId === selected.id ? <Pause className="w-3 h-3 text-[#0a0a0a]" /> : <Play className="w-3 h-3 text-[#0a0a0a]" />}
          </button>
        </div>

        {selected.durationMs > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-[#a3a3a3] font-medium mb-1.5">Trim ({formatDuration((trimEnd - trimStart) * 1000)})</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={trimEnd - 1}
                value={Math.round(trimStart)}
                onChange={(e) => setTrimStart(Math.max(0, Math.min(Number(e.target.value), trimEnd - 1)))}
                className="w-14 px-2 py-1 rounded-lg bg-[#f8f9fa] text-[12px] text-center outline-none"
              />
              <span className="text-[11px] text-[#a3a3a3]">to</span>
              <input
                type="number"
                min={trimStart + 1}
                max={Math.round(selected.durationMs / 1000)}
                value={Math.round(trimEnd)}
                onChange={(e) => setTrimEnd(Math.max(trimStart + 1, Math.min(Number(e.target.value), selected.durationMs / 1000)))}
                className="w-14 px-2 py-1 rounded-lg bg-[#f8f9fa] text-[12px] text-center outline-none"
              />
              <span className="text-[11px] text-[#a3a3a3]">sec</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSelected(null)} className="flex-1 py-2 rounded-xl bg-[#f5f5f5] text-[#525252] text-xs font-medium">Back</button>
          <button
            type="button"
            onClick={() => {
              audioRef.current?.pause();
              onSelect({
                title: selected.title,
                artist: selected.artist,
                source: isUpload ? "upload" : "library",
                trackId: isUpload ? undefined : selected.id,
                audioUrl: selected.audioUrl,
                artworkUrl: selected.artworkUrl,
                durationMs: selected.durationMs,
                trimStart,
                trimEnd,
              });
            }}
            className="flex-1 py-2 rounded-xl bg-[#F44444] text-white text-xs font-medium"
          >
            Use this
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute z-40 top-full mt-1 left-0 w-72 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[#efefef] overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f5f5f5]">
        <Search className="w-3.5 h-3.5 text-[#b0b0b0] flex-shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search music..."
          className="flex-1 text-[13px] text-[#0a0a0a] placeholder:text-[#b0b0b0] outline-none min-w-0"
        />
        <button type="button" onClick={onClose} className="flex-shrink-0 text-[#b0b0b0] hover:text-[#737373]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-[#f5f5f5]">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium ${!activeCategory ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#737373]"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${activeCategory === c ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#737373]"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f5f5f5] hover:bg-[#fafafa] cursor-pointer transition-colors">
        {uploading ? <Loader2 className="w-3.5 h-3.5 text-[#F44444] animate-spin flex-shrink-0" /> : <Upload className="w-3.5 h-3.5 text-[#F44444] flex-shrink-0" />}
        <span className="text-[13px] text-[#F44444] font-medium">Upload your own audio</span>
        <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>

      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-5">
            <div className="w-4 h-4 border-2 border-[#efefef] border-t-[#F44444] rounded-full animate-spin" />
          </div>
        ) : tracks.length === 0 ? (
          <p className="text-center py-5 text-[12px] text-[#b0b0b0]">No tracks found</p>
        ) : (
          tracks.map((t) => (
            <div key={t.id} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#fafafa] transition-colors">
              <button type="button" onClick={() => togglePreview(t)} className="w-7 h-7 rounded-full bg-[#f5f5f5] hover:bg-[#ebebeb] flex items-center justify-center flex-shrink-0">
                {playingId === t.id ? <Pause className="w-3 h-3 text-[#0a0a0a]" /> : <Play className="w-3 h-3 text-[#0a0a0a]" />}
              </button>
              <button type="button" onClick={() => chooseTrack(t)} className="flex-1 min-w-0 text-left">
                <span className="text-[12px] font-medium text-[#0a0a0a] truncate block">{t.title}</span>
                <span className="text-[11px] text-[#a3a3a3] truncate block">{t.artist} · {formatDuration(t.durationMs)}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
