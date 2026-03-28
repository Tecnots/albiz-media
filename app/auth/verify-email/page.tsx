"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setName(data.name || "");
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Connection error — try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <AlbizLogo size={48} />
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-6 h-6 text-[#737373] animate-spin mx-auto mb-4" />
              <p className="text-sm text-[#737373]">Verifying your email…</p>
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="text-xl font-bold text-[#e5e5e5] mb-2">
                {name ? `Welcome, ${name}` : "Email verified"}
              </h1>
              <p className="text-sm text-[#737373] mb-6">
                Your email has been verified. You can now sign in to your account.
              </p>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
              >
                Go to Albiz
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-xl font-bold text-[#e5e5e5] mb-2">Link expired</h1>
              <p className="text-sm text-[#737373] mb-6">{message}</p>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#e5e5e5] font-medium hover:bg-[#262626] transition-colors cursor-pointer"
              >
                Back to Albiz
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
