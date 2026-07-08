"use client";

import { EyeOff, ChevronsUp, ChevronsDown } from "lucide-react";

// Floating toolbar shown for whichever Story-canvas element is currently
// selected. Resizing and rotating happen via natural pinch/two-finger
// gestures directly on the element (see bindGesture in the Story creator),
// not through explicit controls here — this toolbar only surfaces what has
// no gesture equivalent: opacity and layer order. Neither is meaningful for
// the location badge (no schema support for it), hence `showTransform`.
export function StoryElementToolbar({
  opacity,
  showTransform,
  onOpacityChange,
  onReorder,
}: {
  opacity: number;
  showTransform: boolean;
  onOpacityChange: (val: number) => void;
  onReorder: (dir: "front" | "back") => void;
}) {
  if (!showTransform) return null;
  return (
    <div
      className="absolute z-40 left-1/2 -translate-x-1/2 bottom-full mb-2 flex flex-col gap-1.5 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[160px]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
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

      <div className="flex items-center gap-1.5 pt-0.5">
        <button type="button" onClick={() => onReorder("back")} className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-medium">
          <ChevronsDown className="w-3 h-3" /> Back
        </button>
        <button type="button" onClick={() => onReorder("front")} className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-medium">
          <ChevronsUp className="w-3 h-3" /> Front
        </button>
      </div>
    </div>
  );
}
