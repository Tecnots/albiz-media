"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { EyeOff, ChevronsUp, ChevronsDown, Droplets } from "lucide-react";

// Floating toolbar shown for whichever Story-canvas element is currently
// selected. Rendered via portal to escape parent overflow:hidden containers
// (both the canvas and sticker wrappers clip absolutely-positioned children).
export function StoryElementToolbar({
  opacity,
  blur,
  showTransform,
  onOpacityChange,
  onBlurChange,
  onReorder,
}: {
  opacity: number;
  blur?: number;
  showTransform: boolean;
  onOpacityChange: (val: number) => void;
  onBlurChange?: (val: number) => void;
  onReorder: (dir: "front" | "back") => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const toolbar = toolbarRef.current;
    if (!anchor || !toolbar) return;

    const stickerRect = anchor.parentElement?.getBoundingClientRect();
    if (!stickerRect) return;

    const tW = toolbar.offsetWidth;
    const tH = toolbar.offsetHeight;

    // Position above the sticker, centered horizontally
    let top = stickerRect.top - tH - 8;
    let left = stickerRect.left + stickerRect.width / 2 - tW / 2;

    // If not enough room above, show below
    if (top < 8) {
      top = stickerRect.bottom + 8;
    }

    // Clamp horizontal to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tW - 8));

    setPos({ top, left });
  }, []);

  useEffect(() => {
    reposition();
    // Reposition on scroll/resize in case canvas moves
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    const interval = setInterval(reposition, 200); // catch drag/transform changes
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      clearInterval(interval);
    };
  }, [reposition]);

  if (!showTransform) return null;

  const stop = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const toolbarContent = (
    <div
      ref={toolbarRef}
      className="fixed z-[9999] flex flex-col gap-1.5 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[160px]"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
      }}
      onPointerDown={stop}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Opacity */}
      <div className="flex items-center gap-2">
        <EyeOff className="w-3 h-3 text-white/70 flex-shrink-0" />
        <input
          type="range"
          min={20}
          max={100}
          step={5}
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="flex-1 h-1 accent-[#F44444]"
        />
        <span className="text-white/70 text-[10px] tabular-nums w-7 text-right">{Math.round(opacity * 100)}%</span>
      </div>

      {/* Blur */}
      {onBlurChange && (
        <div className="flex items-center gap-2">
          <Droplets className="w-3 h-3 text-white/70 flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={blur ?? 0}
            onChange={(e) => onBlurChange(Number(e.target.value))}
            className="flex-1 h-1 accent-[#F44444]"
          />
          <span className="text-white/70 text-[10px] tabular-nums w-7 text-right">{blur ?? 0}px</span>
        </div>
      )}

      {/* Layer order */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button type="button" onPointerDown={stop} onClick={() => onReorder("back")} className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-medium cursor-pointer">
          <ChevronsDown className="w-3 h-3" /> Back
        </button>
        <button type="button" onPointerDown={stop} onClick={() => onReorder("front")} className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-medium cursor-pointer">
          <ChevronsUp className="w-3 h-3" /> Front
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Invisible anchor inside the sticker to measure position */}
      <div ref={anchorRef} className="absolute inset-0 pointer-events-none" />
      {typeof document !== "undefined" && createPortal(toolbarContent, document.body)}
    </>
  );
}
