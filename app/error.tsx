"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white gap-4">
      <p className="text-[#a3a3a3] text-sm">Something went wrong.</p>
      <button
        onClick={reset}
        className="text-sm text-white border border-[#2a2a2a] px-4 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
