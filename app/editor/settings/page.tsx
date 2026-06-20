"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Plus, Check } from "lucide-react";
import { useEditorContext } from "../layout";
import Link from "next/link";

interface Template {
  id: number;
  text: string;
}

interface Section {
  id: number;
  name: string;
  color: string;
  canPublish: boolean;
}

const NOTE_TYPES = [
  { value: "general",   label: "General",   color: "#525252", bg: "#f5f5f5" },
  { value: "factual",   label: "Factual",   color: "#D97706", bg: "#FFFBEB" },
  { value: "style",     label: "Style",     color: "#8B5CF6", bg: "#F5F3FF" },
  { value: "grammar",   label: "Grammar",   color: "#0EA5E9", bg: "#F0F9FF" },
  { value: "structure", label: "Structure", color: "#F44444", bg: "#FFF5F5" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative", flexShrink: 0, width: 44, height: 24, borderRadius: 12,
        border: "none", padding: 0, cursor: "pointer",
        backgroundColor: on ? "#0EA5E9" : "#d4d4d4",
        transition: "background-color 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: 3, width: 18, height: 18,
        borderRadius: "50%", backgroundColor: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transform: on ? "translateX(20px)" : "translateX(0)",
        transition: "transform 0.15s",
      }} />
    </button>
  );
}

export default function EditorSettings() {
  const { user } = useEditorContext();

  const [defaultNoteType, setDefaultNoteType] = useState("general");
  const [defaultNotePriority, setDefaultNotePriority] = useState("minor");
  const [notifyOnSubmit, setNotifyOnSubmit] = useState(true);
  const [notifyOnResolve, setNotifyOnResolve] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplate, setNewTemplate] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(false);

  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    fetch("/api/editor/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.preferences) return;
        setDefaultNoteType(d.preferences.defaultNoteType);
        setDefaultNotePriority(d.preferences.defaultNotePriority);
        setNotifyOnSubmit(d.preferences.notifyOnSubmit);
        setNotifyOnResolve(d.preferences.notifyOnResolve);
      });

    fetch("/api/editor/templates")
      .then(r => r.ok ? r.json() : { templates: [] })
      .then(d => setTemplates(d.templates ?? []));

    Promise.all([
      fetch("/api/auth/session").then(r => r.json()),
      fetch("/api/admin/sections").then(r => r.ok ? r.json() : { sections: [] }),
    ]).then(([sessionData, sectionsData]) => {
      const editorSections: { sectionId: number; canPublish: boolean }[] = sessionData.user?.editorSections ?? [];
      const allSections: { id: number; name: string; color: string }[] = sectionsData.sections ?? [];
      setSections(
        editorSections.map(es => {
          const s = allSections.find(sec => sec.id === es.sectionId);
          return { id: es.sectionId, name: s?.name ?? `Section ${es.sectionId}`, color: s?.color ?? "#525252", canPublish: es.canPublish };
        })
      );
    });
  }, []);

  const savePrefs = (patch: Record<string, unknown>) => {
    fetch("/api/editor/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(() => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    });
  };

  const addTemplate = async () => {
    const text = newTemplate.trim();
    if (!text) return;
    setAddingTemplate(true);
    try {
      const res = await fetch("/api/editor/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok && data.template) {
        setTemplates(prev => [data.template, ...prev]);
        setNewTemplate("");
      }
    } finally {
      setAddingTemplate(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/editor/templates/${id}`, { method: "DELETE" });
  };

  return (
    <div className="p-8 max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0a0a0a]">Settings</p>
        {savedFlash && (
          <span className="flex items-center gap-1 text-xs text-[#16a34a]">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* Review defaults */}
      <div className="rounded-xl border border-[#f0f0f0] bg-white p-5">
        <p className="text-xs font-semibold text-[#525252] mb-1">Review defaults</p>
        <p className="text-xs text-[#a3a3a3] mb-4">New notes start with these settings.</p>

        <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Note type</p>
        <div className="flex gap-1.5 flex-wrap mb-4">
          {NOTE_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setDefaultNoteType(t.value); savePrefs({ defaultNoteType: t.value }); }}
              className="text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer"
              style={
                defaultNoteType === t.value
                  ? { background: t.bg, color: t.color, borderColor: t.color }
                  : { background: "white", color: "#737373", borderColor: "#e5e5e5" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">Priority</p>
        <div className="flex gap-1.5">
          {(["minor", "major"] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setDefaultNotePriority(p); savePrefs({ defaultNotePriority: p }); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all capitalize cursor-pointer ${
                defaultNotePriority === p
                  ? p === "major"
                    ? "bg-[#FFF0F0] border-[#FFD4D4] text-[#F44444]"
                    : "bg-white border-[#d4d4d4] text-[#0a0a0a]"
                  : "bg-white border-[#e5e5e5] text-[#a3a3a3] hover:border-[#d4d4d4]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Note templates */}
      <div className="rounded-xl border border-[#f0f0f0] bg-white p-5">
        <p className="text-xs font-semibold text-[#525252] mb-1">Note templates</p>
        <p className="text-xs text-[#a3a3a3] mb-4">Reusable feedback you can drop into any review.</p>

        <div className="flex items-center gap-2 mb-3">
          <input
            value={newTemplate}
            onChange={e => setNewTemplate(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTemplate(); }}
            placeholder="Add a reusable note…"
            maxLength={280}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#fafafa] border border-[#e5e5e5] outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/10 transition-all"
          />
          <button
            onClick={addTemplate}
            disabled={addingTemplate || !newTemplate.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#0EA5E9] text-white text-xs font-medium hover:bg-[#0284c7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {addingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="text-xs text-[#a3a3a3]">No templates yet.</p>
        ) : (
          <div className="space-y-1.5">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#f0f0f0] bg-[#fafafa]">
                <span className="flex-1 text-sm text-[#374151] leading-snug">{t.text}</span>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="text-[#a3a3a3] hover:text-[#F44444] transition-colors flex-shrink-0 cursor-pointer"
                  title="Delete template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-[#f0f0f0] bg-white p-5">
        <p className="text-xs font-semibold text-[#525252] mb-4">Notifications</p>
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm text-[#0a0a0a]">New article submitted</p>
            <p className="text-xs text-[#a3a3a3]">Notify me when an article enters my queue.</p>
          </div>
          <Toggle on={notifyOnSubmit} onClick={() => { const v = !notifyOnSubmit; setNotifyOnSubmit(v); savePrefs({ notifyOnSubmit: v }); }} />
        </div>
        <div className="flex items-center justify-between py-1 mt-2 pt-3 border-t border-[#f0f0f0]">
          <div>
            <p className="text-sm text-[#0a0a0a]">Note resolved</p>
            <p className="text-xs text-[#a3a3a3]">Notify me when an author resolves one of my notes.</p>
          </div>
          <Toggle on={notifyOnResolve} onClick={() => { const v = !notifyOnResolve; setNotifyOnResolve(v); savePrefs({ notifyOnResolve: v }); }} />
        </div>
      </div>

      {/* Your sections */}
      {sections.length > 0 && (
        <div className="rounded-xl border border-[#f0f0f0] bg-white p-5">
          <p className="text-xs font-semibold text-[#525252] mb-4">Your sections</p>
          <div className="space-y-2">
            {sections.map(s => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#f0f0f0]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-sm text-[#0a0a0a]">{s.name}</span>
                </div>
                {s.canPublish && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#0EA5E9]">Can publish</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account */}
      {user && (
        <div className="rounded-xl border border-[#f0f0f0] bg-white p-5">
          <p className="text-xs font-semibold text-[#525252] mb-4">Account</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f0f0f0] overflow-hidden flex-shrink-0 flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-[#525252]">{user.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[#0a0a0a]">{user.name}</p>
              <p className="text-xs text-[#a3a3a3]">@{user.handle}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
            <p className="text-xs text-[#a3a3a3]">
              To update your profile or change your password, visit your{" "}
              <Link href="/settings" className="text-[#0EA5E9] hover:underline">account settings</Link>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
