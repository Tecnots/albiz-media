"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { X, ZoomIn, ZoomOut } from "lucide-react";

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (blob: Blob) => Promise<void> | void;
}

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = Math.min(area.width, area.height);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92
    );
  });
}

export default function AvatarCropModal({ isOpen, imageSrc, onClose, onCropComplete }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      await onCropComplete(blob);
      handleClose();
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    onClose();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e5]">
          <h3 className="text-base font-semibold text-[#0a0a0a]">Adjust photo</h3>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-[#737373] hover:text-[#0a0a0a] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full h-80 bg-[#0a0a0a]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="px-5 py-4 border-t border-[#e5e5e5] space-y-4">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-[#737373] flex-shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#F44444]"
            />
            <ZoomIn className="w-4 h-4 text-[#737373] flex-shrink-0" />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !croppedArea}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F44444] text-sm font-medium text-white hover:bg-[#d63c3c] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
