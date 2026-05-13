"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Circle, Check, ChevronDown } from "lucide-react";

// ─── AlbizLogo (copied from template-page.tsx) ───
export function AlbizLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * (104 / 121)} viewBox="0 0 121 104" fill="none">
      <path d="M71.9121 20.311L59.8833 0L9.15527e-05 103.861H23.2838L71.9121 20.311Z" fill="#FF4444" />
      <path d="M96.0998 62.0821L83.9408 41.9091L47.9848 103.861H71.9121L96.0998 62.0821Z" fill="#FF4444" />
      <path d="M120.15 103.861L108.381 83.2972L96.0998 103.861H120.15Z" fill="#FF4444" />
      <path d="M108.058 83.3157L96.1438 62.4531L84.0538 83.3157L96.1438 103.795L108.058 83.3157Z" fill="#AF1212" />
      <path d="M47.661 62.4531L60.0422 83.3157L47.661 103.795L35.7549 82.5496L47.661 62.4531Z" fill="#AF1212" />
    </svg>
  );
}

// ─── VerifiedBadge ───
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Circle className="w-3.5 h-3.5 fill-[#F44444] text-[#F44444]" />
      <Check className="w-2 h-2 text-white absolute" strokeWidth={3} />
    </span>
  );
}

// ─── Sparkline ───
export function Sparkline({ data, color = "#F44444", width = 80, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// ─── AdminStatCard ───
export function AdminStatCard({ label, value, change, up, sparkline }: { label: string; value: string; change: number; up: boolean; sparkline: number[] }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 bg-white">
      <p className="text-xs text-[#737373] mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#0a0a0a]">{value}</span>
          <span className={`text-[11px] font-medium flex items-center gap-0.5 ${up ? "text-[#22c55e]" : "text-[#F44444]"}`}>
            {up ? "▲" : "▼"} {change}%
          </span>
        </div>
        <Sparkline data={sparkline} color={up ? "#F44444" : "#a3a3a3"} width={60} height={24} />
      </div>
    </div>
  );
}

// ─── AdminPillTabs ───
export function AdminPillTabs({ tabs, activeTab, onTabChange }: { tabs: string[]; activeTab: number; onTabChange: (i: number) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onTabChange(i)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            i === activeTab
              ? "bg-[#F44444] text-white"
              : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] border border-[#e5e5e5]"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── StatusBadge ───
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-[#22c55e]/10 text-[#22c55e]",
    published: "bg-[#22c55e]/10 text-[#22c55e]",
    banned: "bg-[#F44444]/10 text-[#F44444]",
    flagged: "bg-[#F59E0B]/10 text-[#D97706]",
    pending: "bg-[#F59E0B]/10 text-[#D97706]",
    draft: "bg-[#525252]/10 text-[#525252]",
    featured: "bg-[#F44444]/10 text-[#F44444]",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${styles[status] || "bg-[#f5f5f5] text-[#525252]"}`}>
      {status}
    </span>
  );
}

// ─── RoleBadge ───
export function RoleBadge({ role }: { role: "CIRCLE" | "NORMAL" }) {
  return role === "CIRCLE" ? (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF0F0] text-[#F44444]">Circle</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f0f0f0] text-[#525252]">Normal</span>
  );
}

// ─── AdminChart ───
export function AdminChart({ data, title, color = "#F44444" }: { data: { date: string; value: number }[]; title: string; color?: string }) {
  const max = Math.max(...data.map(d => d.value));
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const w = 500;
  const h = 220;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * innerW,
    y: padding.top + innerH - (d.value / max) * innerH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  const xLabels = data.filter((_, i) => i % Math.ceil(data.length / 5) === 0 || i === data.length - 1).map(d => d.date);

  return (
    <div className="rounded-xl border border-[#e5e5e5] p-4 bg-white">
      <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">{title}</span>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`grad-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${title.replace(/\s/g, "")})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />
        ))}
        {xLabels.map((label, i) => {
          const x = padding.left + (i / (xLabels.length - 1)) * innerW;
          return (
            <text key={i} x={x} y={h - 6} textAnchor="middle" className="fill-[#a3a3a3]" style={{ fontSize: "9px" }}>
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── AdminModal ───
export function AdminModal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.15, bounce: 0.15 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5] flex-shrink-0 bg-white z-10">
              <h3 className="font-semibold text-[#0a0a0a]">{title}</h3>
              <button onClick={onClose} className="p-1.5 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#737373]" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 scrollbar-hide">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Dropdown ───

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  badge?: { label: string; color: string; bg: string };
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  isStatic = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  isStatic?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#fafafa] border border-[#e5e5e5] text-sm text-left hover:bg-[#f5f5f5] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 min-w-0 overflow-hidden">
          {selected?.badge && (
            <span style={{ background: selected.badge.bg, color: selected.badge.color }} className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
              {selected.badge.label}
            </span>
          )}
          <span className="text-sm text-[#0a0a0a] font-medium truncate">
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#a3a3a3] flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={isStatic ? { opacity: 0, height: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={isStatic ? { opacity: 1, height: "auto" } : { opacity: 1, y: 0, scale: 1 }}
            exit={isStatic ? { opacity: 0, height: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", duration: 0.15, bounce: 0 }}
            className={`${isStatic ? "relative mt-1 bg-transparent border-none shadow-none" : "absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)]"} overflow-y-auto max-h-[240px] py-1`}
          >
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer hover:bg-[#fafafa] rounded-lg ${value === o.value ? "bg-[#fafafa]" : ""}`}
              >
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[13px] font-medium text-[#0a0a0a] truncate">{o.label}</span>
                  {o.description && <span className="text-[11px] text-[#737373] truncate">{o.description}</span>}
                </div>
                {value === o.value && <Check className="w-4 h-4 text-[#F44444] flex-shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── UserAvatar ───
export function UserAvatar({ src, alt, size = 40 }: { src?: string; alt: string; size?: number }) {
  if (!src || src === '') {
    // Show a default avatar when no src is provided
    return (
      <div className="rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5] bg-[#f5f5f5] flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-[#737373] font-medium" style={{ fontSize: size * 0.4 }}>
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]" style={{ width: size, height: size }}>
      <Image src={src} alt={alt} width={size} height={size} className="object-cover w-full h-full" />
    </div>
  );
}
