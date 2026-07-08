// Shared helpers for the Ads system — number/date formatting and campaign
// serialization shared by the admin and public ad APIs.
import { blobStorageService } from "@/lib/blob-storage";

export type AdStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED";

// Decimal-safe number coercion (Prisma returns Decimal objects)
export function dec(v: unknown): number {
  if (v == null) return 0;
  const n = Number((v as any)?.toString?.() ?? v);
  return Number.isFinite(n) ? n : 0;
}

export function parseMoney(input: unknown): number {
  const n = Number(String(input ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function fmtCtr(impressions: number, clicks: number): string {
  if (!impressions) return "0%";
  return ((clicks / impressions) * 100).toFixed(2) + "%";
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "TBD";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const AD_SETTINGS_KEY = "ads_config";

export const DEFAULT_AD_SETTINGS = {
  maxAdsPerPage: 3,
  feedAdFrequency: 5,
  sidebarEnabled: true,
  storiesEnabled: true,
  autoApprove: false,
  minBudget: 500,
  defaultCpc: 0.35,
  maxCpcBid: 5.0,
};

export type AdSettings = typeof DEFAULT_AD_SETTINGS;

// Tunable weights for the ad ranking algorithm (see app/lib/ads-algorithm.ts).
// Stored in AdminSetting under this key; the serve route reads it live.
export const AD_ALGORITHM_KEY = "ads_algorithm";

export const DEFAULT_AD_ALGORITHM = {
  bidWeight: 0.4, // weight on effective CPC (revenue)
  relevanceWeight: 0.4, // weight on targeting match to the viewer
  recencyWeight: 0.2, // weight on campaign freshness
  ctrInfluence: 0.5, // 0..1 — how strongly historical CTR boosts a creative
  pacingStrictness: 0.5, // 0 = ignore daily budget, 1 = throttle hard when ahead of pace
  minRelevance: 0, // hard floor 0..1 — drop ads below this relevance (0 = off)
  defaultFrequencyCap: 0, // per-user/day cap applied when a campaign sets none (0 = unlimited)
  diversity: true, // avoid serving the same advertiser back-to-back
};

export type AdAlgorithm = typeof DEFAULT_AD_ALGORITHM;

// Shapes a DB campaign (with its first creative + event counts) into the
// display object the admin UI consumes.
export function serializeCampaign(
  row: any,
  counts: { impressions: number; clicks: number },
) {
  const creative = row.creatives?.[0] ?? null;
  const impressions = counts.impressions || 0;
  const clicks = counts.clicks || 0;
  return {
    id: row.id,
    name: row.name,
    advertiser: row.advertiserName,
    advertiserEmail: row.advertiserEmail ?? "",
    status: String(row.status).toLowerCase(),
    budget: fmtMoney(dec(row.budget)),
    spent: fmtMoney(dec(row.spent)),
    budgetRaw: dec(row.budget),
    spentRaw: dec(row.spent),
    impressions: fmtCompact(impressions),
    clicks: fmtCompact(clicks),
    impressionsRaw: impressions,
    clicksRaw: clicks,
    ctr: fmtCtr(impressions, clicks),
    cpc: "$" + dec(row.cpc).toFixed(2),
    cpcRaw: dec(row.cpc),
    startDate: fmtDate(row.startDate),
    endDate: fmtDate(row.endDate),
    startDateRaw: row.startDate ? new Date(row.startDate).toISOString() : null,
    endDateRaw: row.endDate ? new Date(row.endDate).toISOString() : null,
    createdAtRaw: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    placement: (row.placements ?? []).join(", "),
    placements: row.placements ?? [],
    promoteType: row.promoteType,
    promoteTargetId: row.promoteTargetId,
    image: blobStorageService.resolveMediaUrl(creative?.imageUrl ?? null),
    headline: creative?.headline ?? "",
    description: creative?.description ?? "",
    ctaText: creative?.ctaText ?? "Learn More",
    ctaUrl: creative?.ctaUrl ?? "",
    sponsorName: creative?.sponsorName ?? row.advertiserName,
    sponsorLogo: blobStorageService.resolveMediaUrl(creative?.sponsorLogo ?? null),
    // Targeting + pacing (algorithm inputs)
    targetCountries: row.targetCountries ?? [],
    targetTags: row.targetTags ?? [],
    targetAudience: row.targetAudience ?? "all",
    pacing: row.pacing ?? "even",
    dailyBudget: row.dailyBudget != null ? dec(row.dailyBudget) : null,
    frequencyCap: row.frequencyCap ?? 0,
    priority: row.priority ?? 0,
    // Per-creative A/B variants
    creatives: (row.creatives ?? []).map((cr: any) => ({
      id: cr.id,
      headline: cr.headline,
      image: blobStorageService.resolveMediaUrl(cr.imageUrl ?? null),
      weight: cr.weight ?? 1,
      impressions: cr.impressions ?? 0,
      clicks: cr.clicks ?? 0,
      ctr: fmtCtr(cr.impressions ?? 0, cr.clicks ?? 0),
    })),
  };
}

// Builds a { campaignId: { impressions, clicks } } map from a groupBy result.
export function buildCountsMap(
  grouped: { campaignId: number; type: string; _count: { _all: number } }[],
) {
  const map: Record<number, { impressions: number; clicks: number }> = {};
  for (const g of grouped) {
    const entry = (map[g.campaignId] ??= { impressions: 0, clicks: 0 });
    if (g.type === "IMPRESSION") entry.impressions = g._count._all;
    else if (g.type === "CLICK") entry.clicks = g._count._all;
  }
  return map;
}
