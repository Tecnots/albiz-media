"use client";

import { useState, useRef, useCallback, useContext } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { X, ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { AuthContext } from "@/app/lib/contexts";
import { validateImage } from "@/app/lib/image-validation";
import { getCroppedBlob } from "@/app/lib/crop-image";

const ASPECT_OPTIONS = [
  { label: "1:1", value: 1 },
  { label: "4:5", value: 0.8 },
  { label: "16:9", value: 16 / 9 },
] as const;

type Step = "compose" | "crop";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPosted?: () => void;
}

export default function CreatePostModal({ isOpen, onClose, onPosted }: Props) {
  const { currentUserId, userProfile } = useContext(AuthContext);

  const [step, setStep] = useState<Step>("compose");
  const [text, setText] = useState("");

  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  const [validationErr, setValidationErr] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 280;

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (fileRef.current) fileRef.current.value = "";
      if (!file) return;

      setValidationErr(null);
      const result = await validateImage(file);
      if (!result.valid) {
        setValidationErr(result.message ?? "Invalid image.");
        return;
      }

      const naturalRatio = result.width! / result.height!;
      const defaultAspect =
        naturalRatio > 1.2 ? 16 / 9 : naturalRatio < 0.9 ? 0.8 : 1;

      if (rawSrc) URL.revokeObjectURL(rawSrc);
      const src = URL.createObjectURL(file);
      setRawSrc(src);
      setAspect(defaultAspect);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setPixelCrop(null);
      setStep("crop");
    },
    [rawSrc]
  );

  const handleCropDone = useCallback(async () => {
    if (!rawSrc || !pixelCrop) return;
    setCropping(true);
    try {
      const blob = await getCroppedBlob(rawSrc, pixelCrop);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const preview = URL.createObjectURL(blob);
      setCroppedBlob(blob);
      setPreviewUrl(preview);
      setStep("compose");
    } catch {
      setStep("compose");
    } finally {
      setCropping(false);
    }
  }, [rawSrc, pixelCrop, previewUrl]);

  const handleRemoveImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    setCroppedBlob(null);
    setPreviewUrl(null);
    setRawSrc(null);
    setValidationErr(null);
  };

  const handlePublish = async () => {
    if (publishing) return;
    setPublishing(true);
    setPublishErr(null);
    try {
      let imageUrl: string | undefined;

      if (croppedBlob) {
        const fd = new FormData();
        fd.append("file", croppedBlob, "post.jpg");
        fd.append("category", "posts");
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (!up.ok) throw new Error("upload");
        const data = await up.json();
        imageUrl = data.url;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          type: "post",
          content: text.trim() || undefined,
          image: imageUrl,
          status: "published",
        }),
      });
      if (!res.ok) throw new Error("post");

      doReset();
      onPosted?.();
    } catch {
      setPublishErr("Something went wrong. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const doReset = () => {
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("compose");
    setText("");
    setRawSrc(null);
    setCroppedBlob(null);
    setPreviewUrl(null);
    setValidationErr(null);
    setPublishErr(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleClose = () => {
    if (publishing) return;
    doReset();
    onClose();
  };

  if (!isOpen) return null;

  const canPost = text.trim().length > 0 || croppedBlob !== null;
  const charsLeft = MAX_CHARS - text.length;
  const initial = userProfile?.name?.[0]?.toUpperCase() ?? "?";

  if (step === "crop") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75">
        <div className="w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl">
          {/* Crop area */}
          <div className="relative w-full bg-[#fafafa]" style={{ height: 420 }}>
            {rawSrc && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${rawSrc})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(20px)",
                  transform: "scale(1.1)",
                  opacity: 0.15,
                }}
              />
            )}
            {rawSrc && (
              <Cropper
                image={rawSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, px) => setPixelCrop(px)}
                showGrid={false}
                style={{
                  containerStyle: { background: "transparent" },
                  cropAreaStyle: {
                    border: "2px solid #F44444",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  },
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="px-5 pt-4 pb-5 border-t border-[#f0f0f0]">
            <div className="flex items-center justify-center gap-2 mb-4">
              {ASPECT_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setAspect(opt.value);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                  className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    Math.abs(aspect - opt.value) < 0.01
                      ? "bg-[#F44444] text-white"
                      : "bg-[#f5f5f5] text-[#737373] hover:bg-[#ebebeb]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("compose")}
                className="px-4 py-2 rounded-xl text-sm text-[#737373] hover:text-[#0a0a0a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCropDone}
                disabled={!pixelCrop || cropping}
                className="px-6 py-2 rounded-full bg-[#F44444] text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2 hover:bg-[#d63c3c] transition-colors"
              >
                {cropping && <Loader2 className="w-4 h-4 animate-spin" />}
                Choose
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#f0f0f0]">
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[#f5f5f5] rounded-lg text-[#737373] hover:text-[#0a0a0a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPost || publishing}
            className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center gap-1.5"
          >
            {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {publishing ? "Sharing…" : "Share"}
          </button>
        </div>

        <div className="flex gap-3 px-4 pt-4 pb-2">
          <div className="flex-shrink-0 mt-0.5">
            {userProfile?.avatar ? (
              <Image
                src={userProfile.avatar}
                alt=""
                width={36}
                height={36}
                className="rounded-full object-cover ring-1 ring-[#e5e5e5]"
                style={{ width: 36, height: 36 }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#F44444] flex items-center justify-center text-white text-sm font-bold">
                {initial}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                autoResize();
              }}
              placeholder="What's happening in your Circle?"
              maxLength={MAX_CHARS}
              rows={3}
              className="w-full resize-none outline-none text-[#0a0a0a] text-[15px] placeholder:text-[#a3a3a3] bg-transparent min-h-[80px] leading-relaxed"
            />

            {previewUrl && (
              <div className="relative mt-3 rounded-xl overflow-hidden bg-[#f5f5f5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="" className="w-full block" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f0f0] mt-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-lg text-[#F44444] hover:bg-[#FFF0F0] transition-colors"
              title="Add photo"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <span className="text-[11px] text-[#a3a3a3]">JPG, PNG, WebP · max 10 MB · min 320 px</span>
          </div>
          <div className="flex items-center gap-2">
            {(validationErr || publishErr) && (
              <span className="text-xs text-[#F44444]">
                {validationErr ?? publishErr}
              </span>
            )}
            <span
              className={`text-xs font-medium tabular-nums ${
                charsLeft < 0
                  ? "text-[#F44444]"
                  : charsLeft < 20
                  ? "text-[#F59E0B]"
                  : "text-[#a3a3a3]"
              }`}
            >
              {charsLeft}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
