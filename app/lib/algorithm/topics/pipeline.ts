import {
  collectAndAggregate,
  buildRegionalAggregates,
  type TopicAggregate,
} from "./aggregator";
import { computeTopicScore, type ScoredTopic } from "./scorer";
import { applyQualityFilters }                  from "./filters";
import { MAX_GLOBAL_TOPICS, MAX_REGIONAL_TOPICS, MIN_COUNTRY_POSTS_FOR_REGIONAL } from "./signals";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicsPipelineResult {
  scope:      string;       // "GLOBAL" or ISO country code
  topics:     ScoredTopic[];
  computedAt: Date;
}

export interface TopicsPipelineOptions {
  windowHours?:     number;
  regionalScopes?:  string[]; // explicit list; if omitted, auto-detected from aggregates
  nowMs?:           number;   // injectable for deterministic testing
}

// ─── Per-scope pass ───────────────────────────────────────────────────────────

function runScopePipeline(
  aggregates: TopicAggregate[],
  scope:      string,
  maxTopics:  number,
  nowMs:      number
): TopicsPipelineResult {
  const scored   = aggregates.map(agg => computeTopicScore(agg, scope, nowMs));
  const filtered = applyQualityFilters(aggregates, scored);
  const ranked   = filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTopics);

  return { scope, topics: ranked, computedAt: new Date(nowMs) };
}

// ─── Country detection ────────────────────────────────────────────────────────

// If the caller does not supply regionalScopes we automatically discover which
// countries have enough posts to warrant their own ranking.
function detectActiveCountries(globalAggregates: TopicAggregate[]): string[] {
  const countryCounts = new Map<string, number>();

  for (const agg of globalAggregates) {
    for (const [country, count] of agg.countryCounts) {
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + count);
    }
  }

  return Array.from(countryCounts.entries())
    .filter(([, count]) => count >= MIN_COUNTRY_POSTS_FOR_REGIONAL)
    .map(([country]) => country);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

// Collects posts once globally, then runs a scoring pass for each requested
// scope. Regional passes derive their data from the global aggregates — no
// additional DB queries are issued.
export async function runTopicsPipeline(
  options: TopicsPipelineOptions = {}
): Promise<TopicsPipelineResult[]> {
  const { windowHours, nowMs = Date.now() } = options;

  const globalAggregates = await collectAndAggregate(windowHours, nowMs);

  const results: TopicsPipelineResult[] = [];

  // Global pass
  results.push(runScopePipeline(globalAggregates, "GLOBAL", MAX_GLOBAL_TOPICS, nowMs));

  // Regional passes
  const scopes = options.regionalScopes ?? detectActiveCountries(globalAggregates);

  for (const countryCode of scopes) {
    const regionalAggregates = buildRegionalAggregates(
      globalAggregates,
      countryCode,
      nowMs
    );
    results.push(
      runScopePipeline(regionalAggregates, countryCode, MAX_REGIONAL_TOPICS, nowMs)
    );
  }

  return results;
}
