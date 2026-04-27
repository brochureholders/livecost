/**
 * Audit data coverage across all cities.
 *
 * For every city, checks which of the 7 scoring dimensions have real data,
 * fallback data (climate only — uses state averages), or are missing entirely.
 * Reports per-dimension fill rates, the distribution of completeness, and the
 * weakest cities so we can decide whether to flag low-data pages in the UI,
 * deprioritize them in the sitemap, or backfill specific sources.
 *
 * Run: npx tsx scripts/audit-coverage.ts
 *
 * Writes a JSON report to data/coverage-report.json.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

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

const DIMENSIONS = [
  "affordability",
  "safety",
  "climate",
  "walkability",
  "job_market",
  "environment",
  "education",
] as const;
type Dim = (typeof DIMENSIONS)[number];
type Status = "present" | "fallback" | "missing";

type CostRow = {
  year: number;
  cost_index: number | null;
  median_household_income: number | null;
  median_rent: number | null;
  median_home_value: number | null;
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
  slug: string;
  population: number | null;
  city_costs: CostRow[] | null;
  city_demographics: DemoRow[] | null;
  city_quality: QualRow[] | null;
};

function latest<T extends { year: number }>(xs: T[] | null | undefined): T | null {
  if (!xs || xs.length === 0) return null;
  return [...xs].sort((a, b) => b.year - a.year)[0];
}

async function main() {
  console.log("Coverage audit — loading…");
  const { data, error } = await supabase
    .from("cities")
    .select(
      `
      id, name, state_code, slug, population,
      city_costs ( year, cost_index, median_household_income, median_rent, median_home_value ),
      city_demographics ( year, unemployment_rate, college_educated_pct ),
      city_quality ( year, crime_rate_per_100k, avg_temp_summer, avg_temp_winter,
                     annual_precipitation, walk_score, air_quality_index )
    `,
    )
    .range(0, 9999);
  if (error) throw new Error(`Load failed: ${error.message}`);
  const cities = (data ?? []) as unknown as CityRow[];
  console.log(`Loaded ${cities.length} cities.\n`);

  // Build per-state availability for the climate fallback signal — matches
  // compute-urbrank-scores.ts so we report the same fallback fan-out.
  const stateHasClimate = new Set<string>();
  for (const city of cities) {
    const q = latest(city.city_quality);
    if (
      q &&
      (q.avg_temp_summer != null ||
        q.avg_temp_winter != null ||
        q.annual_precipitation != null)
    ) {
      stateHasClimate.add(city.state_code);
    }
  }

  type PerCity = {
    id: string;
    name: string;
    state_code: string;
    slug: string;
    population: number | null;
    dims: Record<Dim, Status>;
    presentCount: number;
  };
  const perCity: PerCity[] = cities.map((city) => {
    const cost = latest(city.city_costs);
    const demo = latest(city.city_demographics);
    const qual = latest(city.city_quality);

    const climateRaw =
      qual?.avg_temp_summer != null ||
      qual?.avg_temp_winter != null ||
      qual?.annual_precipitation != null;
    const climate: Status = climateRaw
      ? "present"
      : stateHasClimate.has(city.state_code)
        ? "fallback"
        : "missing";

    const dims: Record<Dim, Status> = {
      affordability: cost?.cost_index != null ? "present" : "missing",
      safety: qual?.crime_rate_per_100k != null ? "present" : "missing",
      climate,
      walkability: qual?.walk_score != null ? "present" : "missing",
      job_market:
        demo?.unemployment_rate != null && cost?.median_household_income != null
          ? "present"
          : "missing",
      environment: qual?.air_quality_index != null ? "present" : "missing",
      education: demo?.college_educated_pct != null ? "present" : "missing",
    };
    const presentCount = (Object.values(dims) as Status[]).filter(
      (s) => s === "present",
    ).length;
    return {
      id: city.id,
      name: city.name,
      state_code: city.state_code,
      slug: city.slug,
      population: city.population,
      dims,
      presentCount,
    };
  });

  const total = perCity.length;
  const pct = (n: number) => ((n / total) * 100).toFixed(1) + "%";

  // 1. Per-dimension fill rate
  console.log("== Per-dimension fill rate ==");
  console.log(
    `${"dimension".padEnd(14)} ${"present".padStart(8)} ${"fallback".padStart(9)} ${"missing".padStart(8)}`,
  );
  const dimSummary: Record<Dim, { present: number; fallback: number; missing: number }> =
    Object.fromEntries(
      DIMENSIONS.map((d) => [d, { present: 0, fallback: 0, missing: 0 }]),
    ) as Record<Dim, { present: number; fallback: number; missing: number }>;
  for (const c of perCity) {
    for (const d of DIMENSIONS) dimSummary[d][c.dims[d]]++;
  }
  for (const d of DIMENSIONS) {
    const s = dimSummary[d];
    console.log(
      `${d.padEnd(14)} ${pct(s.present).padStart(8)} ${pct(s.fallback).padStart(9)} ${pct(s.missing).padStart(8)}`,
    );
  }

  // 2. Distribution of "present" dimension count per city
  console.log("\n== Cities by # of dimensions with real data (out of 7) ==");
  const histogram = new Array(8).fill(0) as number[];
  for (const c of perCity) histogram[c.presentCount]++;
  for (let n = 7; n >= 0; n--) {
    if (histogram[n] === 0) continue;
    console.log(`  ${n}/7: ${histogram[n].toString().padStart(4)} cities (${pct(histogram[n])})`);
  }

  // 3. Cities with no cost_index — effectively unscorable for cost comparison
  const noCost = perCity.filter((c) => c.dims.affordability === "missing");
  console.log(`\n== ${noCost.length} cities have NO cost_index ==`);
  for (const c of noCost.slice(0, 20)) {
    console.log(`  ${c.name}, ${c.state_code} (pop ${c.population ?? "?"})`);
  }
  if (noCost.length > 20) console.log(`  … and ${noCost.length - 20} more`);

  // 4. Weakest comparison pages — large cities ranked by missing data
  console.log("\n== Top 30 weakest large cities (pop ≥ 100k, fewest dimensions) ==");
  const weak = perCity
    .filter((c) => (c.population ?? 0) >= 100_000)
    .sort(
      (a, b) =>
        a.presentCount - b.presentCount ||
        (b.population ?? 0) - (a.population ?? 0),
    )
    .slice(0, 30);
  for (const c of weak) {
    const missing = DIMENSIONS.filter((d) => c.dims[d] === "missing").join(", ");
    const fb = DIMENSIONS.filter((d) => c.dims[d] === "fallback").join(", ");
    const tag = [
      missing ? `missing: ${missing}` : null,
      fb ? `fallback: ${fb}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    console.log(
      `  ${c.presentCount}/7  ${c.name}, ${c.state_code} (${c.population})  ${tag}`,
    );
  }

  // 5. Sanity check — flag values that are physically implausible. Catches
  // bad ingest output (unit mix-ups, parse errors, decimal-point slips)
  // BEFORE they show up on the live site as a "wait that can't be right"
  // moment.
  const CURRENT_YEAR = new Date().getFullYear();
  type Anomaly = { city: string; field: string; value: unknown; rule: string };
  const anomalies: Anomaly[] = [];
  const flag = (city: string, field: string, value: unknown, rule: string) =>
    anomalies.push({ city, field, value, rule });

  for (const city of cities) {
    const label = `${city.name}, ${city.state_code}`;
    const cost = latest(city.city_costs);
    const demo = latest(city.city_demographics);
    const qual = latest(city.city_quality);

    if (cost) {
      if (cost.year < 2015 || cost.year > CURRENT_YEAR + 1)
        flag(label, "city_costs.year", cost.year, "year ∉ [2015, current+1]");
      if (cost.cost_index != null && (cost.cost_index < 50 || cost.cost_index > 300))
        flag(label, "cost_index", cost.cost_index, "expected 50–300");
      if (cost.median_rent != null && (cost.median_rent < 200 || cost.median_rent > 6000))
        flag(label, "median_rent", cost.median_rent, "expected $200–$6,000/mo");
      if (
        cost.median_home_value != null &&
        (cost.median_home_value < 20_000 || cost.median_home_value > 5_000_000)
      )
        flag(label, "median_home_value", cost.median_home_value, "expected $20k–$5M");
      if (
        cost.median_household_income != null &&
        (cost.median_household_income < 15_000 || cost.median_household_income > 300_000)
      )
        flag(
          label,
          "median_household_income",
          cost.median_household_income,
          "expected $15k–$300k",
        );
    }
    if (demo) {
      if (
        demo.unemployment_rate != null &&
        (demo.unemployment_rate < 0 || demo.unemployment_rate > 25)
      )
        flag(label, "unemployment_rate", demo.unemployment_rate, "expected 0–25%");
      if (
        demo.college_educated_pct != null &&
        (demo.college_educated_pct < 0 || demo.college_educated_pct > 100)
      )
        flag(label, "college_educated_pct", demo.college_educated_pct, "expected 0–100");
    }
    if (qual) {
      if (
        qual.crime_rate_per_100k != null &&
        (qual.crime_rate_per_100k < 0 || qual.crime_rate_per_100k > 30_000)
      )
        flag(label, "crime_rate_per_100k", qual.crime_rate_per_100k, "expected 0–30,000");
      if (
        qual.walk_score != null &&
        (qual.walk_score < 0 || qual.walk_score > 100)
      )
        flag(label, "walk_score", qual.walk_score, "expected 0–100");
      if (
        qual.avg_temp_summer != null &&
        (qual.avg_temp_summer < 50 || qual.avg_temp_summer > 110)
      )
        flag(label, "avg_temp_summer", qual.avg_temp_summer, "expected 50–110°F");
      if (
        qual.avg_temp_winter != null &&
        (qual.avg_temp_winter < -30 || qual.avg_temp_winter > 90)
      )
        flag(label, "avg_temp_winter", qual.avg_temp_winter, "expected -30–90°F");
      if (
        qual.air_quality_index != null &&
        (qual.air_quality_index < 0 || qual.air_quality_index > 500)
      )
        flag(label, "air_quality_index", qual.air_quality_index, "expected 0–500");
    }
  }

  console.log(`\n== Data sanity check ==`);
  if (anomalies.length === 0) {
    console.log("  No anomalies detected.");
  } else {
    console.log(`  ${anomalies.length} anomalies found:`);
    for (const a of anomalies.slice(0, 30)) {
      console.log(`  - ${a.city}: ${a.field} = ${a.value}  (${a.rule})`);
    }
    if (anomalies.length > 30) console.log(`  … and ${anomalies.length - 30} more`);
  }

  // 6. Diff against the previous report so backfill progress is visible.
  // Reads the existing JSON before we overwrite it; silently no-ops on the
  // first run when the file doesn't exist yet.
  const outPath = join(process.cwd(), "data", "coverage-report.json");
  type PrevCity = { slug: string; present: number; dims: Record<Dim, Status> };
  let prev: {
    generated_at?: string;
    per_dimension?: typeof dimSummary;
    cities?: PrevCity[];
  } | null = null;
  if (existsSync(outPath)) {
    try {
      prev = JSON.parse(readFileSync(outPath, "utf8"));
    } catch {
      prev = null;
    }
  }

  console.log(`\n== Changes since last run ==`);
  if (!prev || !prev.cities) {
    console.log("  No previous report on disk — first run, nothing to diff.");
  } else {
    const prevBySlug = new Map(prev.cities.map((c) => [c.slug, c]));
    const improved: { slug: string; from: number; to: number; gained: Dim[] }[] = [];
    const degraded: { slug: string; from: number; to: number; lost: Dim[] }[] = [];
    const swapped: { slug: string; gained: Dim[]; lost: Dim[] }[] = [];
    for (const c of perCity) {
      const p = prevBySlug.get(c.slug);
      if (!p) continue;
      const gained = DIMENSIONS.filter(
        (d) => p.dims[d] !== "present" && c.dims[d] === "present",
      );
      const lost = DIMENSIONS.filter(
        (d) => p.dims[d] === "present" && c.dims[d] !== "present",
      );
      if (c.presentCount > p.present) {
        improved.push({ slug: c.slug, from: p.present, to: c.presentCount, gained });
      } else if (c.presentCount < p.present) {
        degraded.push({ slug: c.slug, from: p.present, to: c.presentCount, lost });
      } else if (gained.length > 0 || lost.length > 0) {
        // Same count, different dims — one-for-one swap. Worth surfacing
        // since it can mask a silent regression in one source.
        swapped.push({ slug: c.slug, gained, lost });
      }
    }
    const newCities = perCity.filter((c) => !prevBySlug.has(c.slug)).length;
    const removed = prev.cities.filter(
      (p) => !perCity.find((c) => c.slug === p.slug),
    ).length;

    if (
      improved.length === 0 &&
      degraded.length === 0 &&
      swapped.length === 0 &&
      newCities === 0 &&
      removed === 0
    ) {
      console.log("  No changes since last run.");
    } else {
      if (newCities > 0) console.log(`  +${newCities} new cities added.`);
      if (removed > 0) console.log(`  -${removed} cities removed.`);
      if (improved.length > 0) {
        console.log(`  +${improved.length} cities gained dimensions:`);
        for (const i of improved.slice(0, 10)) {
          console.log(
            `    ${i.slug} (${i.from}/7 → ${i.to}/7) +${i.gained.join(", ")}`,
          );
        }
        if (improved.length > 10)
          console.log(`    … and ${improved.length - 10} more`);
      }
      if (degraded.length > 0) {
        console.log(`  -${degraded.length} cities lost dimensions:`);
        for (const d of degraded.slice(0, 10)) {
          console.log(
            `    ${d.slug} (${d.from}/7 → ${d.to}/7) -${d.lost.join(", ")}`,
          );
        }
        if (degraded.length > 10)
          console.log(`    … and ${degraded.length - 10} more`);
      }
      if (swapped.length > 0) {
        console.log(`  ~${swapped.length} cities swapped dimensions (count unchanged):`);
        for (const s of swapped.slice(0, 10)) {
          console.log(
            `    ${s.slug} +${s.gained.join(", ") || "—"} / -${s.lost.join(", ") || "—"}`,
          );
        }
        if (swapped.length > 10)
          console.log(`    … and ${swapped.length - 10} more`);
      }

      // Per-dimension delta
      if (prev.per_dimension) {
        const dimDeltas: { dim: Dim; deltaPresent: number }[] = [];
        for (const d of DIMENSIONS) {
          const before = prev.per_dimension[d]?.present ?? 0;
          const after = dimSummary[d].present;
          if (before !== after) dimDeltas.push({ dim: d, deltaPresent: after - before });
        }
        if (dimDeltas.length > 0) {
          console.log(`  Per-dimension change:`);
          for (const { dim, deltaPresent } of dimDeltas) {
            const sign = deltaPresent > 0 ? "+" : "";
            console.log(`    ${dim}: ${sign}${deltaPresent} cities`);
          }
        }
      }
    }
  }

  // 7. Write JSON for downstream use (UI badge, sitemap filter, etc.)
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_cities: total,
        per_dimension: dimSummary,
        histogram: Object.fromEntries(
          histogram.map((count, n) => [`${n}/7`, count]).filter(([, c]) => c),
        ),
        cities_missing_cost_index: noCost.map((c) => c.slug),
        anomalies,
        cities: perCity.map((c) => ({
          slug: c.slug,
          name: c.name,
          state_code: c.state_code,
          population: c.population,
          dims: c.dims,
          present: c.presentCount,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
