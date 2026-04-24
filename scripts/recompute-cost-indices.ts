/**
 * Recompute `cost_index` as a proper weighted composite of all 5 sub-indices,
 * and inject city-level variation into regional-fallback sub-indices so that
 * cities sharing a BLS region don't end up with identical grocery / utilities
 * / transportation / healthcare numbers.
 *
 * Idempotent: works in 2 passes.
 *   1. Recover the original regional baseline per region by picking the
 *      MODE (most common value) of each sub-index among cities tagged
 *      "BLS CPI-U (regional)". Those cities should have identical baseline
 *      values — if they don't (because of a partial prior run), the mode
 *      is the correct value and outliers are reset.
 *   2. For every city with data_source "BLS CPI-U (regional)", apply a
 *      dampened city-level adjustment based on housing_index vs regional
 *      median, then recompute the composite cost_index.
 *
 * Run: npx tsx scripts/recompute-cost-indices.ts
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { STATES } from "../lib/states";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase env in .env.local");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const STATE_TO_REGION = new Map(STATES.map((s) => [s.code, s.region]));

// Approximate BLS Consumer Expenditure Survey shares, normalized to the 5
// categories we track.
const SHARE = {
  housing: 0.33,
  grocery: 0.13,
  utilities: 0.07,
  transportation: 0.17,
  healthcare: 0.08,
} as const;

// Housing-variation pass-through into each sub-index. Tuned to match
// real-world inter-city variance: groceries barely vary, healthcare a lot.
const PASS_THROUGH = {
  grocery: 0.15,
  utilities: 0.2,
  transportation: 0.3,
  healthcare: 0.4,
} as const;

type CostRow = {
  id: string;
  city_id: string;
  year: number;
  cost_index: number | null;
  housing_index: number | null;
  grocery_index: number | null;
  utilities_index: number | null;
  transportation_index: number | null;
  healthcare_index: number | null;
  data_source: string | null;
};

type CityRow = {
  id: string;
  slug: string;
  state_code: string;
};

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/** Most common value in a list of numbers (rounded to 2 decimal places to
 *  group near-duplicates). Returns null if the list is empty. */
function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) {
    const k = Math.round(v * 100) / 100;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = values[0];
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function main() {
  console.log("Recompute cost indices — loading cities + costs…");

  const { data: citiesRaw, error: cErr } = await supabase
    .from("cities")
    .select("id, slug, state_code")
    .range(0, 999);
  if (cErr) throw new Error(cErr.message);
  const cityById = new Map<string, CityRow>();
  for (const c of (citiesRaw ?? []) as CityRow[]) cityById.set(c.id, c);
  console.log(`  ${cityById.size} cities loaded`);

  const { data: costsRaw, error: coErr } = await supabase
    .from("city_costs")
    .select(
      "id, city_id, year, cost_index, housing_index, grocery_index, utilities_index, transportation_index, healthcare_index, data_source",
    )
    .range(0, 1999);
  if (coErr) throw new Error(coErr.message);
  const costs = (costsRaw ?? []) as CostRow[];
  console.log(`  ${costs.length} city_costs rows loaded\n`);

  const latestByCity = new Map<string, CostRow>();
  for (const r of costs) {
    const prev = latestByCity.get(r.city_id);
    if (!prev || r.year > prev.year) latestByCity.set(r.city_id, r);
  }

  // Pass 1: recover the regional baseline for each sub-index by mode of
  // regional-source rows in each region. Uses data_source as the fingerprint.
  const subs = ["grocery_index", "utilities_index", "transportation_index", "healthcare_index"] as const;
  const regionalBaseline: Record<string, Record<string, number | null>> = {};

  for (const region of ["Northeast", "Midwest", "South", "West"]) {
    const regionalRows = [...latestByCity.values()].filter((r) => {
      const city = cityById.get(r.city_id);
      if (!city) return false;
      const cityRegion = STATE_TO_REGION.get(city.state_code);
      return cityRegion === region && (r.data_source ?? "").includes("(regional)");
    });
    const base: Record<string, number | null> = {};
    for (const k of subs) {
      const values = regionalRows
        .map((r) => r[k])
        .filter((v): v is number => v != null);
      base[k] = mode(values);
    }
    regionalBaseline[region] = base;
    console.log(
      `  region ${region}: n_regional=${regionalRows.length}, baseline grocery=${base.grocery_index}, utilities=${base.utilities_index}, transport=${base.transportation_index}, healthcare=${base.healthcare_index}`,
    );
  }

  // Compute regional median housing_index for city-level adjustment factor.
  const regionalMedianHousing = new Map<string, number>();
  for (const region of ["Northeast", "Midwest", "South", "West"]) {
    const values = [...latestByCity.values()]
      .filter((r) => {
        const city = cityById.get(r.city_id);
        return city && STATE_TO_REGION.get(city.state_code) === region;
      })
      .map((r) => r.housing_index)
      .filter((v): v is number => v != null);
    regionalMedianHousing.set(region, median(values));
  }
  console.log();
  for (const [region, v] of regionalMedianHousing) {
    console.log(`  region ${region}: median housing_index ${v.toFixed(2)}`);
  }
  console.log();

  // Pass 2: build updates. For regional-source rows, reset sub-indices to
  // the baseline then apply the city-level pass-through. For metro-source
  // rows, leave sub-indices alone. Recompute cost_index for everyone.
  type Update = {
    id: string;
    cost_index: number | null;
    grocery_index: number | null;
    utilities_index: number | null;
    transportation_index: number | null;
    healthcare_index: number | null;
  };
  const updates: Update[] = [];

  let tuned = 0;
  let kept = 0;

  for (const r of latestByCity.values()) {
    if (r.housing_index == null) continue;
    const city = cityById.get(r.city_id);
    if (!city) continue;
    const region = STATE_TO_REGION.get(city.state_code) ?? "South";

    const isRegionalBLS = (r.data_source ?? "").includes("(regional)");
    const base = regionalBaseline[region];
    const medianHousing = regionalMedianHousing.get(region) ?? r.housing_index;
    const housing_ratio = medianHousing > 0 ? r.housing_index / medianHousing : 1;

    let grocery_index: number | null;
    let utilities_index: number | null;
    let transportation_index: number | null;
    let healthcare_index: number | null;

    if (isRegionalBLS) {
      // Start from regional baseline (reset any prior adjustment).
      const g = base.grocery_index;
      const u = base.utilities_index;
      const t = base.transportation_index;
      const h = base.healthcare_index;
      grocery_index = g != null ? round2(g * (1 + PASS_THROUGH.grocery * (housing_ratio - 1))) : null;
      utilities_index = u != null ? round2(u * (1 + PASS_THROUGH.utilities * (housing_ratio - 1))) : null;
      transportation_index = t != null ? round2(t * (1 + PASS_THROUGH.transportation * (housing_ratio - 1))) : null;
      healthcare_index = h != null ? round2(h * (1 + PASS_THROUGH.healthcare * (housing_ratio - 1))) : null;
      tuned++;
    } else {
      // Metro-specific BLS — keep as-is.
      grocery_index = r.grocery_index != null ? round2(r.grocery_index) : null;
      utilities_index = r.utilities_index != null ? round2(r.utilities_index) : null;
      transportation_index = r.transportation_index != null ? round2(r.transportation_index) : null;
      healthcare_index = r.healthcare_index != null ? round2(r.healthcare_index) : null;
      kept++;
    }

    // Composite cost_index: weighted average of the 5 sub-indices,
    // re-normalized because they sum to 0.78 of consumer spending.
    const parts: { v: number; w: number }[] = [];
    parts.push({ v: r.housing_index, w: SHARE.housing });
    if (grocery_index != null) parts.push({ v: grocery_index, w: SHARE.grocery });
    if (utilities_index != null) parts.push({ v: utilities_index, w: SHARE.utilities });
    if (transportation_index != null) parts.push({ v: transportation_index, w: SHARE.transportation });
    if (healthcare_index != null) parts.push({ v: healthcare_index, w: SHARE.healthcare });
    const wsum = parts.reduce((s, p) => s + p.w, 0);
    const cost_index = wsum > 0 ? round2(parts.reduce((s, p) => s + p.v * p.w, 0) / wsum) : null;

    updates.push({
      id: r.id,
      cost_index,
      grocery_index,
      utilities_index,
      transportation_index,
      healthcare_index,
    });
  }

  console.log(`  ${tuned} regional cities adjusted, ${kept} metro cities kept as-is`);
  console.log(`\nUpdating ${updates.length} city_costs rows…`);

  // Concurrency-limited updates with retry.
  const CONCURRENCY = 8;
  const MAX_RETRY = 3;
  async function applyOne(u: Update, attempt = 1): Promise<void> {
    const { error } = await supabase
      .from("city_costs")
      .update({
        cost_index: u.cost_index,
        grocery_index: u.grocery_index,
        utilities_index: u.utilities_index,
        transportation_index: u.transportation_index,
        healthcare_index: u.healthcare_index,
      })
      .eq("id", u.id);
    if (error) {
      if (attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        return applyOne(u, attempt + 1);
      }
      console.error(`  row ${u.id} failed after ${MAX_RETRY} tries: ${error.message}`);
    }
  }

  let done = 0;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const batch = updates.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((u) => applyOne(u)));
    done += batch.length;
    if (done % 80 === 0 || done === updates.length) {
      console.log(`  ${done}/${updates.length} rows`);
    }
  }

  // Sanity check — print Auburn + Huntsville
  console.log("\nSanity check:");
  const { data: sample } = await supabase
    .from("cities")
    .select("id, name")
    .in("slug", ["auburn-al", "huntsville-al"]);
  if (sample) {
    for (const city of sample) {
      const { data: cc } = await supabase
        .from("city_costs")
        .select(
          "year, cost_index, housing_index, grocery_index, utilities_index, transportation_index, healthcare_index",
        )
        .eq("city_id", city.id)
        .order("year", { ascending: false })
        .limit(1);
      console.log(`  ${city.name}:`, cc?.[0]);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
