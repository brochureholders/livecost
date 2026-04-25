/**
 * UrbRank Score engine — normalizes raw city metrics to 0-100 dimension
 * scores, then combines them with per-profile weights to produce an
 * overall UrbRank Score + letter grade + national rank.
 *
 * Five profiles cover the most common "where should I live" decision
 * contexts. Each profile uses a subset of the seven dimensions below and
 * weights them to reflect what that persona cares about.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

// ---------------------------------------------------------------------------
// Dimensions + profiles
// ---------------------------------------------------------------------------

export const DIMENSIONS = [
  "affordability",
  "safety",
  "climate",
  "walkability",
  "job_market",
  "environment",
  "education",
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number];

export const PROFILES = [
  "general",
  "family",
  "retiree",
  "remote_worker",
  "young_professional",
] as const;
export type Profile = (typeof PROFILES)[number];

export const PROFILE_LABELS: Record<Profile, string> = {
  general: "General",
  family: "Families",
  retiree: "Retirees",
  remote_worker: "Remote Workers",
  young_professional: "Young Professionals",
};

/** Profile weights. Rows sum to 100. Missing dimensions = 0% weight. */
export const PROFILE_WEIGHTS: Record<
  Profile,
  Partial<Record<DimensionKey, number>>
> = {
  general: {
    affordability: 100 / 6,
    safety: 100 / 6,
    climate: 100 / 6,
    walkability: 100 / 6,
    job_market: 100 / 6,
    environment: 100 / 6,
  },
  family: {
    safety: 25,
    affordability: 25,
    education: 20,
    climate: 15,
    walkability: 10,
    environment: 5,
  },
  retiree: {
    climate: 25,
    affordability: 25,
    safety: 20,
    walkability: 20,
    environment: 10,
  },
  remote_worker: {
    affordability: 35,
    climate: 20,
    walkability: 15,
    environment: 15,
    safety: 15,
  },
  young_professional: {
    job_market: 30,
    walkability: 25,
    affordability: 20,
    climate: 15,
    safety: 10,
  },
};

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export function gradeFor(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 40) return "D";
  return "F";
}

/** Tailwind color class for a score bucket. Used across UI. */
export function colorForScore(score: number): string {
  if (score >= 75) return "emerald";
  if (score >= 55) return "amber";
  if (score >= 40) return "orange";
  return "red";
}

// ---------------------------------------------------------------------------
// Dimension computation helpers
// ---------------------------------------------------------------------------

/** Percentile rank of `value` against a pre-sorted ascending array.
 *  Returns 0-100. 0 = worst in the set, 100 = best. */
export function percentileRank(value: number, sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (n < 2) return 50;
  let below = 0;
  let equal = 0;
  for (const v of sortedAsc) {
    if (v < value) below++;
    else if (v === value) equal++;
    else break;
  }
  // Midrank rule: half-credit for ties
  return ((below + equal / 2) / (n - 1)) * 100;
}

/** For metrics where lower = better (cost, crime, AQI), invert. */
export function invertPercentile(p: number): number {
  return 100 - p;
}

/** Raw climate quality score (0-100) from temps + precipitation.
 *  Penalizes hot summers, cold winters, and extreme rainfall.
 *
 *  Asymmetric: cold winters are penalized more than cool summers, and hot
 *  summers more than warm winters. The ideal is ~50-82F year-round.
 *  A Cleveland-type winter (low ~20F) should cost ~15-20 points, not 6.
 */
export function rawClimateScore(
  summerHigh: number | null,
  winterLow: number | null,
  annualPrecipIn: number | null,
): number | null {
  if (summerHigh == null && winterLow == null) return null;
  let score = 100;

  // Summer highs: ideal ~82°F. Heat hurts more than cool does.
  if (summerHigh != null) {
    if (summerHigh > 82) {
      // Each °F above 82 costs ~0.9 points, quadratic growth.
      const dev = summerHigh - 82;
      score -= Math.min(35, (dev * dev) / 20);
    } else if (summerHigh < 60) {
      // Very cool summers (<60) penalized lightly — rare and mild-climate.
      const dev = 60 - summerHigh;
      score -= Math.min(10, dev * 0.5);
    }
  }

  // Winter lows: ideal ~38°F. Cold hurts more than mild does.
  if (winterLow != null) {
    if (winterLow < 38) {
      // Each °F below 38 costs ~1 point, quadratic growth so extreme cold
      // (Minneapolis ~7F = deviation 31) caps at 35.
      const dev = 38 - winterLow;
      score -= Math.min(35, (dev * dev) / 18);
    } else if (winterLow > 65) {
      // Tropical winters (>65) — not everyone loves 70F Decembers.
      const dev = winterLow - 65;
      score -= Math.min(15, dev * 0.8);
    }
  }

  // Precipitation extremes get a flat penalty.
  if (annualPrecipIn != null) {
    if (annualPrecipIn < 15 || annualPrecipIn > 70) score -= 10;
  }
  return Math.max(0, score);
}

/** Raw job-market score (0-100): low unemployment + higher income. */
export function rawJobMarketScore(
  unemploymentPct: number | null,
  medianIncome: number | null,
  nationalMedianIncome = 75_000,
): number | null {
  if (unemploymentPct == null && medianIncome == null) return null;
  let score = 50;
  if (unemploymentPct != null) {
    // 3% = +25, 10% = -25; clamp
    score += Math.max(-25, Math.min(25, (6 - unemploymentPct) * 8));
  }
  if (medianIncome != null) {
    // +$30k above national = +25; -$30k below = -25
    const delta = medianIncome - nationalMedianIncome;
    score += Math.max(-25, Math.min(25, (delta / 30_000) * 25));
  }
  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Weighted combination
// ---------------------------------------------------------------------------

/** Combines dimension scores under profile weights. Missing dimensions drop
 *  out and the remaining weights rescale so every city gets a usable score. */
export function weightedProfileScore(
  dimensionScores: Partial<Record<DimensionKey, number>>,
  profile: Profile,
): { score: number; effectiveWeight: number } {
  const weights = PROFILE_WEIGHTS[profile];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    const key = dim as DimensionKey;
    const v = dimensionScores[key];
    if (v == null || weight == null) continue;
    weightedSum += v * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return { score: 0, effectiveWeight: 0 };
  return {
    score: Number((weightedSum / totalWeight).toFixed(2)),
    effectiveWeight: totalWeight,
  };
}

// ---------------------------------------------------------------------------
// Query helpers (used by pages)
// ---------------------------------------------------------------------------

export type UrbRankScore = {
  city_id: string;
  profile: Profile;
  score: number;
  grade: string;
  national_rank: number | null;
  dimension_scores: Partial<Record<DimensionKey, number>>;
};

/** Fetch one city's UrbRank Score for one profile. */
export async function getUrbRankScore(
  cityId: string,
  profile: Profile,
): Promise<UrbRankScore | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("urbrank_scores")
    .select("city_id, profile, score, grade, national_rank, dimension_scores")
    .eq("city_id", cityId)
    .eq("profile", profile)
    .maybeSingle();
  if (error || !data) return null;
  return data as UrbRankScore;
}

/** Fetch all five profile scores for a city. Returned as a map keyed by profile. */
export async function getUrbRankScoresForCity(
  cityId: string,
): Promise<Partial<Record<Profile, UrbRankScore>>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await supabase
    .from("urbrank_scores")
    .select("city_id, profile, score, grade, national_rank, dimension_scores")
    .eq("city_id", cityId);
  if (error || !data) return {};
  const out: Partial<Record<Profile, UrbRankScore>> = {};
  for (const row of data) {
    out[row.profile as Profile] = row as UrbRankScore;
  }
  return out;
}

export type LeaderboardRow = UrbRankScore & {
  name: string;
  slug: string;
  state: string;
  state_code: string;
  population: number | null;
};

/** Top N cities by UrbRank Score for a given profile.
 *  Optional stateCode filters to cities in that state only.
 *
 *  Uses `cities!inner(...)` so that `.eq("cities.state_code", X)` actually
 *  filters the parent rows. Without `!inner`, PostgREST returns all
 *  urbrank_scores rows but nulls the `cities` join for non-matches —
 *  silently producing a leaderboard of "matches" with empty city data. */
export async function getUrbRankLeaderboard(
  profile: Profile,
  limit = 100,
  stateCode?: string,
): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];
  // Use !inner only when state filter is requested; for the unfiltered
  // path, an inner join is unnecessary and the regular embed performs
  // identically while preserving the original query plan.
  const select = stateCode
    ? `city_id, profile, score, grade, national_rank, dimension_scores,
       cities!inner ( name, slug, state, state_code, population )`
    : `city_id, profile, score, grade, national_rank, dimension_scores,
       cities ( name, slug, state, state_code, population )`;
  let query = supabase
    .from("urbrank_scores")
    .select(select)
    .eq("profile", profile)
    .order("score", { ascending: false })
    .limit(limit);
  if (stateCode) {
    query = query.eq("cities.state_code", stateCode);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  // PostgREST returns the nested relation as an array (one element when
  // the FK is single-row). Extract the first entry.
  const out: LeaderboardRow[] = [];
  for (const r of data as unknown as Array<
    UrbRankScore & {
      cities:
        | {
            name: string;
            slug: string;
            state: string;
            state_code: string;
            population: number | null;
          }
        | Array<{
            name: string;
            slug: string;
            state: string;
            state_code: string;
            population: number | null;
          }>
        | null;
    }
  >) {
    const c = Array.isArray(r.cities) ? r.cities[0] : r.cities;
    if (!c) continue;
    out.push({
      ...r,
      name: c.name,
      slug: c.slug,
      state: c.state,
      state_code: c.state_code,
      population: c.population,
    });
  }
  return out;
}
