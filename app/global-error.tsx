"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html>
      <body style={{ background: "#0a0a0a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "16px", fontFamily: "sans-serif" }}>
        <p style={{ color: "#a3a3a3", fontSize: "14px" }}>Something went wrong.</p>
        <button
          onClick={reset}
          style={{ fontSize: "14px", color: "#fff", border: "1px solid #2a2a2a", padding: "8px 16px", borderRadius: "8px", background: "transparent", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
