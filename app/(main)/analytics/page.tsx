"use client";

import Image from "next/image";
import { useState, useContext, useEffect } from "react";
import AudienceGlobe from "./AudienceGlobe";
import {
  UserPlus, TrendingUp, ArrowUpRight, ArrowDownRight,
  Smartphone, Monitor, ChevronDown, X, HelpCircle, ChevronLeft,
} from "lucide-react";
import { AuthContext } from "@/app/lib/contexts";
import { api } from "@/app/lib/api";
import { Sparkline, SuggestedProfiles } from "@/app/lib/shared-components";
import {
  ResponsiveContainer, AreaChart as RechartArea, Area,
  XAxis, CartesianGrid, Tooltip as RechartTooltip,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeSeriesPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  viewHours?:    number[]; // local hours (0-23) of each view (impression) event this bucket
  likeHours?:    number[]; // local hours (0-23) of each like event this bucket
  commentHours?: number[]; // local hours (0-23) of each comment event this bucket
  shareHours?:   number[]; // local hours (0-23) of each share event this bucket
}

interface ReachStats {
  totalImpressions: number;
  avgImpressionsPerPost: number;
  engagementRate: number;
  impressionsChange: number;
  engagementRateChange: number;
  avgPerPostChange: number;
}

// ── Demo data (shown when no real posts yet) ───────────────────────────────────


const defaultOverviewStats: Array<{
  label: string; value: string; change: number; up: boolean; sparkline: number[];
  breakdown?: { label: string; value: string | number }[];
}> = [
  { label: "Total views", value: "0", change: 0, up: true, sparkline: Array(12).fill(0) },
  { label: "Total likes", value: "0", change: 0, up: true, sparkline: Array(12).fill(0) },
  { label: "Followers",   value: "0", change: 0, up: true, sparkline: Array(12).fill(0) },
  { label: "Engagement",  value: "0.0%", change: 0, up: true, sparkline: Array(12).fill(0) },
];

const defaultEngagementBreakdown = [
  { label: "Likes",    value: 0, pct: 0, color: "#F44444" },
  { label: "Comments", value: 0, pct: 0, color: "#525252" },
  { label: "Shares",   value: 0, pct: 0, color: "#22c55e" },
];

const defaultReach: ReachStats = {
  totalImpressions: 0,
  avgImpressionsPerPost: 0,
  engagementRate: 0,
  impressionsChange: 0,
  engagementRateChange: 0,
  avgPerPostChange: 0,
};

const DEMO_GLOBE_COUNTRIES = (
  ["United States", "India", "United Kingdom", "Brazil", "Germany",
   "Canada", "Australia", "France", "Japan", "Nigeria", "South Korea", "Singapore"] as const
).map((name, i) => {
  const counts = [42, 24, 16, 11, 8, 7, 6, 5, 4, 3, 3, 2];
  const total = 131;
  return { name, count: counts[i], pct: Math.round((counts[i] / total) * 100) };
});

// ── Stat card sparkline (Recharts mini area, no axes) ────────────────────────

function StatSparkline({ data, color = "#F44444", width = 72, height = 28 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  const chartData = data.map((v, i) => ({ i, v }));
  const gradId = `sp-${color.replace("#", "")}-${width}`;
  return (
    <div style={{ width, height, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartArea data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </RechartArea>
      </ResponsiveContainer>
    </div>
  );
}

// ── Chart: Recharts area ──────────────────────────────────────────────────────

function ViewsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#e5e5e5] bg-white shadow-sm px-3 py-2 pointer-events-none">
      <p className="text-xs font-semibold text-[#0a0a0a]">{payload[0].value.toLocaleString()} views</p>
      <p className="text-[10px] text-[#a3a3a3] mt-0.5">{label}</p>
    </div>
  );
}

function ViewsActiveDot({ cx, cy, fill }: any) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={fill} fillOpacity={0.12} />
      <circle cx={cx} cy={cy} r={4} fill={fill} />
      <circle cx={cx} cy={cy} r={2} fill="#fff" />
    </g>
  );
}

function AreaChart({
  data,
  color = "#F44444",
  height = 180,
}: {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-xs text-[#c0c0c0]" style={{ height }}>
        No data for this period
      </div>
    );
  }

  const gradId = `ac-${color.replace("#", "")}`;
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartArea
          data={data}
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f0f0f0" strokeDasharray="" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#a3a3a3", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={labelEvery - 1}
          />
          <RechartTooltip
            content={<ViewsTooltip />}
            cursor={{ stroke: "#e5e5e5", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={<ViewsActiveDot fill={color} />}
            isAnimationActive={true}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </RechartArea>
      </ResponsiveContainer>
    </div>
  );
}

// ── Hourly distribution helpers ────────────────────────────────────────────────

// Realistic social media engagement curve: low overnight, twin peaks ~9am and 7pm
const HOUR_WEIGHTS = [
  0.4, 0.2, 0.1, 0.1, 0.2, 0.5,  // 12am–5am
  1.0, 2.0, 3.2, 4.0, 3.5, 2.8,  // 6am–11am
  2.2, 1.9, 1.7, 2.0, 2.4, 3.0,  // 12pm–5pm
  4.5, 5.0, 4.2, 3.0, 1.8, 0.9,  // 6pm–11pm
];

const MINUTE_WEIGHTS = [1.0, 1.4, 1.6, 1.5, 1.2, 1.1, 1.0, 0.9, 0.8, 0.9, 1.1, 1.3];

// Distributes `total` integer units across slots using the largest-remainder method
// so the sum is always exactly `total` (no rounding loss)
function distributeIntegers(total: number, weights: number[]): number[] {
  if (total === 0) return weights.map(() => 0);
  const wSum = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map(w => (total * w) / wSum);
  const floored = raw.map(Math.floor);
  let remainder = total - floored.reduce((s, v) => s + v, 0);
  // Give remaining units to the slots with the highest fractional parts
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let r = 0; r < remainder; r++) floored[order[r].i]++;
  return floored;
}

interface HourPoint {
  hour: number;
  label: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

interface MinutePoint {
  label: string;
  likes: number;
  comments: number;
  shares: number;
}

// "7pm", "12am", "3am" — compact label for hourly chart x-axis
function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

// "7:00 PM", "3:30 AM" — full label for headings and tooltips
function formatHourFull(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

// "7:05 PM" — absolute minute-level time label
function formatMinuteTime(h: number, minuteIndex: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(minuteIndex * 5).padStart(2, "0")} ${suffix}`;
}

function buildHourArray(hours: number[] | undefined, total: number): number[] {
  if (hours && hours.length > 0) {
    const arr = Array(24).fill(0);
    hours.forEach(h => { arr[h]++; });
    return arr;
  }
  return distributeIntegers(total, HOUR_WEIGHTS);
}

function generateHourlyData(day: TimeSeriesPoint): HourPoint[] {
  const viewsH    = buildHourArray(day.viewHours,    day.views);
  const likesH    = buildHourArray(day.likeHours,    day.likes);
  const commentsH = buildHourArray(day.commentHours, day.comments);
  const sharesH   = buildHourArray(day.shareHours,   day.shares);

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: formatHour(h),
    views:    viewsH[h],
    likes:    likesH[h],
    comments: commentsH[h],
    shares:   sharesH[h],
  }));
}

function generateMinuteData(hourData: HourPoint): MinutePoint[] {
  const h = hourData.hour;
  const likesM    = distributeIntegers(hourData.likes,    MINUTE_WEIGHTS);
  const commentsM = distributeIntegers(hourData.comments, MINUTE_WEIGHTS);
  const sharesM   = distributeIntegers(hourData.shares,   MINUTE_WEIGHTS);
  return Array.from({ length: 12 }, (_, i) => ({
    label: formatMinuteTime(h, i),
    likes: likesM[i],
    comments: commentsM[i],
    shares: sharesM[i],
  }));
}

// ── Chart: stacked bar (shared renderer) ──────────────────────────────────────

interface BarPoint {
  label: string;
  likes: number;
  comments: number;
  shares: number;
  dimmed?: boolean;
  selected?: boolean;
}

function StackedBarChart({
  data,
  height = 140,
  onBarClick,
  selectedIndex,
  compactLabels = false,
  labelEveryOverride,
}: {
  data: BarPoint[];
  height?: number;
  onBarClick?: (index: number) => void;
  selectedIndex?: number | null;
  compactLabels?: boolean;
  labelEveryOverride?: number;
}) {
  const w = 500;
  const pad = { top: 12, right: 10, bottom: compactLabels ? 22 : 28, left: 28 };
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map(d => d.likes + d.comments + d.shares), 1);
  const barCount = data.length;
  const barSpacing = innerW / barCount;
  const barW = Math.min(barSpacing * 0.6, 20);
  const ySteps = 3;
  const labelEvery = labelEveryOverride ?? (compactLabels ? Math.ceil(barCount / 8) : Math.ceil(barCount / 6));
  const hasSelection = selectedIndex !== null && selectedIndex !== undefined;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ cursor: onBarClick ? "pointer" : "default" }}
    >
      {Array.from({ length: ySteps + 1 }, (_, gi) => {
        const val = Math.round((maxVal * gi) / ySteps);
        const y = pad.top + innerH - (val / maxVal) * innerH;
        return (
          <g key={gi}>
            <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="#f0f0f0" strokeWidth="1" />
            <text x={pad.left - 4} y={y + 3} textAnchor="end" fill="#c0c0c0" fontSize="8">
              {val > 0 ? val : ""}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const cx = pad.left + i * barSpacing + barSpacing / 2;
        const x = cx - barW / 2;
        const bottom = pad.top + innerH;
        const isSelected = selectedIndex === i;
        const isDimmed = hasSelection && !isSelected;
        const opacity = isDimmed ? 0.3 : 1;

        const sharesH = (d.shares / maxVal) * innerH;
        const commentsH = (d.comments / maxVal) * innerH;
        const likesH = (d.likes / maxVal) * innerH;

        const sharesY = bottom - sharesH;
        const commentsY = sharesY - commentsH;
        const likesY = commentsY - likesH;

        const showLabel = i % labelEvery === 0 || i === barCount - 1;

        return (
          <g
            key={i}
            onClick={() => onBarClick?.(i)}
            style={{ opacity }}
          >
            {/* Invisible hit area for easier clicking */}
            <rect
              x={cx - barSpacing / 2}
              y={pad.top}
              width={barSpacing}
              height={innerH}
              fill="transparent"
            />
            {isSelected && (
              <rect
                x={cx - barSpacing / 2 + 1}
                y={pad.top}
                width={barSpacing - 2}
                height={innerH}
                fill="#f5f5f5"
                rx="2"
              />
            )}
            {sharesH > 0.5 && <rect x={x} y={sharesY} width={barW} height={sharesH} fill="#22c55e" rx="1" />}
            {commentsH > 0.5 && <rect x={x} y={commentsY} width={barW} height={commentsH} fill="#737373" rx="1" />}
            {likesH > 0.5 && <rect x={x} y={likesY} width={barW} height={likesH} fill="#F44444" rx="1" />}
            {showLabel && (
              <text x={cx} y={height - 4} textAnchor="middle" fill={isSelected ? "#525252" : "#a3a3a3"} fontSize="8" fontWeight={isSelected ? "600" : "normal"}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Daily engagement chart (wraps StackedBarChart with data mapping) ──────────

function EngagementChart({
  data,
  height = 160,
  onBarClick,
  selectedIndex,
}: {
  data: TimeSeriesPoint[];
  height?: number;
  onBarClick?: (index: number) => void;
  selectedIndex?: number | null;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-xs text-[#c0c0c0]" style={{ height }}>
        No data for this period
      </div>
    );
  }

  const bars: BarPoint[] = data.map(d => ({
    label: d.date,
    likes: d.likes,
    comments: d.comments,
    shares: d.shares,
  }));

  return (
    <StackedBarChart
      data={bars}
      height={height}
      onBarClick={onBarClick}
      selectedIndex={selectedIndex}
    />
  );
}

// ── Day detail panel (hourly + minute breakdown) ───────────────────────────────

function DayDetailPanel({
  day,
  onClose,
}: {
  day: TimeSeriesPoint;
  onClose: () => void;
}) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const hourlyData = generateHourlyData(day);
  const hourTotal = (h: HourPoint) => h.views + h.likes + h.comments + h.shares;
  const peakHour = hourlyData.reduce((best, h) => hourTotal(h) > hourTotal(best) ? h : best, hourlyData[0]);

  const minuteData: MinutePoint[] = selectedHour !== null
    ? generateMinuteData(hourlyData[selectedHour])
    : [];

  const totalEngagement = day.views + day.likes + day.comments + day.shares;

  const hourBars: BarPoint[] = hourlyData.map(h => ({
    label: h.label,
    likes: h.views + h.likes,   // views shown alongside likes in hourly chart
    comments: h.comments,
    shares: h.shares,
  }));

  const minuteBars: BarPoint[] = minuteData.map(m => ({
    label: m.label,
    likes: m.likes,
    comments: m.comments,
    shares: m.shares,
  }));

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#0a0a0a]">{day.date}</span>
          <div className="flex items-center gap-3 text-xs text-[#a3a3a3]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#525252]" />{day.views} views
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F44444]" />{day.likes} likes
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#737373]" />{day.comments} comments
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />{day.shares} shares
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#f5f5f5] text-[#a3a3a3] hover:text-[#525252] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Peak callout */}
        {totalEngagement > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex-1 rounded-lg bg-[#fafafa] px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-[#737373]">Peak hour</span>
              <span className="text-xs font-semibold text-[#0a0a0a]">
                {formatHourFull(peakHour.hour)} · {hourTotal(peakHour)} interactions
              </span>
            </div>
            <div className="flex-1 rounded-lg bg-[#fafafa] px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-[#737373]">Total</span>
              <span className="text-xs font-semibold text-[#0a0a0a]">{totalEngagement} interactions</span>
            </div>
          </div>
        )}

        {/* Hourly chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#525252]">Hourly breakdown</span>
            {selectedHour !== null && (
              <button
                onClick={() => setSelectedHour(null)}
                className="text-[11px] text-[#a3a3a3] hover:text-[#525252]"
              >
                Clear selection
              </button>
            )}
          </div>
          {totalEngagement === 0 ? (
            <div className="h-20 flex items-center justify-center text-xs text-[#c0c0c0]">
              No engagement on this day
            </div>
          ) : (
            <StackedBarChart
              data={hourBars}
              height={110}
              onBarClick={setSelectedHour}
              selectedIndex={selectedHour}
              compactLabels
            />
          )}
        </div>

        {/* Minute breakdown for selected hour */}
        {selectedHour !== null && (
          <div className="border-t border-[#f5f5f5] pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#525252]">
                {formatHourFull(selectedHour)} — 5-minute intervals
              </span>
              <span className="text-xs text-[#a3a3a3]">
                {hourTotal(hourlyData[selectedHour])} interactions
              </span>
            </div>
            {(hourTotal(hourlyData[selectedHour])) === 0 ? (
              <div className="h-16 flex items-center justify-center text-xs text-[#c0c0c0]">
                No activity this hour
              </div>
            ) : (
              <StackedBarChart
                data={minuteBars}
                height={100}
                compactLabels
                labelEveryOverride={2}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tabs / date ranges ────────────────────────────────────────────────────────

const tabs = ["Overview", "Content", "Audience", "Reach"];

const dateRanges = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
  { label: "All time", days: null },
];

// ── Post Analytics Detail ─────────────────────────────────────────────────────

function AlgoSignalCard({ label, value, sub, color, tip }: { label: string; value: string; sub: string; color: string; tip: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-[#fafafa] p-3 relative">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] text-[#a3a3a3]">{label}</p>
        <button onClick={() => setOpen(v => !v)} className="text-[#c0c0c0] hover:text-[#737373] transition-colors">
          <HelpCircle className="w-3 h-3" />
        </button>
      </div>
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
      <p className="text-[10px] text-[#a3a3a3] mt-0.5">{sub}</p>
      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 z-50 w-56 bg-white text-[#525252] text-[11px] leading-relaxed rounded-lg p-3 shadow-lg border border-[#e5e5e5]">
          {tip}
          <button onClick={() => setOpen(false)} className="block mt-2 text-[#a3a3a3] hover:text-[#525252] text-[10px]">Got it</button>
        </div>
      )}
    </div>
  );
}

function PostAnalyticsDetail({
  postId, selectedRange, onBack,
}: { postId: number; selectedRange: number | null; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getPostAnalytics(postId, selectedRange)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId, selectedRange]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="flex items-center gap-1 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Content
          </button>
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="rounded-xl border border-[#e5e5e5] p-4 animate-pulse">
            <div className="h-3 bg-[#f0f0f0] rounded w-32 mb-3" />
            <div className="space-y-2">{Array(3).fill(0).map((_,j) => <div key={j} className="h-2.5 bg-[#f5f5f5] rounded w-full" />)}</div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { post, stats, audience, algorithmSignals, timeSeries, feedPosition } = data;

  const dwellLabel = algorithmSignals.avgDwell >= 30 ? "Excellent" : algorithmSignals.avgDwell >= 15 ? "Good" : algorithmSignals.avgDwell >= 5 ? "Fair" : "Low";
  const dwellColor = algorithmSignals.avgDwell >= 30 ? "#22c55e" : algorithmSignals.avgDwell >= 15 ? "#F44444" : algorithmSignals.avgDwell >= 5 ? "#f59e0b" : "#a3a3a3";

  const viewsSeries = (timeSeries as any[]).map((d: any) => ({ date: d.date, value: d.views }));
  const maxPosBucket = Math.max(...(feedPosition.distribution as any[]).map((b: any) => b.count), 1);

  return (
    <div className="space-y-4">
      {/* Back + post header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors mb-3">
          <ChevronLeft className="w-3.5 h-3.5" /> Content
        </button>
        <div className="flex items-center gap-3">
          {post.image && (
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
              <Image src={post.image} alt="" width={48} height={48} className="object-cover w-full h-full" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0a0a0a] truncate">{post.title || "Untitled"}</p>
            <p className="text-[11px] text-[#a3a3a3] mt-0.5">
              {post.type} · {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Core stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Views",       value: stats.views },
          { label: "Likes",       value: stats.likes },
          { label: "Comments",    value: stats.comments },
          { label: "Shares",      value: stats.shares },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#e5e5e5] p-4 text-center">
            <span className="text-2xl font-bold text-[#0a0a0a]">{s.value.toLocaleString()}</span>
            <p className="text-[11px] text-[#a3a3a3] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Algorithm signals */}
      <div className="rounded-xl border border-[#e5e5e5] p-4">
        <p className="text-sm font-semibold text-[#0a0a0a] mb-3">Algorithm signals</p>
        <div className="grid grid-cols-2 gap-3">
          <AlgoSignalCard
            label="Avg dwell" value={`${algorithmSignals.avgDwell}s`} sub={dwellLabel} color={dwellColor}
            tip="How many seconds people spent reading this post. Longer dwell = stronger positive signal to the algorithm."
          />
          <AlgoSignalCard
            label="Engagement" value={`${algorithmSignals.engagementRate}%`}
            sub={(algorithmSignals.engagementRate ?? 0) > 100 ? "multi-action" : "of views"}
            color="#F44444"
            tip="Total likes + comments divided by impressions. Can exceed 100% if one person liked and commented."
          />
          <AlgoSignalCard
            label="Scroll-past" value={`${algorithmSignals.scrollPastRate}%`} sub="negative signal" color="#f59e0b"
            tip="How often people saw this post and immediately scrolled past. Lower is better — high rate suppresses the post."
          />
          <AlgoSignalCard
            label="Follow-through" value={`${algorithmSignals.followThroughRate}%`} sub="converted" color="#22c55e"
            tip="How many viewers followed you after seeing this post. Strongest positive signal the algorithm weighs."
          />
        </div>
      </div>

      {/* Audience breakdown */}
      <div className="rounded-xl border border-[#e5e5e5] p-4">
        <p className="text-sm font-semibold text-[#0a0a0a] mb-3">Audience</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <p className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">Views</p>
            {[
              { label: "Circle", value: audience.circleViews },
              { label: "Normal", value: audience.normalViews },
            ].map(row => {
              const total = audience.circleViews + audience.normalViews || 1;
              return (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-xs text-[#737373] w-14 flex-shrink-0">{row.label}</span>
                  <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${(row.value / total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[#0a0a0a] w-6 text-right flex-shrink-0">{row.value}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2.5">
            <p className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">Likes</p>
            {[
              { label: "Circle", value: audience.circleLikes },
              { label: "Normal", value: audience.normalLikes },
            ].map(row => {
              const total = audience.circleLikes + audience.normalLikes || 1;
              return (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-xs text-[#737373] w-14 flex-shrink-0">{row.label}</span>
                  <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${(row.value / total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[#0a0a0a] w-6 text-right flex-shrink-0">{row.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Views over time */}
      <div className="rounded-xl border border-[#e5e5e5] p-4">
        <p className="text-sm font-semibold text-[#0a0a0a] mb-3">Views over time</p>
        <AreaChart data={viewsSeries} color="#F44444" height={150} />
      </div>

      {/* Feed position */}
      {feedPosition.avgPosition > 0 && (
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#0a0a0a]">Feed position</p>
            <span className="text-xs text-[#a3a3a3]">avg {feedPosition.avgPosition}</span>
          </div>
          <div className="space-y-2.5">
            {(feedPosition.distribution as any[]).filter((b: any) => b.count > 0).map((b: any) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-[#737373] w-10 flex-shrink-0">#{b.label}</span>
                <div className="flex-1 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${(b.count / maxPosBucket) * 100}%` }} />
                </div>
                <span className="text-xs text-[#a3a3a3] w-8 text-right flex-shrink-0">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Audience Tab ──────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Reach Tab ────────────────────────────────────────────────────────────────

function SignalBar({ label, value, max, color, subtitle }: { label: string; value: number; max: number; color: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#0a0a0a] w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((value / max) * 100, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold text-[#0a0a0a] w-14 text-right flex-shrink-0">{subtitle ?? value}</span>
    </div>
  );
}

function SignalCard({ label, value, sub, color, tip }: { label: string; value: string; sub: string; color: string; tip: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-[#fafafa] p-3 relative">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] text-[#a3a3a3]">{label}</p>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-[#c0c0c0] hover:text-[#737373] transition-colors flex-shrink-0"
        >
          <HelpCircle className="w-3 h-3" />
        </button>
      </div>
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
      <p className="text-[10px] text-[#a3a3a3] mt-0.5">{sub}</p>
      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 z-50 w-56 bg-white text-[#525252] text-[11px] leading-relaxed rounded-lg p-3 shadow-lg border border-[#e5e5e5]">
          {tip}
          <button onClick={() => setOpen(false)} className="block mt-2 text-[#a3a3a3] hover:text-[#525252] text-[10px]">Got it</button>
        </div>
      )}
    </div>
  );
}

function ReachTab({ reachData }: { reachData: any }) {
  if (!reachData) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-[#e5e5e5] p-4 animate-pulse">
            <div className="h-3 bg-[#f0f0f0] rounded w-32 mb-4" />
            <div className="space-y-2">
              {Array(3).fill(0).map((_, j) => <div key={j} className="h-2.5 bg-[#f5f5f5] rounded w-full" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const { summary = {}, distribution = {}, qualitySignals = {}, timeSeries = [], postScores = [], positionBuckets = [] } = reachData;

  const impSeries = timeSeries.map((d: any) => ({ date: d.date, value: d.impressions }));
  const maxPosBucket = Math.max(...positionBuckets.map((b: any) => b.count), 1);

  // Dwell quality label
  const dwellLabel = qualitySignals.avgDwellSeconds >= 30 ? "Excellent"
    : qualitySignals.avgDwellSeconds >= 15 ? "Good"
    : qualitySignals.avgDwellSeconds >= 5  ? "Fair"
    : "Low";
  const dwellColor = qualitySignals.avgDwellSeconds >= 30 ? "#22c55e"
    : qualitySignals.avgDwellSeconds >= 15 ? "#F44444"
    : qualitySignals.avgDwellSeconds >= 5  ? "#f59e0b"
    : "#a3a3a3";

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total impressions", value: summary.totalImpressions?.toLocaleString() ?? "0", sub: `${(summary.impressionsChange ?? 0) >= 0 ? "+" : ""}${summary.impressionsChange ?? 0}% vs prev`, up: (summary.impressionsChange ?? 0) >= 0 },
          { label: "Unique accounts", value: summary.uniqueAccounts?.toLocaleString() ?? "0", sub: "reached", up: true },
          { label: "Avg. per post",    value: summary.avgPerPost?.toLocaleString() ?? "0",      sub: "impressions", up: true },
          {
            label: "Reach rate",
            value: summary.viralMultiplier ? `${summary.viralMultiplier}×` : `${summary.reachRate ?? 0}%`,
            sub:   summary.viralMultiplier ? "viral — beyond followers" : "of followers",
            up: true,
          },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-[#e5e5e5] p-4">
            <p className="text-xs text-[#737373] mb-1">{card.label}</p>
            <span className="text-2xl font-bold text-[#0a0a0a]">{card.value}</span>
            <p className={`text-[11px] mt-1 font-medium ${card.up ? "text-[#22c55e]" : "text-[#F44444]"}`}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Distribution + position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Audience distribution</span>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#737373]">Followers</span>
                <span className="text-xs font-semibold text-[#0a0a0a]">{distribution.followerReachPct ?? 0}%</span>
              </div>
              <div className="h-2.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${distribution.followerReachPct ?? 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#737373]">Non-followers (viral)</span>
                <span className="text-xs font-semibold text-[#22c55e]">{distribution.nonFollowerReachPct ?? 0}%</span>
              </div>
              <div className="h-2.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${distribution.nonFollowerReachPct ?? 0}%` }} />
              </div>
            </div>
          </div>
          {distribution.avgPosition !== null && (
            <div className="mt-3 pt-3 border-t border-[#f5f5f5] flex items-center justify-between">
              <span className="text-xs text-[#737373]">Avg. feed position</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-[#0a0a0a]">{distribution.avgPosition}</span>
                <span className="text-[10px] text-[#a3a3a3]">({distribution.positionsTracked} tracked)</span>
              </div>
            </div>
          )}
        </div>

        {/* Algorithm quality signals */}
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-[#0a0a0a]">Algorithm signals</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Avg dwell",
                value: `${qualitySignals.avgDwellSeconds ?? 0}s`,
                sub: dwellLabel,
                color: dwellColor,
                tip: "How many seconds people spend reading your post on average. Longer = the algorithm sees your content as valuable and shows it to more people. Under 5s means most people are ignoring it.",
              },
              {
                label: "Engagement",
                value: `${qualitySignals.engagementRate ?? 0}%`,
                sub: (qualitySignals.engagementRate ?? 0) > 100 ? "multi-action" : "of impressions",
                color: "#F44444",
                tip: "Total likes + comments + shares divided by impressions. Can exceed 100% because one person can like AND comment. Higher means your audience is actively reacting, not just scrolling past.",
              },
              {
                label: "Scroll-past",
                value: `${qualitySignals.scrollPastRate ?? 0}%`,
                sub: "negative signal",
                color: "#f59e0b",
                tip: "How often people see your post in the feed and immediately scroll past without stopping. A high rate tells the algorithm your content isn't grabbing attention — lower is better.",
              },
              {
                label: "Follow-through",
                value: `${qualitySignals.followThroughRate ?? 0}%`,
                sub: "converted",
                color: "#22c55e",
                tip: "How many people followed you after viewing this content. This is the strongest positive signal — it tells the algorithm your content is compelling enough to turn a stranger into a follower.",
              },
            ].map(sig => (
              <SignalCard key={sig.label} {...sig} />
            ))}
          </div>
        </div>
      </div>

      {/* Impressions over time */}
      <div className="rounded-xl border border-[#e5e5e5] p-4">
        <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Impressions over time</span>
        <AreaChart data={impSeries} color="#F44444" height={150} />
      </div>

      {/* Feed position distribution */}
      {positionBuckets.some((b: any) => b.count > 0) && (
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#0a0a0a]">Feed position distribution</span>
            <span className="text-[11px] text-[#a3a3a3]">Position 1 = top of feed</span>
          </div>
          <div className="space-y-2.5">
            {positionBuckets.map((b: any) => (
              <SignalBar key={b.label} label={`Position ${b.label}`} value={b.count} max={maxPosBucket} color="#F44444" subtitle={`${b.count} views`} />
            ))}
          </div>
        </div>
      )}

      {/* Albiz score leaderboard */}
      {postScores.length > 0 && (
        <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0f0f0]">
            <span className="text-sm font-semibold text-[#0a0a0a]">Albiz score leaderboard</span>
            <p className="text-[11px] text-[#a3a3a3] mt-0.5">Albiz reach quality score — weighted by likes, dwell time, shares, and follow-throughs</p>
          </div>
          {postScores.slice(0, 6).map((p: any, i: number) => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] ${i < postScores.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}>
              <span className="text-xs text-[#c0c0c0] w-4 flex-shrink-0">{i + 1}</span>
              {p.image && (
                <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                  <Image src={p.image} alt="" width={36} height={36} className="object-cover w-full h-full" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#0a0a0a] truncate">{p.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-[#a3a3a3]">{p.impressions} imp.</span>
                  <span className="text-[10px] text-[#a3a3a3]">{p.avgDwell}s dwell</span>
                  <span className="text-[10px] text-[#a3a3a3]">{p.scrollPastRate}% scroll-past</span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-sm font-bold text-[#0a0a0a]">{p.xScore.toFixed(2)}</span>
                <p className="text-[10px] text-[#a3a3a3]">Albiz score</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AudienceTab({ audience, selectedRange }: { audience: any; selectedRange: number | null }) {
  const [selectedGlobeCountry, setSelectedGlobeCountry] = useState<string | null>(null);

  if (!audience) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-[#e5e5e5] p-4 animate-pulse">
            <div className="h-3 bg-[#f0f0f0] rounded w-32 mb-4" />
            <div className="space-y-2">
              {Array(4).fill(0).map((_, j) => (
                <div key={j} className="h-2.5 bg-[#f5f5f5] rounded w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const {
    totalFollowers = 0,
    newFollowers = 0,
    lostFollowers = 0,
    netGrowth = 0,
    newFollowersChange = 0,
    lostFollowersChange = 0,
    activityRate = 0,
    activeFollowerCount = 0,
    followerGrowth = [],
    recentFollowers = [],
    engagedFollowers = [],
    topCountries = [],
    genderSplit = [],
    ageRanges = [],
    devices = [],
  } = audience;

  const isGlobeDemo = topCountries.length === 0;
  const globeCountries = isGlobeDemo ? DEMO_GLOBE_COUNTRIES : topCountries;

  const maxBar = Math.max(...followerGrowth.map((f: any) => Math.max(f.gained, f.lost)), 1);
  const maxCumulative = Math.max(...followerGrowth.map((f: any) => f.cumulative), 1);

  return (
    <div className="space-y-4">
      {/* Growth summary — 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <p className="text-xs text-[#737373] mb-1">Total followers</p>
          <span className="text-2xl font-bold text-[#0a0a0a]">{totalFollowers}</span>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <p className="text-xs text-[#737373] mb-1">Gained</p>
          <span className="text-2xl font-bold text-[#22c55e]">+{newFollowers}</span>
          <span className={`text-[11px] flex items-center gap-0.5 mt-1 font-medium ${newFollowersChange >= 0 ? "text-[#22c55e]" : "text-[#F44444]"}`}>
            {newFollowersChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(newFollowersChange)}% vs prev
          </span>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <p className="text-xs text-[#737373] mb-1">Unfollowed</p>
          <span className="text-2xl font-bold text-[#F44444]">-{lostFollowers}</span>
          <span className={`text-[11px] flex items-center gap-0.5 mt-1 font-medium ${lostFollowersChange <= 0 ? "text-[#22c55e]" : "text-[#F44444]"}`}>
            {lostFollowersChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            {Math.abs(lostFollowersChange)}% vs prev
          </span>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <p className="text-xs text-[#737373] mb-1">Net growth</p>
          <span className={`text-2xl font-bold ${netGrowth >= 0 ? "text-[#0a0a0a]" : "text-[#F44444]"}`}>
            {netGrowth >= 0 ? `+${netGrowth}` : netGrowth}
          </span>
          <p className="text-[11px] text-[#a3a3a3] mt-1">{activityRate}% active</p>
        </div>
      </div>

      {/* Follower growth chart */}
      <div className="rounded-xl border border-[#e5e5e5] p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-[#0a0a0a]">Monthly growth</span>
          <div className="flex items-center gap-3 text-[11px] text-[#737373]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#22c55e]" />Gained</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#F44444]" />Unfollowed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0a0a0a]" />Total</span>
          </div>
        </div>
        {followerGrowth.length > 0 ? (
          <div className="space-y-3">
            {followerGrowth.map((month: any) => (
              <div key={month.month} className="flex items-center gap-3">
                <span className="text-xs text-[#737373] w-7 flex-shrink-0">{month.month}</span>
                <div className="flex-1 space-y-1">
                  {/* Gained bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22c55e] rounded-full transition-all"
                        style={{ width: `${(month.gained / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#22c55e] w-7 text-right flex-shrink-0">
                      +{month.gained}
                    </span>
                  </div>
                  {/* Lost bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#F44444] rounded-full transition-all"
                        style={{ width: `${(month.lost / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#F44444] w-7 text-right flex-shrink-0">
                      -{month.lost}
                    </span>
                  </div>
                </div>
                {/* Cumulative total */}
                <div className="flex items-center gap-1.5 w-14 flex-shrink-0">
                  <div className="flex-1 h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0a0a0a] rounded-full"
                      style={{ width: `${(month.cumulative / maxCumulative) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#a3a3a3] w-5 text-right">{month.cumulative}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#c0c0c0] py-4 text-center">No follower data yet</p>
        )}
      </div>

      {/* Recent followers */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0a0a0a]">Recent followers</span>
          <span className="text-xs text-[#a3a3a3]">{totalFollowers} total</span>
        </div>
        {recentFollowers.length > 0 ? (
          <div>
            {recentFollowers.map((f: any, i: number) => (
              <div
                key={f.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors ${i < recentFollowers.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#f0f0f0]">
                  {f.avatar ? (
                    <Image src={f.avatar} alt={f.name} width={32} height={32} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#737373]">
                      {f.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{f.name}</p>
                  <p className="text-[11px] text-[#a3a3a3] truncate">@{f.handle}{f.title ? ` · ${f.title}` : ""}</p>
                </div>
                <span className="text-[11px] text-[#c0c0c0] flex-shrink-0">{timeAgo(f.followedAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[#c0c0c0]">No followers yet</div>
        )}
      </div>

      {/* Most engaged followers */}
      <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f0f0f0]">
          <span className="text-sm font-semibold text-[#0a0a0a]">Most engaged</span>
          <p className="text-[11px] text-[#a3a3a3] mt-0.5">Liked or commented on your posts this period</p>
        </div>
        {engagedFollowers.length > 0 ? (
          <div>
            {engagedFollowers.map((f: any, i: number) => (
              <div
                key={f.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors ${i < engagedFollowers.length - 1 ? "border-b border-[#f5f5f5]" : ""}`}
              >
                <span className="text-xs text-[#c0c0c0] w-4 flex-shrink-0">{i + 1}</span>
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#f0f0f0]">
                  {f.avatar ? (
                    <Image src={f.avatar} alt={f.name} width={32} height={32} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#737373]">
                      {f.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{f.name}</p>
                  <p className="text-[11px] text-[#a3a3a3]">@{f.handle}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-semibold text-[#0a0a0a]">{f.engagements}</span>
                  <span className="text-[10px] text-[#a3a3a3]">interactions</span>
                  {f.isFollower && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#f0f0f0] text-[10px] text-[#737373]">follower</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[#c0c0c0]">No engagement yet this period</div>
        )}
      </div>

      {/* Globe + country breakdown */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row">

          {/* Globe — centred in its space */}
          <div className="flex-1 min-w-0 flex items-center justify-center bg-white">
            <AudienceGlobe
              countries={globeCountries}
              focusCountry={selectedGlobeCountry}
              onCountrySelect={c => setSelectedGlobeCountry(c?.name ?? null)}
            />
          </div>

          {/* Country list */}
          <div className="sm:w-56 flex-shrink-0 flex flex-col border-t border-[#f0f0f0] sm:border-t-0 sm:border-l sm:border-l-[#f0f0f0]">
            <div className="px-5 pt-5 pb-3">
              <span className="text-[10px] text-[#c0c0c0] uppercase tracking-widest font-medium">
                By country
              </span>
              {isGlobeDemo && (
                <p className="text-[10px] text-[#b0b0b0] mt-1">
                  No follower location data yet
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4" style={{ maxHeight: 460 }}>
              {globeCountries.slice(0, 12).map((c: { name: string; count: number; pct: number }, i: number) => {
                const isSelected = selectedGlobeCountry === c.name;
                const maxPct = globeCountries[0]?.pct ?? 1;
                return (
                  <button
                    key={c.name}
                    onClick={() => setSelectedGlobeCountry(prev => prev === c.name ? null : c.name)}
                    className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors cursor-pointer ${
                      isSelected ? "bg-[#fff4f4]" : "hover:bg-[#fafafa]"
                    }`}
                  >
                    <span className={`text-[11px] w-4 flex-shrink-0 text-right font-medium ${
                      isSelected ? "text-[#F44444]" : "text-[#d0d0d0]"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className={`text-xs truncate ${
                          isSelected ? "text-[#F44444] font-semibold" : "text-[#0a0a0a] font-medium"
                        }`}>
                          {c.name}
                        </span>
                        <span className="text-[11px] flex-shrink-0 text-[#a3a3a3]">
                          {c.pct}%
                        </span>
                      </div>
                      <div className="h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(c.pct / maxPct) * 100}%`,
                            background: isSelected ? "#F44444" : "#e0e0e0",
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Age distribution */}
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Age distribution</span>
          {ageRanges.length === 0 ? (
            <p className="text-xs text-[#c0c0c0] py-4 text-center">No data yet — followers can add their birth year in settings</p>
          ) : (
            <div className="space-y-2.5">
              {ageRanges.map((age: any) => (
                <div key={age.range} className="flex items-center gap-3">
                  <span className="text-xs text-[#0a0a0a] w-10">{age.range}</span>
                  <div className="flex-1 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#525252] rounded-full" style={{ width: `${age.pct}%` }} />
                  </div>
                  <span className="text-xs text-[#a3a3a3] w-8 text-right">{age.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gender */}
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Gender</span>
          {genderSplit.length === 0 ? (
            <p className="text-xs text-[#c0c0c0] py-4 text-center">No data yet — followers can add their gender in settings</p>
          ) : (
            <div className="flex gap-2">
              {genderSplit.map((g: any) => (
                <div key={g.label} className="flex-1 text-center rounded-lg bg-[#fafafa] py-3">
                  <span className="text-lg font-bold text-[#0a0a0a]">{g.pct}%</span>
                  <p className="text-[11px] text-[#a3a3a3] mt-0.5">{g.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Devices */}
        <div className="rounded-xl border border-[#e5e5e5] p-4">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Devices</span>
          {devices.length === 0 ? (
            <p className="text-xs text-[#c0c0c0] py-4 text-center">No data yet — will populate as readers view your posts</p>
          ) : (
            <div className="space-y-3">
              {devices.map((d: any) => {
                const Icon = d.label === "Mobile" ? Smartphone : d.label === "Tablet" ? Smartphone : Monitor;
                return (
                  <div key={d.label} className="flex items-center gap-3">
                    <Icon className="w-3.5 h-3.5 text-[#a3a3a3]" />
                    <span className="text-xs text-[#0a0a0a] flex-1">{d.label}</span>
                    <div className="w-20 h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#F44444] rounded-full" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-xs text-[#a3a3a3] w-8 text-right">{d.pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<number | null>(30);
  const { userRole, currentUserId } = useContext(AuthContext);
  const isCircle = userRole === "CIRCLE";

  const [overviewStats, setOverviewStats] = useState(defaultOverviewStats);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [engagementBreakdown, setEngagementBreakdown] = useState(defaultEngagementBreakdown);
  const [topContentItems, setTopContentItems] = useState<any[]>([]);
  const [quickSnapshot, setSnapshot] = useState<any[]>([]);
  const [reach, setReach] = useState<ReachStats>(defaultReach);

  // Audience / Reach / Content detail state
  const [audience, setAudience] = useState<any>(null);
  const [reachData, setReachData] = useState<any>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUserId || !isCircle) return;

    setSelectedDayIndex(null);
    api.getAnalytics(selectedRange).then((data: any) => {
      if (data.stats) setOverviewStats(data.stats);
      if (data.timeSeries) setTimeSeries(data.timeSeries);
      if (data.engagementBreakdown) setEngagementBreakdown(data.engagementBreakdown);
      if (data.reach) setReach(data.reach);
      if (data.topPosts) {
        setTopContentItems(
          data.topPosts.map((p: any) => ({
            id: p.id,
            title: p.title,
            type: p.type,
            image: p.image,
            views: p.views.toLocaleString(),
            engagement: (p.likes + p.comments).toLocaleString(),
            shares: (p.shares ?? 0).toLocaleString(),
          }))
        );
      }
      if (data.snapshot) setSnapshot(data.snapshot);
    }).catch(() => {});
  }, [currentUserId, isCircle, selectedRange]);

  // Fetch audience data when Audience tab is active
  useEffect(() => {
    if (!currentUserId || !isCircle || activeTab !== 2) return;
    api.getAudienceAnalytics(selectedRange).then(setAudience).catch(() => {});
  }, [currentUserId, isCircle, activeTab, selectedRange]);

  // Fetch reach data when Reach tab is active
  useEffect(() => {
    if (!currentUserId || !isCircle || activeTab !== 3) return;
    api.getReachAnalytics(selectedRange).then(setReachData).catch(() => {});
  }, [currentUserId, isCircle, activeTab, selectedRange]);

  if (!isCircle) {
    return (
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white flex items-center justify-center py-20">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#FFF0F0] flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-[#F44444]" />
          </div>
          <p className="text-base font-semibold text-[#0a0a0a] mb-1.5">Analytics for Circle members</p>
          <p className="text-sm text-[#737373] mb-4">Track your reach, engagement, and audience growth with detailed analytics.</p>
          <button className="px-5 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors">
            Upgrade to Circle
          </button>
        </div>
      </main>
    );
  }

  // Derived chart data
  const viewsSeries = timeSeries.map(d => ({ date: d.date, value: d.views }));

  return (
    <>
      <main className="flex-1 min-w-0 px-4 sm:px-6 bg-white overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-30 pt-1 pb-3 md:py-4 -mx-4 px-4 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 border-b border-[#e5e5e5] md:border-b-0">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <span className="text-xl font-semibold text-[#0a0a0a]">Analytics</span>
            <div className="relative">
              <button
                onClick={() => setDateRangeOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-[#fafafa]"
              >
                {dateRanges.find(r => r.days === selectedRange)?.label ?? "All time"}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {dateRangeOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg border border-[#e5e5e5] shadow-lg z-50">
                  {dateRanges.map(range => (
                    <button
                      key={range.label}
                      onClick={() => { setSelectedRange(range.days ?? null); setDateRangeOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-[#fafafa] ${selectedRange === range.days ? "bg-[#f5f5f5] font-medium text-[#0a0a0a]" : "text-[#525252]"}`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 lg:-mx-6 lg:px-6">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(i); setSelectedPostId(null); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  i === activeTab
                    ? "bg-[#F44444] text-white"
                    : "bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb] border border-[#e5e5e5]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-6 space-y-4">
          {/* ── Overview ─────────────────────────────────────────────────── */}
          {activeTab === 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {overviewStats.map(stat => (
                  <div key={stat.label} className="rounded-xl border border-[#e5e5e5] p-4">
                    <p className="text-xs text-[#737373] mb-2">{stat.label}</p>
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <span className="text-2xl font-bold text-[#0a0a0a]">{stat.value}</span>
                        <span className={`text-[11px] font-medium flex items-center gap-0.5 mt-1 ${stat.up ? "text-[#22c55e]" : "text-[#F44444]"}`}>
                          {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {stat.change}%
                        </span>
                      </div>
                      <StatSparkline data={stat.sparkline} color={stat.up ? "#F44444" : "#a3a3a3"} width={64} height={28} />
                    </div>
                    {stat.breakdown && stat.breakdown.length > 0 && (
                      <div className="border-t border-[#f5f5f5] pt-2 space-y-1.5">
                        {stat.breakdown.map(item => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span className="text-[10px] text-[#c0c0c0]">{item.label}</span>
                            <span className="text-[10px] font-medium text-[#737373]">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Views over time */}
              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#0a0a0a]">Views over time</span>
                  <span className="text-xs text-[#a3a3a3]">by publish date</span>
                </div>
                <AreaChart data={viewsSeries} color="#F44444" height={160} />
              </div>

              {/* Daily engagement chart */}
              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-semibold text-[#0a0a0a]">Daily engagement</span>
                    {timeSeries.length > 0 && (
                      <span className="text-[11px] text-[#a3a3a3] ml-2">click a bar to drill down</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#737373]">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#F44444]" />Likes</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#737373]" />Comments</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#22c55e]" />Shares</span>
                  </div>
                </div>
                <EngagementChart
                  data={timeSeries}
                  height={160}
                  onBarClick={i => setSelectedDayIndex(prev => prev === i ? null : i)}
                  selectedIndex={selectedDayIndex}
                />
              </div>

              {/* Day detail panel */}
              {selectedDayIndex !== null && timeSeries[selectedDayIndex] && (
                <DayDetailPanel
                  day={timeSeries[selectedDayIndex]}
                  onClose={() => setSelectedDayIndex(null)}
                />
              )}

              {/* Engagement breakdown */}
              <div className="rounded-xl border border-[#e5e5e5] p-4">
                <span className="text-sm font-semibold text-[#0a0a0a] block mb-4">Engagement breakdown</span>
                <div className="flex gap-4 mb-4">
                  {engagementBreakdown.map(item => (
                    <div key={item.label} className="flex-1 text-center">
                      <span className="text-xl font-bold text-[#0a0a0a]">{item.value.toLocaleString()}</span>
                      <p className="text-[11px] text-[#737373] mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="h-2.5 rounded-full overflow-hidden flex">
                  {engagementBreakdown.map(item => (
                    <div key={item.label} className="h-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-2.5">
                  {engagementBreakdown.map(item => (
                    <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-[#737373]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label} {item.pct}%
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Content ──────────────────────────────────────────────────── */}
          {activeTab === 1 && (
            selectedPostId !== null ? (
              <PostAnalyticsDetail
                postId={selectedPostId}
                selectedRange={selectedRange}
                onBack={() => setSelectedPostId(null)}
              />
            ) : (
              <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#0a0a0a]">Content performance</span>
                  <span className="text-xs text-[#a3a3a3]">By views</span>
                </div>
                {topContentItems.length > 0 ? (
                  topContentItems.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedPostId(item.id)}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#fafafa] text-left transition-colors ${i < topContentItems.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}
                    >
                      <span className="text-sm font-medium text-[#c0c0c0] w-5 flex-shrink-0">{i + 1}</span>
                      {item.image && (
                        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-[#e5e5e5]">
                          <Image src={item.image} alt="" width={44} height={44} className="object-cover w-full h-full" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#0a0a0a] truncate">{item.title}</p>
                        <span className="text-[10px] text-[#a3a3a3] uppercase tracking-wide">{item.type}</span>
                      </div>
                      <div className="flex items-center gap-5 flex-shrink-0">
                        <div className="text-center">
                          <span className="text-sm font-semibold text-[#0a0a0a] block">{item.views}</span>
                          <span className="text-[10px] text-[#a3a3a3]">Views</span>
                        </div>
                        <div className="text-center">
                          <span className="text-sm font-semibold text-[#0a0a0a] block">{item.engagement}</span>
                          <span className="text-[10px] text-[#a3a3a3]">Eng.</span>
                        </div>
                        <div className="text-center hidden sm:block">
                          <span className="text-sm font-semibold text-[#0a0a0a] block">{item.shares}</span>
                          <span className="text-[10px] text-[#a3a3a3]">Shares</span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-5 py-10 text-center text-sm text-[#a3a3a3]">
                    No posts yet. Start creating to see performance data.
                  </div>
                )}
              </div>
            )
          )}

          {/* ── Audience ─────────────────────────────────────────────────── */}
          {activeTab === 2 && (
            <AudienceTab audience={audience} selectedRange={selectedRange} />
          )}

          {/* ── Reach ────────────────────────────────────────────────────── */}
          {activeTab === 3 && (
            <ReachTab reachData={reachData} />
          )}
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 overflow-y-auto flex-shrink-0 px-4 xl:px-5 py-6 border-l border-[#e5e5e5] bg-white">
        <div className="mb-6">
          <span className="text-sm font-semibold text-[#0a0a0a] block mb-3">Quick stats</span>
          <div className="space-y-1">
            {quickSnapshot.length > 0 ? (
              quickSnapshot.map((item: any) => (
                <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#fafafa]">
                  <span className="text-xs text-[#737373]">{item.label}</span>
                  <span className="text-xs font-semibold text-[#0a0a0a]">{item.value}</span>
                </div>
              ))
            ) : (
              defaultOverviewStats.map(s => (
                <div key={s.label} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#fafafa]">
                  <span className="text-xs text-[#737373]">{s.label}</span>
                  <span className="text-xs font-semibold text-[#0a0a0a]">{s.value}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <SuggestedProfiles />
      </aside>
    </>
  );
}
