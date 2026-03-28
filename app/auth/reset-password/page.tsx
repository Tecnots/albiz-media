"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (!token) { setError("Invalid reset link"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <AlbizLogo size={48} />
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-8">
          {!done ? (
            <>
              <h1 className="text-xl font-bold text-[#e5e5e5] mb-1">Set a new password</h1>
              <p className="text-sm text-[#737373] mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(""); }}
                      placeholder="At least 6 characters"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] text-sm text-[#e5e5e5] outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all pr-10 placeholder:text-[#525252]"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] hover:text-[#a3a3a3]">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#737373] block mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(""); }}
                    placeholder="Repeat your password"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] text-sm text-[#e5e5e5] outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all placeholder:text-[#525252]"
                  />
                </div>
                {error && <p className="text-xs text-[#F44444] text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !password.trim() || !confirm.trim()}
                  className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Set new password
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <h1 className="text-xl font-bold text-[#e5e5e5] mb-2">Password updated</h1>
              <p className="text-sm text-[#737373] mb-6">Your password has been changed. Sign in with your new password.</p>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
