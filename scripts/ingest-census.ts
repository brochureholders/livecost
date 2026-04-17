/**
 * Ingest US Census ACS 5-Year data into Supabase.
 *
 * Run: npx tsx scripts/ingest-census.ts
 * Requires in .env.local: CENSUS_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * and either SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const YEAR = 2022;
const API_BASE = `https://api.census.gov/data/${YEAR}/acs/acs5`;
const TOP_N = 500;
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 4;

const CENSUS_API_KEY = process.env.CENSUS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!CENSUS_API_KEY) throw new Error("Missing CENSUS_API_KEY in .env.local");
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Variables we pull from ACS
// ---------------------------------------------------------------------------
const VAR = {
  income: "B19013_001E",
  homeValue: "B25077_001E",
  rent: "B25064_001E",
  population: "B01003_001E",
  medianAge: "B01002_001E",
  unemployed: "B23025_005E",
  laborForce: "B23025_003E",
  povertyBelow: "B17001_002E",
  povertyUniverse: "B17001_001E",
  edu22: "B15003_022E", // Bachelor's
  edu23: "B15003_023E", // Master's
  edu24: "B15003_024E", // Professional
  edu25: "B15003_025E", // Doctorate
  eduUniverse: "B15003_001E",
  commute: "B08303_001E",
} as const;

const VAR_LIST = Object.values(VAR);

// ---------------------------------------------------------------------------
// State FIPS (50 states + DC). Territories omitted — focus is US cities.
// ---------------------------------------------------------------------------
const STATES: { fips: string; code: string; name: string }[] = [
  { fips: "01", code: "AL", name: "Alabama" },
  { fips: "02", code: "AK", name: "Alaska" },
  { fips: "04", code: "AZ", name: "Arizona" },
  { fips: "05", code: "AR", name: "Arkansas" },
  { fips: "06", code: "CA", name: "California" },
  { fips: "08", code: "CO", name: "Colorado" },
  { fips: "09", code: "CT", name: "Connecticut" },
  { fips: "10", code: "DE", name: "Delaware" },
  { fips: "11", code: "DC", name: "District of Columbia" },
  { fips: "12", code: "FL", name: "Florida" },
  { fips: "13", code: "GA", name: "Georgia" },
  { fips: "15", code: "HI", name: "Hawaii" },
  { fips: "16", code: "ID", name: "Idaho" },
  { fips: "17", code: "IL", name: "Illinois" },
  { fips: "18", code: "IN", name: "Indiana" },
  { fips: "19", code: "IA", name: "Iowa" },
  { fips: "20", code: "KS", name: "Kansas" },
  { fips: "21", code: "KY", name: "Kentucky" },
  { fips: "22", code: "LA", name: "Louisiana" },
  { fips: "23", code: "ME", name: "Maine" },
  { fips: "24", code: "MD", name: "Maryland" },
  { fips: "25", code: "MA", name: "Massachusetts" },
  { fips: "26", code: "MI", name: "Michigan" },
  { fips: "27", code: "MN", name: "Minnesota" },
  { fips: "28", code: "MS", name: "Mississippi" },
  { fips: "29", code: "MO", name: "Missouri" },
  { fips: "30", code: "MT", name: "Montana" },
  { fips: "31", code: "NE", name: "Nebraska" },
  { fips: "32", code: "NV", name: "Nevada" },
  { fips: "33", code: "NH", name: "New Hampshire" },
  { fips: "34", code: "NJ", name: "New Jersey" },
  { fips: "35", code: "NM", name: "New Mexico" },
  { fips: "36", code: "NY", name: "New York" },
  { fips: "37", code: "NC", name: "North Carolina" },
  { fips: "38", code: "ND", name: "North Dakota" },
  { fips: "39", code: "OH", name: "Ohio" },
  { fips: "40", code: "OK", name: "Oklahoma" },
  { fips: "41", code: "OR", name: "Oregon" },
  { fips: "42", code: "PA", name: "Pennsylvania" },
  { fips: "44", code: "RI", name: "Rhode Island" },
  { fips: "45", code: "SC", name: "South Carolina" },
  { fips: "46", code: "SD", name: "South Dakota" },
  { fips: "47", code: "TN", name: "Tennessee" },
  { fips: "48", code: "TX", name: "Texas" },
  { fips: "49", code: "UT", name: "Utah" },
  { fips: "50", code: "VT", name: "Vermont" },
  { fips: "51", code: "VA", name: "Virginia" },
  { fips: "53", code: "WA", name: "Washington" },
  { fips: "54", code: "WV", name: "West Virginia" },
  { fips: "55", code: "WI", name: "Wisconsin" },
  { fips: "56", code: "WY", name: "Wyoming" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RawPlace = {
  name: string;
  stateFips: string;
  placeFips: string;
  values: Record<string, string | null>;
};

type CityRow = {
  slug: string;
  name: string;
  state: string;
  state_code: string;
  fips_code: string;
  population: number | null;
};

type ParsedPlace = {
  city: CityRow;
  costs: {
    median_household_income: number | null;
    median_home_value: number | null;
    median_rent: number | null;
    grocery_index: number | null;
    housing_index: number | null;
    utilities_index: number | null;
    transportation_index: number | null;
    healthcare_index: number | null;
  };
  demographics: {
    median_age: number | null;
    unemployment_rate: number | null;
    poverty_rate: number | null;
    college_educated_pct: number | null;
    commute_time_avg: number | null;
    population_growth_pct: number | null;
  };
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, label: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        const backoff = 500 * 2 ** (attempt - 1);
        console.warn(
          `  [${label}] HTTP ${res.status}, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        );
        await sleep(backoff);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const backoff = 500 * 2 ** (attempt - 1);
      console.warn(
        `  [${label}] network error, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        err,
      );
      await sleep(backoff);
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} retries: ${label} — ${lastErr}`);
}

function buildUrl(params: Record<string, string>) {
  const qp = new URLSearchParams({ ...params, key: CENSUS_API_KEY! });
  return `${API_BASE}?${qp.toString()}`;
}

// ---------------------------------------------------------------------------
// Census parsing
// ---------------------------------------------------------------------------
const PLACE_SUFFIX_RE =
  /\s+(city|town|village|borough|CDP|municipality|township|urban county|consolidated government|metropolitan government|unified government|planning area|comunidad|zona urbana)$/i;

function cleanPlaceName(raw: string): { name: string; state: string } {
  // Example: "Austin city, Texas" → name="Austin", state="Texas"
  const [placeRaw, state = ""] = raw.split(", ").map((s) => s.trim());
  const name = placeRaw.replace(PLACE_SUFFIX_RE, "").trim();
  return { name, state };
}

function slugify(name: string, stateCode: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${stateCode.toLowerCase()}`;
}

function num(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  // Census uses negative sentinel values (e.g., -666666666) for suppressed data
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

// ---------------------------------------------------------------------------
// Census fetchers
// ---------------------------------------------------------------------------
async function fetchPlacesForState(
  stateFips: string,
  stateName: string,
): Promise<RawPlace[]> {
  const url = buildUrl({
    get: ["NAME", ...VAR_LIST].join(","),
    for: "place:*",
    in: `state:${stateFips}`,
  });
  const res = await fetchWithRetry(url, `state=${stateName}`);
  if (!res.ok) {
    throw new Error(
      `Census API ${res.status} for ${stateName}: ${await res.text()}`,
    );
  }
  const data = (await res.json()) as string[][];
  if (!Array.isArray(data) || data.length < 2) return [];

  const [headers, ...rows] = data;
  const idx = Object.fromEntries(headers.map((h, i) => [h, i])) as Record<
    string,
    number
  >;

  return rows.map((row) => {
    const values: Record<string, string | null> = {};
    for (const v of VAR_LIST) values[v] = row[idx[v]] ?? null;
    return {
      name: row[idx.NAME],
      stateFips: row[idx.state],
      placeFips: row[idx.place],
      values,
    };
  });
}

async function fetchNationalMedianRent(): Promise<number> {
  const url = buildUrl({ get: VAR.rent, for: "us:1" });
  const res = await fetchWithRetry(url, "national-rent");
  if (!res.ok) {
    throw new Error(`Census API ${res.status} for national rent`);
  }
  const data = (await res.json()) as string[][];
  const rent = num(data[1][0]);
  if (rent == null) throw new Error("Could not parse national median rent");
  return rent;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
function parsePlace(
  raw: RawPlace,
  stateCode: string,
  nationalMedianRent: number,
): ParsedPlace | null {
  const { name } = cleanPlaceName(raw.name);
  if (!name) return null;

  const v = raw.values;
  const population = num(v[VAR.population]);
  const rent = num(v[VAR.rent]);

  const unemployed = num(v[VAR.unemployed]);
  const laborForce = num(v[VAR.laborForce]);
  const povertyBelow = num(v[VAR.povertyBelow]);
  const povertyUniverse = num(v[VAR.povertyUniverse]);
  const eduBachelorsPlus =
    (num(v[VAR.edu22]) ?? 0) +
    (num(v[VAR.edu23]) ?? 0) +
    (num(v[VAR.edu24]) ?? 0) +
    (num(v[VAR.edu25]) ?? 0);
  const eduUniverse = num(v[VAR.eduUniverse]);

  const housingIndex = ratio(rent, nationalMedianRent);

  // FIPS-derived state code from the raw row is authoritative; we also pass it in
  const fipsCode = `${raw.stateFips}${raw.placeFips}`;
  const { state } = cleanPlaceName(raw.name);

  return {
    city: {
      slug: slugify(name, stateCode),
      name,
      state,
      state_code: stateCode,
      fips_code: fipsCode,
      population,
    },
    costs: {
      median_household_income: num(v[VAR.income]),
      median_home_value: num(v[VAR.homeValue]),
      median_rent: rent,
      grocery_index: null,
      housing_index: housingIndex,
      utilities_index: null,
      transportation_index: null,
      healthcare_index: null,
    },
    demographics: {
      median_age: num(v[VAR.medianAge]),
      unemployment_rate: ratio(unemployed, laborForce),
      poverty_rate: ratio(povertyBelow, povertyUniverse),
      college_educated_pct: ratio(eduBachelorsPlus, eduUniverse),
      commute_time_avg: num(v[VAR.commute]),
      population_growth_pct: null,
    },
  };
}

function costIndexFor(rent: number | null, nationalMedianRent: number): number | null {
  if (rent == null || nationalMedianRent === 0) return null;
  return Number(((rent / nationalMedianRent) * 100).toFixed(2));
}

// ---------------------------------------------------------------------------
// Supabase upserts
// ---------------------------------------------------------------------------
async function upsertCities(rows: CityRow[]): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("cities")
    .upsert(rows, { onConflict: "slug" })
    .select("id,slug");
  if (error) throw new Error(`Cities upsert failed: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.slug as string, r.id as string]));
}

async function upsertBatch<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string,
) {
  if (rows.length === 0) return;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`LiveCost Census ingest — ACS ${YEAR}, top ${TOP_N} cities\n`);

  console.log("Fetching national median rent…");
  const nationalMedianRent = await fetchNationalMedianRent();
  console.log(`  national median rent = $${nationalMedianRent}\n`);

  const parsed: ParsedPlace[] = [];
  for (let i = 0; i < STATES.length; i++) {
    const state = STATES[i];
    try {
      const places = await fetchPlacesForState(state.fips, state.name);
      const kept: ParsedPlace[] = [];
      for (const raw of places) {
        const p = parsePlace(raw, state.code, nationalMedianRent);
        if (p && p.city.population != null) kept.push(p);
      }
      kept.sort((a, b) => (b.city.population ?? 0) - (a.city.population ?? 0));
      parsed.push(...kept);

      const sample = kept[0];
      const sampleStr = sample
        ? `${sample.city.name}, ${state.code}: income=$${sample.costs.median_household_income ?? "?"}, rent=$${sample.costs.median_rent ?? "?"}`
        : "no qualifying places";
      console.log(
        `Processed ${i + 1}/${STATES.length} states — ${sampleStr}`,
      );
    } catch (err) {
      console.error(`  FAILED state ${state.name}:`, err);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nTotal parsed places: ${parsed.length}`);
  parsed.sort((a, b) => (b.city.population ?? 0) - (a.city.population ?? 0));
  const top = parsed.slice(0, TOP_N);
  console.log(`Keeping top ${top.length} by population.\n`);

  console.log("Upserting cities…");
  const cityRows = top.map((p) => p.city);
  const slugToId = await upsertCities(cityRows);
  console.log(`  inserted/updated ${slugToId.size} cities`);

  const costRows = top
    .map((p) => {
      const id = slugToId.get(p.city.slug);
      if (!id) return null;
      return {
        city_id: id,
        year: YEAR,
        ...p.costs,
        cost_index: costIndexFor(p.costs.median_rent, nationalMedianRent),
        data_source: "US Census ACS 5-Year",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const demoRows = top
    .map((p) => {
      const id = slugToId.get(p.city.slug);
      if (!id) return null;
      return { city_id: id, year: YEAR, ...p.demographics };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  console.log("Upserting city_costs…");
  await upsertBatch("city_costs", costRows, "city_id,year");
  console.log(`  upserted ${costRows.length} rows`);

  console.log("Upserting city_demographics…");
  await upsertBatch("city_demographics", demoRows, "city_id,year");
  console.log(`  upserted ${demoRows.length} rows`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
