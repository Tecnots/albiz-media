"use client";

import { useState, useEffect } from "react";

function getInitial(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}

// Single source of truth for rendering a user's profile picture. Falls back to a
// colored initial for a missing src, and re-falls-back on a broken/expired URL
// (blob SAS tokens can go stale — see resolveMediaUrl's "keep stale URL" case)
// instead of showing the browser's native broken-image icon.
export function Avatar({ src, name, alt, size = 40, className = "" }: AvatarProps) {
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [src]);

  const showImage = !!src && !broken;
  const label = alt || name || "User";

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-[#F44444]/10 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role={showImage ? undefined : "img"}
      aria-label={showImage ? undefined : label}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={label}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className="font-semibold text-[#F44444] select-none"
          style={{ fontSize: size * 0.4 }}
          aria-hidden="true"
        >
          {getInitial(name)}
        </span>
      )}
    </div>
  );
}
