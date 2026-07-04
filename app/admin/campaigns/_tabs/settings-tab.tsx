"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check } from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface BroadcastSettings {
  senderName: string;
  senderEmail: string;
  replyTo: string;
  defaultAudienceType: string;
  batchSize: number;
  trackOpens: boolean;
  trackClicks: boolean;
  unsubscribeFooter: boolean;
  footerText: string;
  updatedAt: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const AUDIENCE_TYPES = [
  "all", "authors", "editors", "circle", "uploaders",
  "admin", "active", "inactive",
];

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All users", authors: "Authors", editors: "Editors", circle: "Circle",
  uploaders: "Uploaders", verified: "Verified", premium: "Premium",
  admin: "Admins", active: "Active (30d)", inactive: "Inactive (90d)",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

function F({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-[#f5f5f5] last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-[#0a0a0a]">{label}</p>
        {description && <p className="text-xs text-[#737373] mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0 flex justify-end w-64">{children}</div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function SettingsTab() {
  const [settings, setSettings] = useState<BroadcastSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/campaigns/settings");
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = <K extends keyof BroadcastSettings>(key: K, value: BroadcastSettings[K]) => {
    setSettings(s => s ? { ...s, [key]: value } : s);
  };

  const save = async () => {
    if (!settings) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/campaigns/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      {error && (
        <div className="mb-4 text-xs text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</div>
      )}

      {/* Sender */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[#f0f0f0]">
          <p className="text-xs font-semibold text-[#525252] uppercase tracking-wide">Sender</p>
        </div>
        <div className="px-5">
          <F label="Sender name" description="Displayed as the sender in recipients' inboxes">
            <input className="input-base" placeholder="Albiz Media" value={settings.senderName}
              onChange={e => update("senderName", e.target.value)} />
          </F>
          <F label="Sender email" description="From address for outgoing emails">
            <input className="input-base" placeholder="hello@yoursite.com" value={settings.senderEmail}
              onChange={e => update("senderEmail", e.target.value)} />
          </F>
          <F label="Reply-to address" description="Where replies from recipients go">
            <input className="input-base" placeholder="support@yoursite.com" value={settings.replyTo}
              onChange={e => update("replyTo", e.target.value)} />
          </F>
        </div>
      </div>

      {/* Delivery */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[#f0f0f0]">
          <p className="text-xs font-semibold text-[#525252] uppercase tracking-wide">Delivery</p>
        </div>
        <div className="px-5">
          <F label="Default audience" description="Pre-selected audience type on new broadcasts">
            <select className="input-base" value={settings.defaultAudienceType}
              onChange={e => update("defaultAudienceType", e.target.value)}>
              {AUDIENCE_TYPES.map(a => (
                <option key={a} value={a}>{AUDIENCE_LABELS[a] ?? a}</option>
              ))}
            </select>
          </F>
          <F label="Batch size" description="Recipients processed per cron tick (1–5000)">
            <input type="number" min={1} max={5000} className="input-base" value={settings.batchSize}
              onChange={e => update("batchSize", Number(e.target.value))} />
          </F>
        </div>
      </div>

      {/* Tracking */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[#f0f0f0]">
          <p className="text-xs font-semibold text-[#525252] uppercase tracking-wide">Tracking</p>
        </div>
        <div className="px-5">
          <F label="Track opens" description="Embed a 1×1 pixel to detect email opens">
            <Toggle checked={settings.trackOpens} onChange={v => update("trackOpens", v)} />
          </F>
          <F label="Track clicks" description="Wrap links to track click-through rates">
            <Toggle checked={settings.trackClicks} onChange={v => update("trackClicks", v)} />
          </F>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-[#f0f0f0]">
          <p className="text-xs font-semibold text-[#525252] uppercase tracking-wide">Footer</p>
        </div>
        <div className="px-5">
          <F label="Unsubscribe footer" description="Append unsubscribe link to every email">
            <Toggle checked={settings.unsubscribeFooter} onChange={v => update("unsubscribeFooter", v)} />
          </F>
          <F label="Footer text" description="Custom text appended below the unsubscribe link">
            <textarea className="input-base min-h-[60px] resize-none"
              placeholder={`© ${new Date().getFullYear()} Albiz Media. All rights reserved.`}
              value={settings.footerText}
              onChange={e => update("footerText", e.target.value)} />
          </F>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-[#F44444] text-white text-xs font-medium rounded-lg hover:bg-[#d64d3c] disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? "Saved" : "Save changes"}
        </button>
        {settings.updatedAt && (
          <p className="text-xs text-[#a3a3a3]">
            Last updated {new Date(settings.updatedAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </p>
        )}
      </div>


    </div>
  );
}
