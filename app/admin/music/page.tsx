"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Music, Upload, Loader2, Play, Pause } from "lucide-react";

interface Track {
  id: number;
  title: string;
  artist: string;
  category: string;
  durationMs: number;
  audioUrl: string;
  artworkUrl: string | null;
  active: boolean;
}

function formatDuration(ms: number) {
  const secs = Math.round(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

// Curated self-hosted music library backing the Story music sticker's
// default provider (app/lib/music/provider.ts). Audio files go through the
// existing /api/upload pipeline (category: "music") exactly like any other
// media upload — this page just captures the resulting metadata.
export default function AdminMusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", artist: "", category: "" });
  const [audioFile, setAudioFile] = useState<{ url: string; durationMs: number } | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingArt, setUploadingArt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/music")
      .then((r) => r.json())
      .then((data) => setTracks(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "music");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) { setError("Audio upload failed"); return; }
      const { url } = await res.json();
      const durationMs = await new Promise<number>((resolve) => {
        const probe = new window.Audio(url);
        probe.addEventListener("loadedmetadata", () => resolve(probe.duration * 1000));
        probe.addEventListener("error", () => resolve(0));
      });
      setAudioFile({ url, durationMs });
    } finally {
      setUploadingAudio(false);
      e.target.value = "";
    }
  };

  const handleArtworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingArt(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", "music");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) { const { url } = await res.json(); setArtworkUrl(url); }
    } finally {
      setUploadingArt(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.artist.trim() || !form.category.trim() || !audioFile) {
      setError("Title, artist, category, and an audio file are all required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          artist: form.artist.trim(),
          category: form.category.trim().toLowerCase(),
          durationMs: Math.round(audioFile.durationMs),
          audioUrl: audioFile.url,
          artworkUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Failed to save track");
        return;
      }
      setForm({ title: "", artist: "", category: "" });
      setAudioFile(null);
      setArtworkUrl(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (track: Track) => {
    await fetch("/api/admin/music", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: track.id, active: !track.active }),
    });
    setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, active: !t.active } : t)));
  };

  const togglePlay = (track: Track) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new window.Audio(track.audioUrl);
    audio.play().catch(() => {});
    audio.addEventListener("ended", () => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Music className="w-5 h-5 text-[#F44444]" />
        <h1 className="text-lg font-semibold text-[#0a0a0a]">Music Library</h1>
      </div>

      {/* Add track */}
      <div className="bg-white border border-[#efefef] rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="px-3 py-2.5 rounded-xl bg-[#f8f9fa] text-sm outline-none placeholder:text-[#a3a3a3]"
          />
          <input
            value={form.artist}
            onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))}
            placeholder="Artist"
            className="px-3 py-2.5 rounded-xl bg-[#f8f9fa] text-sm outline-none placeholder:text-[#a3a3a3]"
          />
          <input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Category (e.g. chill, upbeat)"
            className="px-3 py-2.5 rounded-xl bg-[#f8f9fa] text-sm outline-none placeholder:text-[#a3a3a3]"
          />
        </div>

        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f8f9fa] hover:bg-[#f0f0f0] text-sm text-[#525252] cursor-pointer transition-colors">
            {uploadingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {audioFile ? "Replace audio" : "Upload audio"}
            <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
          </label>
          {audioFile && <span className="text-xs text-[#22c55e] font-medium">{formatDuration(audioFile.durationMs)} loaded</span>}

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f8f9fa] hover:bg-[#f0f0f0] text-sm text-[#525252] cursor-pointer transition-colors">
            {uploadingArt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {artworkUrl ? "Replace artwork" : "Upload artwork (optional)"}
            <input type="file" accept="image/*" className="hidden" onChange={handleArtworkUpload} />
          </label>
          {artworkUrl && (
            <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-[#efefef] flex-shrink-0">
              <Image src={artworkUrl} alt="" width={32} height={32} className="object-cover w-full h-full" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[#F44444] mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add track"}
        </button>
      </div>

      {/* Track list */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" /></div>
      ) : tracks.length === 0 ? (
        <p className="text-sm text-[#a3a3a3] text-center py-10">No tracks yet — add one above.</p>
      ) : (
        <div className="space-y-1.5">
          {tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#efefef]">
              <button onClick={() => togglePlay(t)} className="w-8 h-8 rounded-full bg-[#f8f9fa] hover:bg-[#f0f0f0] flex items-center justify-center flex-shrink-0">
                {playingId === t.id ? <Pause className="w-3.5 h-3.5 text-[#0a0a0a]" /> : <Play className="w-3.5 h-3.5 text-[#0a0a0a]" />}
              </button>
              <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-[#efefef] flex-shrink-0 bg-[#f8f9fa]">
                {t.artworkUrl && <Image src={t.artworkUrl} alt="" width={32} height={32} className="object-cover w-full h-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0a0a0a] truncate">{t.title}</p>
                <p className="text-xs text-[#a3a3a3] truncate">{t.artist} · {t.category} · {formatDuration(t.durationMs)}</p>
              </div>
              <button
                onClick={() => toggleActive(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0 ${t.active ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#f5f5f5] text-[#a3a3a3]"}`}
              >
                {t.active ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
