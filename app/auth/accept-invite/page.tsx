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

const ROLE_HEADLINES: Record<string, string> = {
  AUTHOR: "Start writing for Albiz",
  CIRCLE: "Join the Circle",
  ADMIN: "Full platform access",
  NORMAL: "Join the community",
};

const ROLE_COPY: Record<string, string> = {
  AUTHOR: "Create an account to publish articles, build your audience, and share your expertise with readers on the Albiz platform.",
  CIRCLE: "Get exclusive access to Circle content, in-depth discussions, and the full Albiz community.",
  ADMIN: "You've been granted admin access. Manage content, users, and platform settings.",
  NORMAL: "Join Albiz to browse articles, follow authors, and stay up to date with the community.",
};

const ROLE_FEATURES: Record<string, string[]> = {
  AUTHOR: [
    "Write and publish articles to the Albiz feed",
    "Build a subscriber base and grow your audience",
    "Access author analytics and readership data",
  ],
  CIRCLE: [
    "Exclusive access to Circle-only content",
    "Participate in community discussions",
    "Connect directly with authors",
  ],
  ADMIN: [
    "Full platform management and moderation",
    "Manage users, content, and settings",
    "Access admin analytics and reporting",
  ],
  NORMAL: [
    "Browse and read articles across all topics",
    "Follow authors and curate your feed",
    "Engage with the Albiz community",
  ],
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-[#f0f0f0] text-[#525252]",
  AUTHOR: "bg-[#F5F3FF] text-[#8B5CF6]",
  CIRCLE: "bg-[#FFF0F0] text-[#F44444]",
  NORMAL: "bg-[#f0f0f0] text-[#525252]",
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
      if (res.ok) { setDone(true); }
      else { setFieldError(data.error || "Something went wrong"); }
    } catch {
      setFieldError("Connection error — try again");
    } finally {
      setSubmitting(false);
    }
  };

  const role = invite?.role ?? "NORMAL";
  const badgeClass = ROLE_BADGE[role] ?? ROLE_BADGE.NORMAL;

  return (
    <div className="h-screen bg-white flex overflow-hidden relative">

      {/* Left panel — brand + role context */}
      <div className="hidden lg:flex w-[420px] flex-shrink-0 flex-col justify-between p-12 border-r border-[#f0f0f0]">
        <AlbizLogo size={34} />

        {status === "ready" && invite && !done && (
          <div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mb-5 ${badgeClass}`}>
              {ROLE_LABELS[role] ?? role}
            </span>
            <p className="text-[28px] font-bold text-[#0a0a0a] leading-tight">
              {invite.hasAccount ? "Your role has been updated" : (ROLE_HEADLINES[role] ?? "Join Albiz")}
            </p>
            <p className="text-sm text-[#737373] mt-3 leading-relaxed">
              {invite.hasAccount
                ? `Your account will be upgraded to ${ROLE_LABELS[role] ?? role} on the Albiz platform.`
                : (ROLE_COPY[role] ?? "")}
            </p>

            {!invite.hasAccount && (
              <div className="mt-8 space-y-3.5">
                {(ROLE_FEATURES[role] ?? []).map(feat => (
                  <div key={feat} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F44444] mt-1.5 flex-shrink-0" />
                    <span className="text-sm text-[#525252] leading-snug">{feat}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(status === "loading" || status === "error") && <div />}

        <p className="text-xs text-[#c0c0c0]">albiz.com</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile-only logo */}
        <div className="lg:hidden flex-shrink-0 flex justify-center pt-8 pb-2">
          <AlbizLogo size={34} />
        </div>

        {/* Mobile-only invite context */}
        {status === "ready" && invite && (
          <div className="lg:hidden flex-shrink-0 px-6 pt-4 pb-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mb-2 ${badgeClass}`}>
              {ROLE_LABELS[role] ?? role}
            </span>
            <p className="text-lg font-bold text-[#0a0a0a]">
              {invite.hasAccount ? "Your role has been updated" : (ROLE_HEADLINES[role] ?? "Join Albiz")}
            </p>
            <p className="text-sm text-[#737373] mt-1 leading-relaxed">
              {invite.hasAccount
                ? `Your account will be upgraded to ${ROLE_LABELS[role] ?? role}.`
                : (ROLE_COPY[role] ?? "")}
            </p>
          </div>
        )}

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto">
          <div className="h-full flex flex-col justify-center px-6 lg:px-14 py-8">
            <div className="w-full max-w-md mx-auto">

              {status === "loading" && (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
                </div>
              )}

              {status === "error" && (
                <div className="py-12">
                  <p className="text-base font-semibold text-[#0a0a0a] mb-1">Invite not valid</p>
                  <p className="text-sm text-[#737373]">{errorMsg}</p>
                </div>
              )}

              {status === "ready" && invite && (
                <>
                  <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-widest mb-6">
                    Account details
                  </p>

                  <form id="invite-form" onSubmit={handleSubmit} className="space-y-4">
                    {!invite.hasAccount && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
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
                            <label className="text-xs font-medium text-[#525252] block mb-1.5">Username</label>
                            <input
                              type="text"
                              value={handle}
                              onChange={e => { setHandle(e.target.value); setFieldError(""); }}
                              placeholder="username"
                              className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                            />
                          </div>
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
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] hover:text-[#525252] cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Designation <span className="text-[#c0c0c0] font-normal">· optional</span></label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => { setTitle(e.target.value); setFieldError(""); }}
                        placeholder="e.g. Frontend Engineer"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#525252] block mb-1.5">Bio <span className="text-[#c0c0c0] font-normal">· optional</span></label>
                      <textarea
                        value={bio}
                        onChange={e => { setBio(e.target.value); setFieldError(""); }}
                        placeholder="Tell us about yourself"
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all resize-none"
                      />
                    </div>

                    {fieldError && <p className="text-xs text-[#F44444]">{fieldError}</p>}
                  </form>
                </>
              )}

            </div>
          </div>
        </div>

        {/* Pinned button footer */}
        <div className="flex-shrink-0 border-t border-[#f0f0f0] px-6 lg:px-14 py-5">
          <div className="w-full max-w-md mx-auto">
            {status === "ready" && invite && (
              <>
                <button
                  type="submit"
                  form="invite-form"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {invite.hasAccount ? "Accept invitation" : "Create account"}
                </button>
                <p className="text-xs text-[#c0c0c0] text-center mt-3">
                  By continuing, you agree to the Albiz terms of service.
                </p>
              </>
            )}
            {status === "error" && (
              <button
                onClick={() => router.push("/")}
                className="w-full py-3 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
              >
                Back to Albiz
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Success popup */}
      {done && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-full max-w-sm p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[#FFF0F0] flex items-center justify-center mx-auto mb-5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#F44444]" />
            </div>
            <p className="text-xl font-bold text-[#0a0a0a] mb-2">Account created</p>
            <p className="text-sm text-[#737373] leading-relaxed mb-7">
              Your account is ready. Head to Albiz to start exploring.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 rounded-xl bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
            >
              Go to Albiz
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
