import report from "@/data/coverage-report.json";

export type Dim =
  | "affordability"
  | "safety"
  | "climate"
  | "walkability"
  | "job_market"
  | "environment"
  | "education";

export type Status = "present" | "fallback" | "missing";

export type CityCoverage = {
  slug: string;
  name: string;
  state_code: string;
  population: number | null;
  dims: Record<Dim, Status>;
  present: number;
};

const bySlug = new Map<string, CityCoverage>(
  (report.cities as CityCoverage[]).map((c) => [c.slug, c]),
);

export function getCoverageBySlug(slug: string): CityCoverage | null {
  return bySlug.get(slug) ?? null;
}

export const COVERAGE_GENERATED_AT: string = report.generated_at;

export type CoverageReport = {
  generated_at: string;
  total_cities: number;
  per_dimension: Record<Dim, { present: number; fallback: number; missing: number }>;
  histogram: Record<string, number>;
  cities_missing_cost_index: string[];
  anomalies?: { city: string; field: string; value: unknown; rule: string }[];
  cities: CityCoverage[];
};

/** Full coverage report. Useful for the /coverage debug page. */
export function getCoverageReport(): CoverageReport {
  return report as unknown as CoverageReport;
}

/**
 * Sitemap priority for a city profile / urbrank-score page, scaled by how
 * many of the 7 scoring dimensions have real data. Crawlers use this as a
 * hint for crawl budget — pages we have less confidence in get less.
 *   6-7/7 → 0.8 (default), 5/7 → 0.5, <5/7 → 0.3.
 */
export function profilePriority(slug: string): number {
  const cov = getCoverageBySlug(slug);
  if (!cov) return 0.8;
  if (cov.present >= 6) return 0.8;
  if (cov.present === 5) return 0.5;
  return 0.3;
}

/**
 * Sitemap priority for a comparison page; uses the weaker side of the pair.
 * Returns null if the pair should be excluded from the sitemap entirely
 * (both sides too weak to make a credible comparison).
 *   weak side 6-7/7 → 0.6 (default), 5/7 → 0.4, <5/7 → null (exclude).
 */
export function comparePriority(slugA: string, slugB: string): number | null {
  const a = getCoverageBySlug(slugA);
  const b = getCoverageBySlug(slugB);
  const minPresent = Math.min(a?.present ?? 7, b?.present ?? 7);
  if (minPresent < 5) return null;
  if (minPresent === 5) return 0.4;
  return 0.6;
}

/** Whether to noindex a per-city page. Same threshold as the sitemap-exclude
 *  case for comparisons: a page with <5/7 dimensions is missing too much to
 *  trust as a search result. Today fires for ~1 city; mostly defensive. */
export function shouldNoIndexCity(slug: string): boolean {
  const cov = getCoverageBySlug(slug);
  return cov != null && cov.present < 5;
}

/** Whether to noindex a comparison page. True when the pair would be
 *  excluded from the comparison sitemap (`comparePriority` is null). */
export function shouldNoIndexComparison(slugA: string, slugB: string): boolean {
  return comparePriority(slugA, slugB) == null;
}
