"use client";

import { useState, useEffect } from "react";
import { Plus, X, Check, Loader2, Pencil, ChevronRight, Users, ShieldCheck, Flag, UserCheck, AlertCircle } from "lucide-react";
import { AdminPillTabs } from "../admin-components";
import { ALL_STAGES } from "../workflow-constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  active: boolean;
}

// ─── Color swatches ───────────────────────────────────────────────────────────

const SWATCHES = [
  "#525252", "#3B82F6", "#F44444", "#22c55e",
  "#F59E0B", "#8B5CF6", "#EC4899", "#0EA5E9",
  "#14b8a6", "#f97316", "#64748b", "#0a0a0a",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SWATCHES.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

// ─── Section Form ─────────────────────────────────────────────────────────────

function SectionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Section>;
  onSave: (data: Partial<Section>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#3B82F6");

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Name</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); if (!initial?.id) setSlug(autoSlug(e.target.value)); }}
            placeholder="e.g. Technology"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Slug</label>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="technology"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[#525252] block mb-1.5">Description <span className="text-[#a3a3a3] font-normal">(optional)</span></label>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of this section"
          className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-[#525252] block mb-2">Color</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-white transition-colors cursor-pointer">Cancel</button>
        <button
          type="button"
          onClick={() => onSave({ name, slug, description, color })}
          disabled={saving || !name.trim() || !slug.trim()}
          className="px-3 py-1.5 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {initial?.id ? "Save changes" : "Create section"}
        </button>
      </div>
    </div>
  );
}


// ─── Stage pipeline preview ────────────────────────────────────────────────────

function StagePipeline({ stages }: { stages: string[] }) {
  const active = ALL_STAGES.filter(s => stages.includes(s.key));
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {active.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: s.color + "20", color: s.color }}>{s.label}</span>
          {i < active.length - 1 && <ChevronRight className="w-3 h-3 text-[#d5d5d5]" />}
        </div>
      ))}
    </div>
  );
}

// ─── Workflow Presets Tab ──────────────────────────────────────────────────────

interface Preset { id: number; name: string; description: string | null; stages: string[]; sections: { id: number; name: string; color: string }[]; }
interface SectionMini { id: number; name: string; color: string; workflowPresetId: number | null; workflowPreset: { id: number; name: string } | null; }

function WorkflowTab() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sections, setSections] = useState<SectionMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/workflow-presets").then(r => r.ok ? r.json() : { presets: [] }),
      fetch("/api/admin/sections").then(r => r.ok ? r.json() : { sections: [] }),
    ]).then(([pd, sd]) => {
      setPresets(pd.presets ?? []);
      setSections(sd.sections ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async (data: Partial<Preset>) => {
    setSaving(true);
    try {
      if (editingId) {
        await fetch("/api/admin/workflow-presets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...data }) });
        setEditingId(null);
      } else {
        await fetch("/api/admin/workflow-presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        setShowCreate(false);
      }
      loadAll();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/workflow-presets?id=${id}`, { method: "DELETE" });
    setPresets(prev => prev.filter(p => p.id !== id));
    setConfirmDelete(null);
  };

  const assignPreset = async (sectionId: number, presetId: number | null) => {
    await fetch("/api/admin/sections", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sectionId, workflowPresetId: presetId }) });
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const preset = presets.find(p => p.id === presetId);
      return { ...s, workflowPresetId: presetId, workflowPreset: preset ? { id: preset.id, name: preset.name } : null };
    }));
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Workflow presets</p>
          <p className="text-xs text-[#737373]">Define reusable stage sets. Assign them to sections so each section follows its own editorial process.</p>
        </div>
        {!showCreate && !editingId && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer flex-shrink-0">
            <Plus className="w-3.5 h-3.5" /> New preset
          </button>
        )}
      </div>

      {(showCreate || editingId) && (
        <div className="mb-5">
          <PresetForm
            initial={editingId ? presets.find(p => p.id === editingId) : undefined}
            onSave={handleSave}
            onCancel={() => { setShowCreate(false); setEditingId(null); }}
            saving={saving}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 text-[#a3a3a3] animate-spin" /></div>
      ) : presets.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center mb-6">
          <p className="text-sm font-medium text-[#0a0a0a] mb-1">No workflow presets</p>
          <p className="text-xs text-[#a3a3a3]">Create presets like "Fast Track" (Draft → Published) or "Full Review" (all stages).</p>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {presets.map(preset => (
            <div key={preset.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0a0a0a]">{preset.name}</p>
                  {preset.description && <p className="text-xs text-[#737373] mt-0.5">{preset.description}</p>}
                </div>
                {confirmDelete === preset.id ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-[#737373]">Delete?</span>
                    <button onClick={() => handleDelete(preset.id)} className="px-2 py-0.5 rounded bg-[#F44444] text-white text-xs font-medium cursor-pointer">Yes</button>
                    <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 rounded border border-[#e5e5e5] text-xs cursor-pointer">No</button>
                  </div>
                ) : (
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => { setEditingId(preset.id); setShowCreate(false); }} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg text-[#a3a3a3] hover:text-[#525252] cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDelete(preset.id)} className="p-1.5 hover:bg-[#FFF0F0] rounded-lg text-[#a3a3a3] hover:text-[#F44444] cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <StagePipeline stages={preset.stages} />
              {preset.sections.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <span className="text-[10px] text-[#a3a3a3]">Used by:</span>
                  {preset.sections.map(s => (
                    <span key={s.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: s.color + "20", color: s.color }}>{s.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Section → Preset assignments */}
      {sections.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a] mb-1">Section assignments</p>
          <p className="text-xs text-[#737373] mb-4">Assign a workflow preset to each section. Articles in that section will follow the assigned stages.</p>
          <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
            {sections.map((section, i) => (
              <div key={section.id} className={`flex items-center gap-4 px-5 py-3.5 ${i < sections.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                <p className="text-sm font-medium text-[#0a0a0a] flex-1">{section.name}</p>
                <select
                  value={section.workflowPresetId ?? ""}
                  onChange={e => assignPreset(section.id, e.target.value ? Number(e.target.value) : null)}
                  className="text-xs bg-[#fafafa] border border-[#e5e5e5] rounded-lg px-2 py-1.5 outline-none focus:border-[#F44444] transition-all cursor-pointer"
                >
                  <option value="">Default (all stages)</option>
                  {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preset form ───────────────────────────────────────────────────────────────

function PresetForm({ initial, onSave, onCancel, saving }: {
  initial?: Partial<Preset>;
  onSave: (d: Partial<Preset>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [stages, setStages] = useState<string[]>(initial?.stages ?? ALL_STAGES.map(s => s.key));

  const toggleStage = (key: string, locked: boolean) => {
    if (locked) return;
    setStages(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Preset name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fast Track, Full Review"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all" autoFocus />
        </div>
        <div>
          <label className="text-xs font-medium text-[#525252] block mb-1.5">Description <span className="text-[#a3a3a3] font-normal">(optional)</span></label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description"
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#525252] block mb-2">Stages</label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ALL_STAGES.map(s => {
            const on = stages.includes(s.key);
            return (
              <button key={s.key} type="button" disabled={s.locked} onClick={() => toggleStage(s.key, s.locked)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer disabled:cursor-default"
                style={on ? { backgroundColor: s.color, color: "#fff" } : { backgroundColor: s.color + "15", color: s.color, opacity: 0.5 }}>
                {on && <Check className="w-2.5 h-2.5" />}
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#a3a3a3]">Preview:</span>
          <StagePipeline stages={stages} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-white cursor-pointer">Cancel</button>
        <button type="button" disabled={saving || !name.trim()} onClick={() => onSave({ name, description, stages })}
          className="px-3 py-1.5 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] disabled:opacity-40 cursor-pointer flex items-center gap-1.5">
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {initial?.id ? "Save changes" : "Create preset"}
        </button>
      </div>
    </div>
  );
}

// ─── Notifications Tab ─────────────────────────────────────────────────────────

const NOTIF_ITEMS = [
  {
    key:         "NEW_USER",
    icon:        Users,
    iconColor:   "#3b82f6",
    iconBg:      "#eff6ff",
    label:       "New user registration",
    description: "When a new user signs up to Albiz Media",
  },
  {
    key:         "CIRCLE_UPGRADE",
    icon:        ShieldCheck,
    iconColor:   "#8b5cf6",
    iconBg:      "#f5f3ff",
    label:       "Circle upgrade request",
    description: "When a user submits a Circle upgrade application",
  },
  {
    key:         "CONTENT_REPORT",
    icon:        Flag,
    iconColor:   "#F44444",
    iconBg:      "#fef2f2",
    label:       "Content report",
    description: "When a post or story is reported by a user",
  },
  {
    key:         "AUTHOR_REQUEST",
    icon:        UserCheck,
    iconColor:   "#10b981",
    iconBg:      "#f0fdf4",
    label:       "Author application",
    description: "When a user applies to become an author",
  },
  {
    key:         "SYSTEM",
    icon:        AlertCircle,
    iconColor:   "#f59e0b",
    iconBg:      "#fffbeb",
    label:       "System alerts",
    description: "Platform-level events such as bans and storage warnings",
  },
] as const;

type NotifPrefs = Record<string, boolean>;

const DEFAULT_PREFS: NotifPrefs = {
  NEW_USER:       true,
  CIRCLE_UPGRADE: true,
  CONTENT_REPORT: true,
  AUTHOR_REQUEST: true,
  SYSTEM:         true,
};

const LS_KEY = "albiz_admin_notif_prefs";

function readLocalPrefs(): NotifPrefs | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NotifPrefs;
  } catch { return null; }
}

function writeLocalPrefs(p: NotifPrefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${on ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

function NotificationsTab() {
  // Start from localStorage instantly (no flicker on refresh), fallback to defaults
  const [prefs, setPrefs]     = useState<NotifPrefs>(() => readLocalPrefs() ?? { ...DEFAULT_PREFS });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Sync with DB on mount; update state + localStorage if DB has newer data
  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { prefs: NotifPrefs }) => {
        const merged = { ...DEFAULT_PREFS, ...(d.prefs ?? {}) };
        setPrefs(merged);
        writeLocalPrefs(merged);
      })
      .catch(() => {});
  }, []);

  const savePrefs = async (next: NotifPrefs) => {
    const merged = { ...DEFAULT_PREFS, ...next };
    setPrefs(merged);
    writeLocalPrefs(merged);
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prefs: merged }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[NotificationsTab] save failed:", data);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.error("[NotificationsTab] save error:", err);
      setError(err?.message ?? "Save failed");
      setTimeout(() => setError(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: string, val: boolean) => savePrefs({ ...prefs, [key]: val });

  const enabledCount = NOTIF_ITEMS.filter(i => prefs[i.key] !== false).length;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a] mb-0.5">Push notifications</p>
          <p className="text-xs text-[#737373]">
            Choose which events create a notification in the admin panel.
            {" "}<span className="font-medium text-[#0a0a0a]">{enabledCount} of {NOTIF_ITEMS.length}</span> enabled.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => savePrefs(Object.fromEntries(NOTIF_ITEMS.map(i => [i.key, true])))}
            className="px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:border-[#d5d5d5] hover:text-[#0a0a0a] hover:bg-[#fafafa] transition-all cursor-pointer"
          >
            Enable all
          </button>
          <button
            onClick={() => savePrefs(Object.fromEntries(NOTIF_ITEMS.map(i => [i.key, false])))}
            className="px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:border-[#d5d5d5] hover:text-[#0a0a0a] hover:bg-[#fafafa] transition-all cursor-pointer"
          >
            Disable all
          </button>
          {saving && <Loader2 className="w-4 h-4 text-[#a3a3a3] animate-spin" />}
          {error  && !saving && <span className="text-xs text-[#F44444] font-medium" title={error}>Failed to save</span>}
        </div>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        {NOTIF_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const on   = prefs[item.key] !== false;
          return (
            <div
              key={item.key}
              className={`flex items-center gap-4 px-5 py-4 ${i < NOTIF_ITEMS.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: item.iconBg }}
              >
                <Icon className="w-4 h-4" style={{ color: item.iconColor }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${on ? "text-[#0a0a0a]" : "text-[#a3a3a3]"}`}>
                  {item.label}
                </p>
                <p className="text-xs text-[#a3a3a3] mt-0.5">{item.description}</p>
              </div>

              <Toggle on={on} onChange={val => toggle(item.key, val)} />
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [tab, setTab] = useState(0);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/sections")
      .then(r => r.ok ? r.json() : { sections: [] })
      .then(d => setSections(d.sections ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: Partial<Section>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error); return; }
      setShowCreate(false);
      load();
    } finally { setSaving(false); }
  };

  const handleEdit = async (data: Partial<Section>) => {
    if (!editingId) return;
    setSaving(true);
    try {
      await fetch("/api/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...data }),
      });
      setEditingId(null);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await fetch(`/api/admin/sections?id=${id}`, { method: "DELETE" });
      setSections(prev => prev.filter(s => s.id !== id));
      setConfirmDelete(null);
    } finally { setDeleting(null); }
  };

  const handleToggleActive = async (section: Section) => {
    await fetch("/api/admin/sections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: section.id, active: !section.active }),
    });
    setSections(prev => prev.map(s => s.id === section.id ? { ...s, active: !s.active } : s));
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <AdminPillTabs tabs={["Sections", "Workflow", "Notifications"]} activeTab={tab} onTabChange={setTab} />
      </div>

      {tab === 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#737373]">{sections.length} section{sections.length !== 1 ? "s" : ""} — articles are assigned to a section when published</p>
            {!showCreate && (
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> New section
              </button>
            )}
          </div>

          {showCreate && (
            <div className="mb-4">
              <SectionForm onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" /></div>
          ) : sections.length === 0 && !showCreate ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm font-medium text-[#0a0a0a] mb-1">No sections yet</p>
              <p className="text-xs text-[#a3a3a3]">Create sections to organise articles — e.g. Technology, Business, AI.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
              {sections.map((section, i) => (
                <div key={section.id}>
                  {editingId === section.id ? (
                    <div className="p-4">
                      <SectionForm
                        initial={section}
                        onSave={handleEdit}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    </div>
                  ) : (
                    <div className={`flex items-center gap-4 px-5 py-3.5 group ${i < sections.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#0a0a0a]">{section.name}</p>
                          {!section.active && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#f5f5f5] text-[#a3a3a3]">Inactive</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#a3a3a3] font-mono">{section.slug}</p>
                        {section.description && <p className="text-xs text-[#737373] mt-0.5 truncate">{section.description}</p>}
                      </div>

                      {/* Toggle active */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(section)}
                        className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${section.active ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${section.active ? "left-4" : "left-0.5"}`} />
                      </button>

                      {confirmDelete === section.id ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs text-[#737373]">Delete?</span>
                          <button onClick={() => handleDelete(section.id)} disabled={deleting === section.id}
                            className="px-2 py-0.5 rounded bg-[#F44444] text-white text-xs font-medium cursor-pointer disabled:opacity-50">
                            {deleting === section.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 rounded border border-[#e5e5e5] text-xs text-[#525252] cursor-pointer hover:bg-[#fafafa]">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(section.id); setShowCreate(false); }}
                            className="p-1.5 hover:bg-[#f5f5f5] rounded-lg text-[#a3a3a3] hover:text-[#525252] transition-colors cursor-pointer">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(section.id)}
                            className="p-1.5 hover:bg-[#FFF0F0] rounded-lg text-[#a3a3a3] hover:text-[#F44444] transition-colors cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 1 && <WorkflowTab />}
      {tab === 2 && <NotificationsTab />}
    </div>
  );
}
