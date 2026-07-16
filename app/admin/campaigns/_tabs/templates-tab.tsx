"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Trash2, X, Pencil } from "lucide-react";
import { AdminPillTabs } from "@/app/admin/admin-components";

// ── types ─────────────────────────────────────────────────────────────────────

interface BroadcastTemplate {
  id: string; name: string; category: string; subject: string; bodyHtml: string;
  previewText: string; messageTitle: string; notificationBody: string;
  channels: string[]; tags: string[]; createdAt: string; updatedAt: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CATEGORIES = ["General", "Announcement", "Newsletter", "Promotion", "Transactional", "Alert"];

// ── form ──────────────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: "", category: "General", subject: "", bodyHtml: "", previewText: "",
  messageTitle: "", notificationBody: "", channels: ["email"] as string[], tags: [] as string[],
};

function TemplateForm({
  initial, onClose, onSaved, mode,
}: {
  initial?: BroadcastTemplate;
  onClose: () => void;
  onSaved: () => void;
  mode: "create" | "edit";
}) {
  const [form, setForm] = useState<typeof DEFAULT_FORM>(initial ? {
    name: initial.name, category: initial.category, subject: initial.subject,
    bodyHtml: initial.bodyHtml, previewText: initial.previewText ?? "",
    messageTitle: initial.messageTitle ?? "", notificationBody: initial.notificationBody ?? "",
    channels: initial.channels, tags: initial.tags,
  } : DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleChannel = (ch: string) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }));
  };

  const submit = async () => {
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.subject.trim()) { setError("Subject is required"); return; }
    if (!form.bodyHtml.trim()) { setError("Body is required"); return; }

    setSaving(true);
    try {
      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/admin/campaigns/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch("/api/admin/campaigns/templates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: initial!.id, ...form }),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
          <p className="text-sm font-semibold text-[#0a0a0a]">{mode === "create" ? "New template" : "Edit template"}</p>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#0a0a0a] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-xs text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <F label="Name">
              <input className="input-base" placeholder="Template name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </F>
            <F label="Category">
              <select className="input-base" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </F>
          </div>

          <F label="Subject">
            <input className="input-base" placeholder="Email subject line" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
          </F>

          <F label="Preview text">
            <input className="input-base" placeholder="Short preview text" value={form.previewText}
              onChange={e => setForm(f => ({ ...f, previewText: e.target.value }))} />
          </F>

          <F label="Channels">
            <div className="flex gap-2">
              {["email", "push"].map(ch => (
                <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${form.channels.includes(ch)
                      ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                      : "bg-white text-[#525252] border-[#e5e5e5] hover:border-[#a3a3a3]"
                    }`}>
                  {ch}
                </button>
              ))}
            </div>
          </F>

          {form.channels.includes("push") && (
            <div className="grid grid-cols-2 gap-3">
              <F label="Push title">
                <input className="input-base" placeholder="Notification title" value={form.messageTitle}
                  onChange={e => setForm(f => ({ ...f, messageTitle: e.target.value }))} />
              </F>
              <F label="Push body">
                <input className="input-base" placeholder="Notification body" value={form.notificationBody}
                  onChange={e => setForm(f => ({ ...f, notificationBody: e.target.value }))} />
              </F>
            </div>
          )}

          <F label="Body (HTML)">
            <textarea className="input-base font-mono text-xs min-h-[140px] resize-y"
              placeholder="<p>Hello…</p>" value={form.bodyHtml}
              onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))} />
          </F>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#f0f0f0]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#525252] hover:text-[#0a0a0a] transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 bg-[#0a0a0a] text-white text-xs font-medium rounded-lg hover:bg-[#222] disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {mode === "create" ? "Save template" : "Update template"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[#525252]">{label}</p>
      {children}
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<BroadcastTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/campaigns/templates");
      if (res.ok) {
        const d = await res.json();
        setTemplates(d.templates ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/campaigns/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) { showToast("Deleted"); load(); }
    } finally {
      setDeleting(null);
    }
  };

  const categories = ["All", ...Array.from(new Set(templates.map(t => t.category)))];
  const filtered = categoryFilter === "All" ? templates : templates.filter(t => t.category === categoryFilter);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <AdminPillTabs
          tabs={categories}
          activeTab={categories.indexOf(categoryFilter)}
          onTabChange={(i) => setCategoryFilter(categories[i])}
        />
        <button onClick={() => { setEditing(null); setFormMode("create"); }}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-[#F44444] text-white text-xs font-medium rounded-lg hover:bg-[#D22] transition-colors">
          <Plus className="w-3.5 h-3.5" />
          New template
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 text-[#F44444] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-sm text-[#525252]">No templates</p>
          <p className="text-xs text-[#a3a3a3] mt-1">Create a reusable template to speed up broadcasts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="bg-white border border-[#e5e5e5] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{t.name}</p>
                  <p className="text-xs text-[#a3a3a3] mt-0.5">{t.category}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditing(t); setFormMode("edit"); }}
                    className="p-1.5 rounded-lg text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                    className="p-1.5 rounded-lg text-[#737373] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors disabled:opacity-40">
                    {deleting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#525252] truncate">{t.subject}</p>
                {t.previewText && (
                  <p className="text-[11px] text-[#a3a3a3] mt-0.5 truncate">{t.previewText}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {t.channels.map(ch => (
                    <span key={ch} className="px-2 py-0.5 bg-[#f5f5f5] text-[#525252] text-[10px] rounded-full capitalize">
                      {ch}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-[#a3a3a3]">{fmtDate(t.updatedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {formMode && (
          <TemplateForm
            mode={formMode}
            initial={editing ?? undefined}
            onClose={() => { setFormMode(null); setEditing(null); }}
            onSaved={load}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg z-50"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
