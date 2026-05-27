"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AlbizLogo } from "@/app/lib/shared-components";

const ROLE_LABELS: Record<string, string> = {
  CIRCLE: "Circle member",
  AUTHOR: "Author",
  ADMIN: "Admin",
  NORMAL: "Member",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  CIRCLE: "Access to exclusive Circle content and the full Albiz community.",
  AUTHOR: "Create and publish articles on the Albiz platform.",
  ADMIN: "Full access to platform management and admin tools.",
  NORMAL: "Access to the Albiz community and feed.",
};

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [invite, setInvite] = useState<{ email: string; role: string; name: string | null; hasAccount: boolean } | null>(null);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("No invite token found."); return; }

    fetch(`/api/auth/accept-invite?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStatus("error"); setErrorMsg(data.error); return; }
        setInvite(data);
        if (data.name) setName(data.name);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setErrorMsg("Connection error — try again."); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!invite.hasAccount && !name.trim()) { setFieldError("Name is required"); return; }
    if (!invite.hasAccount && password.length < 6) { setFieldError("Password must be at least 6 characters"); return; }
    const trimmedHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!invite.hasAccount && !trimmedHandle) { setFieldError("Username is required"); return; }
    if (!invite.hasAccount && trimmedHandle.length < 3) { setFieldError("Username must be at least 3 characters"); return; }
    setSubmitting(true);
    setFieldError("");
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          handle: !invite.hasAccount ? trimmedHandle : undefined,
          title: title.trim() || undefined,
          bio: bio.trim() || undefined,
          password,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setFieldError(data.error || "Something went wrong");
      }
    } catch {
      setFieldError("Connection error — try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <AlbizLogo size={44} />
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          {status === "loading" && (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
            </div>
          )}

          {status === "error" && (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Invite not valid</p>
              <p className="text-sm text-[#737373] mb-6">{errorMsg}</p>
              <button onClick={() => router.push("/")} className="text-sm text-[#F44444] font-medium hover:text-[#d64d3c] transition-colors cursor-pointer">Back to Albiz</button>
            </div>
          )}

          {status === "ready" && invite && !done && (
            <div className="p-8">
              {/* Role badge */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    invite.role === "ADMIN" ? "bg-[#e5e5e5] text-[#0a0a0a]" :
                    invite.role === "AUTHOR" ? "bg-[#F5F3FF] text-[#8B5CF6]" :
                    invite.role === "CIRCLE" ? "bg-[#FFF0F0] text-[#F44444]" :
                    "bg-[#f0f0f0] text-[#525252]"
                  }`}>
                    {ROLE_LABELS[invite.role] ?? invite.role}
                  </span>
                </div>
                <p className="text-xl font-bold text-[#0a0a0a] leading-snug">
                  {invite.hasAccount ? "Your role has been updated" : "Join Albiz"}
                </p>
                <p className="text-sm text-[#737373] mt-1">
                  {invite.hasAccount
                    ? `Your account (${invite.email}) will be upgraded to ${ROLE_LABELS[invite.role] ?? invite.role}.`
                    : ROLE_DESCRIPTIONS[invite.role] ?? ""}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {!invite.hasAccount && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Full name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); setFieldError(""); }}
                        placeholder="Your name"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
                      <input
                        type="email"
                        value={invite.email}
                        disabled
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm text-[#a3a3a3] cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={e => { setPassword(e.target.value); setFieldError(""); }}
                          placeholder="At least 6 characters"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all pr-10"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252]">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Username</label>
                      <input
                        type="text"
                        value={handle}
                        onChange={e => { setHandle(e.target.value); setFieldError(""); }}
                        placeholder="username"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Designation</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => { setTitle(e.target.value); setFieldError(""); }}
                    placeholder="e.g. Frontend Engineer"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#525252] block mb-1.5">Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => { setBio(e.target.value); setFieldError(""); }}
                    placeholder="Tell us about yourself"
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
                  />
                </div>

                {fieldError && <p className="text-xs text-[#F44444]">{fieldError}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {invite.hasAccount ? "Accept invitation" : "Create account"}
                </button>
              </form>
            </div>
          )}

          {done && (
            <div className="p-8 text-center">
              <p className="text-xl font-bold text-[#0a0a0a] mb-2">You&apos;re in</p>
              <p className="text-sm text-[#737373] mb-6">
                Your account is ready. Sign in to get started.
              </p>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
              >
                Go to Albiz
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
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
      <AcceptInviteContent />
    </Suspense>
  );
}
