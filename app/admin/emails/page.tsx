"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, Check } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  subject: string;
  html: string;
}

export default function AdminEmailsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  // Test send state
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "success" | "error">("idle");
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    fetch("/api/admin/email-templates")
      .then(r => r.json())
      .then(data => {
        setTemplates(data.templates ?? []);
        if (data.templates?.length) setSelected(data.templates[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSendTest = async () => {
    if (!testEmail.trim() || !selected) return;
    setSending(true);
    setSendStatus("idle");
    setSendError("");
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected.id, to: testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendStatus("success");
        setTimeout(() => setSendStatus("idle"), 3000);
      } else {
        setSendStatus("error");
        setSendError(data.error || "Failed to send");
      }
    } catch {
      setSendStatus("error");
      setSendError("Connection error");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-[#a3a3a3] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Template list */}
      <div className="w-64 flex-shrink-0 border-r border-[#e5e5e5] bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-[#e5e5e5]">
          <p className="text-sm font-semibold text-[#0a0a0a]">Email templates</p>
          <p className="text-xs text-[#737373] mt-0.5">Sent from support@tecnots.com</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelected(t); setSendStatus("idle"); setSendError(""); }}
              className={`w-full text-left px-5 py-3.5 transition-colors ${
                selected?.id === t.id
                  ? "bg-[#fafafa] border-l-2 border-[#F44444]"
                  : "border-l-2 border-transparent hover:bg-[#fafafa]"
              }`}
            >
              <p className={`text-sm font-medium ${selected?.id === t.id ? "text-[#0a0a0a]" : "text-[#262626]"}`}>{t.name}</p>
              <p className="text-xs text-[#737373] mt-0.5 truncate">{t.description}</p>
            </button>
          ))}
        </nav>
      </div>

      {/* Preview + send panel */}
      {selected && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header bar */}
          <div className="px-6 py-4 border-b border-[#e5e5e5] bg-white flex items-center justify-between gap-4 flex-shrink-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0a0a0a] truncate">{selected.name}</p>
              <p className="text-xs text-[#737373] truncate">Subject: {selected.subject}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="email"
                value={testEmail}
                onChange={e => { setTestEmail(e.target.value); setSendStatus("idle"); setSendError(""); }}
                placeholder="Send test to…"
                onKeyDown={e => { if (e.key === "Enter") handleSendTest(); }}
                className="px-3 py-1.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm outline-none focus:border-[#F44444] focus:ring-1 focus:ring-[#F44444]/20 transition-all w-52 placeholder:text-[#a3a3a3]"
              />
              <button
                onClick={handleSendTest}
                disabled={sending || !testEmail.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : sendStatus === "success" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sendStatus === "success" ? "Sent" : "Send test"}
              </button>
            </div>
          </div>

          {sendStatus === "error" && (
            <div className="px-6 py-2 bg-[#FFF0F0] border-b border-[#fecaca]">
              <p className="text-xs text-[#F44444]">{sendError}</p>
            </div>
          )}

          {/* Preview iframe */}
          <div className="flex-1 overflow-hidden">
            <iframe
              key={selected.id}
              srcDoc={selected.html}
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
              title={`Preview: ${selected.name}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
