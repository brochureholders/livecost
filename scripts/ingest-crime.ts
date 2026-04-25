/**
 * Ingest FBI Crime Data Explorer (CDE) annual crime rates into city_quality.
 *
 * Flow per state:
 *   1. Fetch all agencies via /cde/agency/byStateAbbr/{STATE}.
 *   2. For each city in our DB in that state, fuzzy-match city name to the
 *      municipal PD agency and grab its ORI.
 *   3. Hit /cde/summarized/agency/{ORI}/{violent-crime|property-crime}
 *      with from=01-{year}&to=12-{year}. Sum the 12 monthly rates in the
 *      agency's own "{Agency Name} Offenses" series to get annual rate/100k.
 *   4. Upsert city_quality with violent_crime_rate, property_crime_rate,
 *      and crime_rate_per_100k (= violent + property).
 *
 * Run: npx tsx scripts/ingest-crime.ts
 * Requires: API_DATA_GOV_KEY + NEXT_PUBLIC_SUPABASE_URL + service-role key.
 *
 * KNOWN OUTAGE (2026-04-25): the api.usa.gov endpoint backing this script
 * was returning HTTP 403 from AWS ELB with no body — looks like a routing
 * change at api.usa.gov, not an auth issue (X-Api-Key header and api_key
 * query both reject identically). Last 500 cities ingested with this
 * pipeline still have crime data; the new 500 added in the 2026-04-25
 * city expansion are missing it. To retry:
 *   1. curl -i "https://api.usa.gov/crime/fbi/cde/agency/byStateAbbr/CA?api_key=$KEY"
 *   2. If 200, just re-run this script (it upserts on conflict).
 *   3. If still 403, check https://crime-data-explorer.app.cloud.gov/ for
 *      any API status notes.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const YEAR = 2022;
const FROM = `01-${YEAR}`;
const TO = `12-${YEAR}`;
const API_BASE = "https://api.usa.gov/crime/fbi";
const REQUEST_DELAY_MS = 400; // api.data.gov default: 1000 req/hour
const MAX_RETRIES = 4;

const API_KEY = process.env.API_DATA_GOV_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!API_KEY) throw new Error("Missing API_DATA_GOV_KEY in .env.local");
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Agency = {
  ori: string;
  agency_name: string;
  agency_type_name: string;
  state_abbr: string;
};

type CityRow = {
  id: string;
  name: string;
  state_code: string;
};

type SummarizedResponse = {
  offenses?: {
    rates?: Record<string, Record<string, number>>;
  };
};

type QualityPartial = {
  city_id: string;
  year: number;
  violent_crime_rate: number | null;
  property_crime_rate: number | null;
  crime_rate_per_100k: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string, label: string): Promise<T | null> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        const backoff = 1000 * 2 ** (attempt - 1);
        console.warn(
          `  [${label}] HTTP ${res.status}, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        );
        await sleep(backoff);
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) {
        console.warn(`  [${label}] HTTP ${res.status}: ${await res.text()}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(
        `  [${label}] network error, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        err,
      );
      await sleep(backoff);
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} retries: ${label} — ${lastErr}`);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/saint /g, "st ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip common Census place suffixes to get a bare city name. */
function cityKey(name: string): string {
  return normalize(
    name
      .replace(/\s+(city|town|village|borough|CDP|municipality|township|metropolitan government|unified government|consolidated government|urban county|balance|planning area).*/i, "")
      .trim(),
  );
}

/** Suffixes we accept on a municipal police agency name. */
const AGENCY_SUFFIXES = [
  "police department",
  "metropolitan police department",
  "consolidated police department",
  "department of public safety",
  "public safety",
  "police",
];

/** Strict city→agency match. Returns the municipal/city police department
 *  whose name is exactly "{city} [city] {suffix}", not some other city that
 *  merely shares a prefix (e.g. New York ≠ New York Mills). */
function findAgency(cityName: string, agencies: Agency[]): Agency | null {
  const key = cityKey(cityName);
  if (!key) return null;

  // Build the set of acceptable regex patterns for exact-ish matches.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = AGENCY_SUFFIXES.map(
    (suffix) => new RegExp(`^${escaped}(\\s+city)?\\s+${suffix}$`, "i"),
  );

  // Collect candidates that match any of the patterns.
  const strict = agencies.filter((a) => {
    const name = normalize(a.agency_name);
    return patterns.some((re) => re.test(name));
  });

  if (strict.length === 0) {
    // Fallback: "city of {city} police department" variant
    const cityOf = new RegExp(
      `^city of ${escaped}(\\s+${AGENCY_SUFFIXES.join("|\\s+")})?$`,
      "i",
    );
    const fallback = agencies.find((a) => cityOf.test(normalize(a.agency_name)));
    return fallback ?? null;
  }

  // Rank: prefer "City"-type agencies over "County" / "Other" / "University".
  const municipalType = strict.find((c) =>
    /^city|^municipal/i.test(c.agency_type_name),
  );
  return municipalType ?? strict[0];
}

function sumMonthly(series: Record<string, number> | undefined): number | null {
  if (!series) return null;
  const vals = Object.values(series);
  if (vals.length === 0) return null;
  return Number(vals.reduce((a, b) => a + b, 0).toFixed(2));
}

/** From a /summarized response, find the agency-specific rate series. */
function agencyRate(
  resp: SummarizedResponse,
  agencyName: string,
): number | null {
  const rates = resp.offenses?.rates ?? {};
  const needle = `${agencyName} Offenses`;
  const direct = rates[needle];
  if (direct) return sumMonthly(direct);
  // Fallback: any key ending in "Offenses" that isn't a state/US label
  for (const [key, series] of Object.entries(rates)) {
    if (
      key.endsWith(" Offenses") &&
      !key.startsWith("United States") &&
      key !== "New York Offenses" // state label — skip; we want agency-specific
    ) {
      return sumMonthly(series);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
async function loadCitiesByState(): Promise<Map<string, CityRow[]>> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, state_code")
    .order("population", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to load cities: ${error.message}`);
  const byState = new Map<string, CityRow[]>();
  for (const c of (data ?? []) as CityRow[]) {
    const arr = byState.get(c.state_code) ?? [];
    arr.push(c);
    byState.set(c.state_code, arr);
  }
  return byState;
}

async function fetchStateAgencies(stateCode: string): Promise<Agency[]> {
  const url = `${API_BASE}/cde/agency/byStateAbbr/${stateCode}?api_key=${API_KEY}`;
  const json = await fetchJson<Record<string, Agency[]>>(
    url,
    `agencies ${stateCode}`,
  );
  if (!json) return [];
  return Object.values(json).flat();
}

async function fetchOffense(
  ori: string,
  offense: "violent-crime" | "property-crime",
): Promise<SummarizedResponse | null> {
  const url = `${API_BASE}/cde/summarized/agency/${ori}/${offense}?from=${FROM}&to=${TO}&api_key=${API_KEY}`;
  return fetchJson<SummarizedResponse>(url, `${offense} ${ori}`);
}

async function upsertQualityMerge(rows: QualityPartial[]) {
  if (rows.length === 0) return;

  // Fetch existing quality rows so we preserve weather fields set by
  // ingest-weather.ts (ON CONFLICT preserves unlisted columns, but our
  // columns overlap — this path just keeps the crime columns clean).
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("city_quality")
      .upsert(chunk, { onConflict: "city_id,year" });
    if (error) {
      console.error(
        `  city_quality upsert failed [${i}..${i + chunk.length}]: ${error.message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`UrbRank crime ingest — FBI CDE ${YEAR}\n`);

  const citiesByState = await loadCitiesByState();
  const states = [...citiesByState.keys()].sort();
  console.log(
    `Loaded ${[...citiesByState.values()].flat().length} cities across ${states.length} states\n`,
  );

  const out: QualityPartial[] = [];
  let matched = 0;
  let unmatched = 0;
  let missing = 0;

  for (let s = 0; s < states.length; s++) {
    const state = states[s];
    const cities = citiesByState.get(state) ?? [];

    const agencies = await fetchStateAgencies(state);
    if (agencies.length === 0) {
      console.warn(`[${s + 1}/${states.length}] ${state}: no agencies returned`);
      continue;
    }

    let stateMatched = 0;
    for (const city of cities) {
      const agency = findAgency(city.name, agencies);
      if (!agency) {
        unmatched++;
        continue;
      }
      stateMatched++;
      matched++;

      const [violent, property] = await Promise.all([
        fetchOffense(agency.ori, "violent-crime"),
        fetchOffense(agency.ori, "property-crime"),
      ]);
      await sleep(REQUEST_DELAY_MS);

      const vRate = violent ? agencyRate(violent, agency.agency_name) : null;
      const pRate = property ? agencyRate(property, agency.agency_name) : null;
      if (vRate == null && pRate == null) {
        missing++;
        continue;
      }

      out.push({
        city_id: city.id,
        year: YEAR,
        violent_crime_rate: vRate,
        property_crime_rate: pRate,
        crime_rate_per_100k:
          vRate != null && pRate != null
            ? Number((vRate + pRate).toFixed(2))
            : (vRate ?? pRate ?? null),
      });
    }

    console.log(
      `[${s + 1}/${states.length}] ${state}: matched ${stateMatched}/${cities.length} cities`,
    );
  }

  console.log(
    `\nMatched ${matched} agencies (${unmatched} unmatched). Missing offense data: ${missing}.`,
  );
  console.log(`Upserting ${out.length} city_quality rows…`);
  await upsertQualityMerge(out);
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
