"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, Video, X, Loader2, AlertCircle, ImageIcon } from "lucide-react";
import { useShortsContext } from "../context";

type Format = "vertical" | "horizontal" | "square";

const FORMATS: { id: Format; label: string; ratio: string; w: number; h: number }[] = [
  { id: "vertical",   label: "Vertical",   ratio: "9:16", w: 9,  h: 16 },
  { id: "horizontal", label: "Horizontal", ratio: "16:9", w: 16, h: 9  },
  { id: "square",     label: "Square",     ratio: "1:1",  w: 1,  h: 1  },
];

interface FormState {
  title:       string;
  description: string;
  videoUrl:    string;
  thumbnailUrl: string;
  format:      Format;
}

export default function CreateShortPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const editId       = searchParams.get("id");
  const { user }     = useShortsContext();

  const [form, setForm] = useState<FormState>({
    title: "", description: "", videoUrl: "", thumbnailUrl: "", format: "vertical",
  });
  const [videoUploading,  setVideoUploading]  = useState(false);
  const [thumbUploading,  setThumbUploading]  = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");
  const [shortStatus,     setShortStatus]     = useState("draft");
  const [loadingEdit,     setLoadingEdit]     = useState(!!editId);
  const [videoProgress,   setVideoProgress]   = useState(0);

  const videoRef   = useRef<HTMLInputElement>(null);
  const thumbRef   = useRef<HTMLInputElement>(null);

  // Load existing short for edit
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const res = await fetch(`/api/shorts/${editId}`);
        if (!res.ok) { router.replace("/uploader/my-shorts"); return; }
        const { short } = await res.json();
        setForm({
          title:        short.title       ?? "",
          description:  short.description ?? "",
          videoUrl:     short.videoUrl    ?? "",
          thumbnailUrl: short.thumbnailUrl ?? "",
          format:       short.format      ?? "vertical",
        });
        setShortStatus(short.status);
        // Non-editable statuses redirect away
        if (!["draft", "rejected"].includes(short.status)) {
          router.replace("/uploader/my-shorts");
        }
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [editId, router]);

  const uploadFile = async (file: File, category: string): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.url ?? null;
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    setVideoProgress(0);
    setError("");
    try {
      // Simulate progress for UX
      const interval = setInterval(() => setVideoProgress(p => Math.min(p + 8, 85)), 300);
      const url = await uploadFile(file, "videos");
      clearInterval(interval);
      setVideoProgress(100);
      if (url) setForm(f => ({ ...f, videoUrl: url }));
    } catch {
      setError("Video upload failed. Please try again.");
    } finally {
      setVideoUploading(false);
      setTimeout(() => setVideoProgress(0), 800);
    }
  };

  const handleThumbChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbUploading(true);
    setError("");
    try {
      const url = await uploadFile(file, "posts");
      if (url) setForm(f => ({ ...f, thumbnailUrl: url }));
    } catch {
      setError("Thumbnail upload failed.");
    } finally {
      setThumbUploading(false);
    }
  };

  const buildPayload = () => ({
    title:        form.title.trim(),
    description:  form.description.trim() || null,
    videoUrl:     form.videoUrl.trim(),
    thumbnailUrl: form.thumbnailUrl.trim() || null,
    format:       form.format,
  });

  const validate = (): string | null => {
    if (!form.title.trim())  return "Title is required";
    if (!form.videoUrl.trim()) return "Please upload a video";
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError("");
    try {
      const method  = editId ? "PATCH" : "POST";
      const url     = editId ? `/api/shorts/${editId}` : "/api/shorts";
      const res     = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
        return;
      }
      router.push("/uploader/my-shorts");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError("");
    try {
      // Save/update first
      const method = editId ? "PATCH" : "POST";
      const url    = editId ? `/api/shorts/${editId}` : "/api/shorts";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
        return;
      }
      const { short } = await res.json();

      // Submit for review
      const id = editId ?? short.id;
      const submitRes = await fetch(`/api/shorts/${id}/submit`, { method: "POST" });
      if (!submitRes.ok) {
        const d = await submitRes.json();
        setError(d.error ?? "Failed to submit");
        return;
      }
      router.push("/uploader/my-shorts?tab=in_review");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEdit) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    );
  }

  const isEditing    = !!editId;
  const isRejected   = shortStatus === "rejected";
  const anySaving    = saving || submitting || videoUploading || thumbUploading;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-lg font-semibold text-[#0a0a0a]">
            {isEditing ? "Edit short" : "New short"}
          </p>
          {isRejected && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs text-red-600">Rejected — revise and resubmit</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Video Upload */}
        <div>
          <label className="text-xs font-medium text-[#737373] block mb-2">Video</label>
          {form.videoUrl ? (
            <div className="relative rounded-xl overflow-hidden bg-white border border-[#f0f0f0]">
              <video
                src={form.videoUrl}
                controls
                muted
                className="w-full max-h-72 object-contain"
              />
              <button
                onClick={() => { setForm(f => ({ ...f, videoUrl: "" })); if (videoRef.current) videoRef.current.value = ""; }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-[#f0f0f0] flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                disabled={anySaving}
              >
                <X className="w-3.5 h-3.5 text-[#0a0a0a]" />
              </button>
            </div>
          ) : (
            <label
              className={`flex flex-col items-center justify-center h-52 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                videoUploading
                  ? "border-[#e5e5e5] bg-white"
                  : "border-[#f0f0f0] bg-[#f5f5f5] hover:border-[#e5e5e5] hover:bg-white"
              }`}
            >
              {videoUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 text-[#a3a3a3] animate-spin" />
                  <div className="w-32 h-1 rounded-full bg-[#f0f0f0] overflow-hidden">
                    <div
                      className="h-full bg-[#F44444] rounded-full transition-all duration-300"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#a3a3a3]">Uploading…</p>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-[#a3a3a3] mb-2" />
                  <p className="text-sm text-[#737373]">Click to upload video</p>
                  <p className="text-xs text-[#a3a3a3] mt-1">MP4, MOV, WebM</p>
                </>
              )}
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
                disabled={anySaving}
              />
            </label>
          )}
        </div>

        {/* Thumbnail */}
        <div>
          <label className="text-xs font-medium text-[#737373] block mb-2">
            Thumbnail <span className="text-[#a3a3a3] font-normal">optional</span>
          </label>
          {form.thumbnailUrl ? (
            <div className="relative w-24 h-36 rounded-xl overflow-hidden bg-white border border-[#f0f0f0]">
              <img src={form.thumbnailUrl} alt="thumbnail" className="w-full h-full object-cover" />
              <button
                onClick={() => { setForm(f => ({ ...f, thumbnailUrl: "" })); if (thumbRef.current) thumbRef.current.value = ""; }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 border border-[#f0f0f0] flex items-center justify-center shadow-sm"
                disabled={anySaving}
              >
                <X className="w-2.5 h-2.5 text-[#0a0a0a]" />
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#f0f0f0] hover:border-[#e5e5e5] cursor-pointer transition-colors">
              {thumbUploading
                ? <Loader2 className="w-3.5 h-3.5 text-[#a3a3a3] animate-spin" />
                : <ImageIcon className="w-3.5 h-3.5 text-[#a3a3a3]" />
              }
              <span className="text-xs text-[#737373]">
                {thumbUploading ? "Uploading…" : "Add thumbnail"}
              </span>
              <input
                ref={thumbRef}
                type="file"
                accept="image/*"
                onChange={handleThumbChange}
                className="hidden"
                disabled={anySaving}
              />
            </label>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-[#737373] block mb-2">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value.slice(0, 200) }))}
            placeholder="Give your short a title"
            maxLength={200}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#f0f0f0] text-sm text-[#0a0a0a] placeholder-[#a3a3a3] outline-none focus:border-[#e5e5e5] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
            disabled={anySaving}
          />
          <p className="text-[10px] text-[#a3a3a3] mt-1 text-right">{form.title.length}/200</p>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-[#737373] block mb-2">
            Description <span className="text-[#a3a3a3] font-normal">optional</span>
          </label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 1000) }))}
            placeholder="What's this short about?"
            rows={3}
            maxLength={1000}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#f0f0f0] text-sm text-[#0a0a0a] placeholder-[#a3a3a3] outline-none focus:border-[#e5e5e5] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
            disabled={anySaving}
          />
          <p className="text-[10px] text-[#a3a3a3] mt-1 text-right">{form.description.length}/1000</p>
        </div>

        {/* Format */}
        <div>
          <label className="text-xs font-medium text-[#737373] block mb-2">Format</label>
          <div className="flex items-center gap-2">
            {FORMATS.map(f => (
              <button
                key={f.id}
                onClick={() => setForm(st => ({ ...st, format: f.id }))}
                disabled={anySaving}
                className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-center transition-all ${
                  form.format === f.id
                    ? "border-[#F44444]/50 bg-red-500/10 text-[#0a0a0a]"
                    : "border-[#f0f0f0] bg-white text-[#737373] hover:border-[#e5e5e5] hover:text-[#0a0a0a]"
                }`}
              >
                {/* Aspect ratio indicator */}
                <div
                  className={`border rounded flex-shrink-0 ${
                    form.format === f.id ? "border-[#F44444]/60" : "border-[#f0f0f0]"
                  }`}
                  style={{
                    width:  f.w <= f.h ? `${Math.round(18 * (f.w / f.h))}px` : "28px",
                    height: f.h <= f.w ? `${Math.round(18 * (f.h / f.w))}px` : "28px",
                  }}
                />
                <div>
                  <p className="text-xs font-medium">{f.label}</p>
                  <p className="text-[10px] opacity-60">{f.ratio}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={anySaving}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#f0f0f0] text-sm text-[#0a0a0a] hover:border-[#e5e5e5] hover:text-[#0a0a0a] transition-all disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={anySaving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isRejected ? "Resubmit for review" : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}
