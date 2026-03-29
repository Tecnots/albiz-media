"use client";

import { useState, useEffect } from "react";
import { Plus, X, Check, Loader2, Pencil } from "lucide-react";
import { AdminPillTabs } from "../admin-components";

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

// ─── Workflow config ───────────────────────────────────────────────────────────

const ALL_STAGES = [
  { key: "draft",              label: "Draft",            color: "#525252", locked: true },
  { key: "submitted",          label: "Submitted",        color: "#3B82F6", locked: false },
  { key: "under_review",       label: "Under Review",     color: "#F59E0B", locked: false },
  { key: "revision_requested", label: "Revision Requested", color: "#F44444", locked: false },
  { key: "approved",           label: "Approved",         color: "#22c55e", locked: false },
  { key: "published",          label: "Published",        color: "#22c55e", locked: true },
];

const LS_KEY = "albiz_workflow_stages";

function WorkflowTab() {
  const [enabled, setEnabled] = useState<string[]>(() => {
    if (typeof window === "undefined") return ALL_STAGES.map(s => s.key);
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? JSON.parse(stored) : ALL_STAGES.map(s => s.key);
    } catch { return ALL_STAGES.map(s => s.key); }
  });

  const toggle = (key: string) => {
    setEnabled(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="max-w-xl">
      <p className="text-xs text-[#737373] mb-5">
        Control which workflow stages appear in the editorial queue and are visible to authors. Draft and Published are always active.
      </p>

      {/* Pipeline preview */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {ALL_STAGES.filter(s => enabled.includes(s.key)).map((s, i, arr) => (
          <div key={s.key} className="flex items-center gap-1">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: s.color + "20", color: s.color }}>{s.label}</span>
            {i < arr.length - 1 && <span className="text-[#d5d5d5] text-xs">→</span>}
          </div>
        ))}
      </div>

      {/* Toggles */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        {ALL_STAGES.map((stage, i) => (
          <div key={stage.key} className={`flex items-center gap-4 px-5 py-3.5 ${i < ALL_STAGES.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#0a0a0a]">{stage.label}</p>
              {stage.locked && <p className="text-[10px] text-[#a3a3a3]">Always active</p>}
            </div>
            <button
              type="button"
              disabled={stage.locked}
              onClick={() => toggle(stage.key)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default flex-shrink-0 ${enabled.includes(stage.key) ? "bg-[#F44444]" : "bg-[#e5e5e5]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled.includes(stage.key) ? "left-4" : "left-0.5"}`} />
            </button>
          </div>
        ))}
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
        <AdminPillTabs tabs={["Sections", "Workflow"]} activeTab={tab} onTabChange={setTab} />
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
    </div>
  );
}
