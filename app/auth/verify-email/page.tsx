"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const signInAttempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(async (data) => {
        if (data.success) {
          setName(data.name || "");

          // Auto-sign-in for first-time verification (not repeat clicks)
          if (data.autoLoginToken && !signInAttempted.current) {
            signInAttempted.current = true;
            try {
              const result = await signIn("credentials", {
                autoLoginToken: data.autoLoginToken,
                redirect: false,
              });
              if (result?.ok) {
                sessionStorage.setItem("fromEmailVerification", "true");
                router.push("/?verified=true");
                return;
              }
            } catch {
              // Auto-login failed silently — fall through to manual sign-in
            }
          }

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
  }, [token, router]);

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
                Your email has been verified. Sign in to get started.
              </p>
              <button
                onClick={() => {
                  sessionStorage.setItem("fromEmailVerification", "true");
                  router.push("/?verified=true");
                }}
                className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
              >
                Sign in to Albiz
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="w-full max-w-sm px-6">
          <div className="flex justify-center mb-8">
            <AlbizLogo size={44} />
          </div>
          <div className="bg-white border border-[#e5e5e5] rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-10 flex justify-center">
            <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
