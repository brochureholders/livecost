/**
 * Compute UrbRank Scores for every (city × profile) pair and upsert into
 * the urbrank_scores table.
 *
 * Flow:
 *   1. Load every city with joined costs, demographics, quality.
 *   2. For each city, compute 7 raw dimension signals:
 *      affordability  = inverse percentile of cost_index
 *      safety         = inverse percentile of crime_rate_per_100k
 *      climate        = percentile of rawClimateScore(temps, precip)
 *      walkability    = walk_score (already 0-100)
 *      job_market     = percentile of rawJobMarketScore(unemp, income)
 *      environment    = inverse percentile of AQI
 *      education      = percentile of college_educated_pct
 *   3. Apply the five PROFILE_WEIGHTS sets → 5 weighted scores per city.
 *   4. Assign letter grades, compute national rank within each profile,
 *      upsert rows.
 *
 * Run: npx tsx scripts/compute-urbrank-scores.ts
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  DIMENSIONS,
  PROFILES,
  gradeFor,
  invertPercentile,
  percentileRank,
  rawClimateScore,
  rawJobMarketScore,
  weightedProfileScore,
  type DimensionKey,
} from "../lib/urbrank-score";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local",
  );
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

type CostRow = {
  year: number;
  cost_index: number | null;
  median_household_income: number | null;
};
type DemoRow = {
  year: number;
  unemployment_rate: number | null;
  college_educated_pct: number | null;
};
type QualRow = {
  year: number;
  crime_rate_per_100k: number | null;
  avg_temp_summer: number | null;
  avg_temp_winter: number | null;
  annual_precipitation: number | null;
  walk_score: number | null;
  air_quality_index: number | null;
};

type CityRow = {
  id: string;
  name: string;
  state_code: string;
  city_costs: CostRow[] | null;
  city_demographics: DemoRow[] | null;
  city_quality: QualRow[] | null;
};

function latest<T extends { year: number }>(xs: T[] | null | undefined): T | null {
  if (!xs || xs.length === 0) return null;
  return [...xs].sort((a, b) => b.year - a.year)[0];
}

type PerCityRaw = {
  city: CityRow;
  cost_index: number | null;
  crime: number | null;
  climate: number | null;
  walk: number | null;
  job_market: number | null;
  aqi: number | null;
  education: number | null;
};

async function main() {
  console.log("UrbRank Score compute — loading data…");
  const { data: raw, error } = await supabase
    .from("cities")
    .select(
      `
      id, name, state_code,
      city_costs ( year, cost_index, median_household_income ),
      city_demographics ( year, unemployment_rate, college_educated_pct ),
      city_quality ( year, crime_rate_per_100k, avg_temp_summer, avg_temp_winter,
                     annual_precipitation, walk_score, air_quality_index )
    `,
    )
    .range(0, 999);
  if (error) throw new Error(`Load failed: ${error.message}`);
  const cities = (raw ?? []) as unknown as CityRow[];
  console.log(`Loaded ${cities.length} cities.\n`);

  // Only 179/498 cities have NCEI temp data. Without a fallback, the
  // ~320 cities with null climate drop that dimension entirely and their
  // remaining dimensions get re-weighted — which means cheap-but-cold
  // Midwest suburbs (Parma OH, etc.) end up topping climate-weighted
  // rankings like retirees and remote workers. Fix: fall back to each
  // state's average temperature from cities in the same state that DO
  // have data. Coarser than real NCEI station data but still a real
  // geographic signal, and it keeps every city scorable.
  const stateClimateAgg = new Map<
    string,
    { summer: number[]; winter: number[]; precip: number[] }
  >();
  for (const city of cities) {
    const qual = latest(city.city_quality);
    if (!qual) continue;
    const sc = city.state_code;
    if (!stateClimateAgg.has(sc))
      stateClimateAgg.set(sc, { summer: [], winter: [], precip: [] });
    const agg = stateClimateAgg.get(sc)!;
    if (qual.avg_temp_summer != null) agg.summer.push(qual.avg_temp_summer);
    if (qual.avg_temp_winter != null) agg.winter.push(qual.avg_temp_winter);
    if (qual.annual_precipitation != null) agg.precip.push(qual.annual_precipitation);
  }
  function avg(xs: number[]): number | null {
    if (xs.length === 0) return null;
    return xs.reduce((s, x) => s + x, 0) / xs.length;
  }
  const stateClimate = new Map<
    string,
    {
      summer: number | null;
      winter: number | null;
      precip: number | null;
    }
  >();
  for (const [sc, agg] of stateClimateAgg) {
    stateClimate.set(sc, {
      summer: avg(agg.summer),
      winter: avg(agg.winter),
      precip: avg(agg.precip),
    });
  }

  // Collect raw per-city values
  let climateFallbackCount = 0;
  const perCity: PerCityRaw[] = cities.map((city) => {
    const cost = latest(city.city_costs);
    const demo = latest(city.city_demographics);
    const qual = latest(city.city_quality);
    // Climate with state-average fallback. A city that has real NCEI data
    // uses it; a city that doesn't uses the state average, which typically
    // comes from 2-5 in-state cities with real data.
    let summer = qual?.avg_temp_summer ?? null;
    let winter = qual?.avg_temp_winter ?? null;
    let precip = qual?.annual_precipitation ?? null;
    if (summer == null || winter == null) {
      const fallback = stateClimate.get(city.state_code);
      if (fallback) {
        if (summer == null && fallback.summer != null) summer = fallback.summer;
        if (winter == null && fallback.winter != null) winter = fallback.winter;
        if (precip == null && fallback.precip != null) precip = fallback.precip;
        climateFallbackCount++;
      }
    }
    return {
      city,
      cost_index: cost?.cost_index ?? null,
      crime: qual?.crime_rate_per_100k ?? null,
      climate: rawClimateScore(summer, winter, precip),
      walk: qual?.walk_score ?? null,
      job_market: rawJobMarketScore(
        demo?.unemployment_rate ?? null,
        cost?.median_household_income ?? null,
      ),
      aqi: qual?.air_quality_index ?? null,
      education: demo?.college_educated_pct ?? null,
    };
  });
  console.log(
    `  ${climateFallbackCount} cities using state-average climate fallback\n`,
  );

  // Build sorted arrays for percentile-rank normalization
  const sorted = (key: keyof PerCityRaw): number[] =>
    perCity
      .map((c) => c[key])
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);

  const sortedCost = sorted("cost_index");
  const sortedCrime = sorted("crime");
  const sortedClimate = sorted("climate");
  const sortedJob = sorted("job_market");
  const sortedAqi = sorted("aqi");
  const sortedEducation = sorted("education");

  // Compute dimension scores per city
  type Dims = Partial<Record<DimensionKey, number>>;
  const dimsByCity = new Map<string, Dims>();
  for (const c of perCity) {
    const d: Dims = {};
    if (c.cost_index != null) {
      d.affordability = invertPercentile(
        percentileRank(c.cost_index, sortedCost),
      );
    }
    if (c.crime != null) {
      d.safety = invertPercentile(percentileRank(c.crime, sortedCrime));
    }
    if (c.climate != null) {
      d.climate = percentileRank(c.climate, sortedClimate);
    }
    if (c.walk != null) {
      d.walkability = c.walk; // already 0-100
    }
    if (c.job_market != null) {
      d.job_market = percentileRank(c.job_market, sortedJob);
    }
    if (c.aqi != null) {
      d.environment = invertPercentile(percentileRank(c.aqi, sortedAqi));
    }
    if (c.education != null) {
      d.education = percentileRank(c.education, sortedEducation);
    }
    // Round to whole numbers for storage
    for (const k of DIMENSIONS) {
      if (d[k] != null) d[k] = Math.round(d[k] as number);
    }
    dimsByCity.set(c.city.id, d);
  }

  // Compute weighted scores per (city, profile)
  type ScoreRow = {
    city_id: string;
    profile: string;
    score: number;
    grade: string;
    national_rank: number | null;
    dimension_scores: Dims;
    computed_at?: string;
  };

  const rows: ScoreRow[] = [];
  for (const profile of PROFILES) {
    const perProfile: ScoreRow[] = [];
    for (const c of perCity) {
      const dims = dimsByCity.get(c.city.id) ?? {};
      const { score, effectiveWeight } = weightedProfileScore(dims, profile);
      if (effectiveWeight === 0) continue;
      perProfile.push({
        city_id: c.city.id,
        profile,
        score,
        grade: gradeFor(score),
        national_rank: null,
        dimension_scores: dims,
      });
    }
    // Assign national rank within this profile
    perProfile.sort((a, b) => b.score - a.score);
    perProfile.forEach((row, i) => {
      row.national_rank = i + 1;
    });
    rows.push(...perProfile);

    // Sample log: top + bottom city for this profile
    const top = perProfile[0];
    const bot = perProfile[perProfile.length - 1];
    const topCity = perCity.find((c) => c.city.id === top?.city_id)?.city;
    const botCity = perCity.find((c) => c.city.id === bot?.city_id)?.city;
    console.log(
      `  ${profile.padEnd(20)} n=${perProfile.length}, ` +
        `top: ${topCity?.name}, ${topCity?.state_code} (${top?.score}/${top?.grade}), ` +
        `bottom: ${botCity?.name}, ${botCity?.state_code} (${bot?.score}/${bot?.grade})`,
    );
  }

  console.log(`\nUpserting ${rows.length} urbrank_scores rows…`);
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: upErr } = await supabase
      .from("urbrank_scores")
      .upsert(chunk, { onConflict: "city_id,profile" });
    if (upErr) {
      console.error(`  chunk ${i} failed: ${upErr.message}`);
    }
  }

  // Score distribution (general profile)
  const general = rows.filter((r) => r.profile === "general");
  const dist = {
    "A+": 0, A: 0, "A-": 0, "B+": 0, B: 0, "B-": 0,
    "C+": 0, C: 0, "C-": 0, D: 0, F: 0,
  } as Record<string, number>;
  for (const r of general) dist[r.grade]++;
  console.log("\nGrade distribution (general profile):");
  for (const [g, n] of Object.entries(dist)) {
    if (n > 0) console.log(`  ${g.padEnd(3)} ${n}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
