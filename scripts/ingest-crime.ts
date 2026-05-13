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
  latitude: number | null;
  longitude: number | null;
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
    // Fallback 1: "city of {city} police department" variant
    const cityOf = new RegExp(
      `^city of ${escaped}(\\s+${AGENCY_SUFFIXES.join("|\\s+")})?$`,
      "i",
    );
    const cityOfMatch = agencies.find((a) => cityOf.test(normalize(a.agency_name)));
    if (cityOfMatch) return cityOfMatch;

    // Fallback 2: consolidated city-county sheriff. Jacksonville/Duval, FL
    // is the canonical example — the city's only law-enforcement agency is
    // "Jacksonville Sheriff's Office", not a municipal PD and not a
    // county-named sheriff. Real counties use the county name in their
    // agency, so this stays safe from false positives.
    const sheriffPatterns = [
      new RegExp(`^${escaped}\\s+sheriff'?s?\\s+office$`, "i"),
      new RegExp(`^${escaped}\\s+sheriff'?s?\\s+department$`, "i"),
    ];
    const sheriffMatch = agencies.find((a) => {
      const name = normalize(a.agency_name);
      return sheriffPatterns.some((re) => re.test(name));
    });
    return sheriffMatch ?? null;
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
    .select("id, name, state_code, latitude, longitude")
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

/** Reverse-geocode lat/lon to a county via the FCC Census Block API. Free,
 *  no key, returns the county name as Census uses it (no "County" suffix —
 *  e.g. "Honolulu", "Orleans" for Louisiana parish, "Anchorage" for Alaska
 *  borough). Used only when an agency-name lookup fails, so worst case
 *  ~108 calls per run. */
type FccBlockResponse = {
  County?: { FIPS?: string; name?: string };
  State?: { code?: string; name?: string };
};
const countyCache = new Map<string, { name: string; fips: string } | null>();
async function lookupCounty(
  lat: number,
  lon: number,
): Promise<{ name: string; fips: string } | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (countyCache.has(key)) return countyCache.get(key) ?? null;
  const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      countyCache.set(key, null);
      return null;
    }
    const json = (await res.json()) as FccBlockResponse;
    if (!json.County?.name || !json.County.FIPS) {
      countyCache.set(key, null);
      return null;
    }
    const result = { name: json.County.name, fips: json.County.FIPS };
    countyCache.set(key, result);
    return result;
  } catch {
    countyCache.set(key, null);
    return null;
  }
}

/** Find the county-level sheriff/parish agency in a state's agency list.
 *  Tries several common naming patterns. Returns null when no match — some
 *  states (e.g. Hawaii) don't have county sheriffs at all. */
function findCountySheriff(
  countyName: string,
  agencies: Agency[],
): Agency | null {
  const norm = normalize(countyName);
  if (!norm) return null;
  const patterns = [
    `${norm} county sheriff's office`,
    `${norm} county sheriff office`,
    `${norm} county sheriff's department`,
    `${norm} county sheriff department`,
    `${norm} parish sheriff's office`,
    `${norm} parish sheriff office`,
    `${norm} sheriff's office`,
    `${norm} sheriff office`,
    `${norm} sheriffs office`,
  ];
  for (const p of patterns) {
    const found = agencies.find((a) => normalize(a.agency_name) === p);
    if (found) return found;
  }
  // Looser fallback: starts with county name AND mentions "sheriff"
  return (
    agencies.find((a) => {
      const n = normalize(a.agency_name);
      return n.startsWith(norm) && n.includes("sheriff");
    }) ?? null
  );
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

/** Upsert with per-chunk retry. Returns the count actually persisted; the
 *  caller uses this to decide whether to flag the run as partial. */
async function upsertQualityMerge(rows: QualityPartial[]): Promise<number> {
  if (rows.length === 0) return 0;
  const CHUNK = 200;
  let persisted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    let lastErr: string | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { error } = await supabase
          .from("city_quality")
          .upsert(chunk, { onConflict: "city_id,year" });
        if (!error) {
          persisted += chunk.length;
          lastErr = null;
          break;
        }
        lastErr = error.message;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(
        `  city_quality upsert [${i}..${i + chunk.length}] retry ${attempt}/${MAX_RETRIES} in ${backoff}ms — ${lastErr}`,
      );
      await sleep(backoff);
    }
    if (lastErr) {
      console.error(
        `  city_quality upsert failed [${i}..${i + chunk.length}] after ${MAX_RETRIES} retries: ${lastErr}`,
      );
    }
  }
  return persisted;
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

  let matched = 0;
  let countyFallback = 0;
  let unmatched = 0;
  let missing = 0;
  let totalPersisted = 0;
  // Per-state outcome so a flapping API or a Supabase blip surfaces clearly
  // at the end of the run instead of being buried mid-log.
  const stateStatus: { state: string; matched: number; persisted: number; failed: number }[] = [];

  for (let s = 0; s < states.length; s++) {
    const state = states[s];
    const cities = citiesByState.get(state) ?? [];

    const agencies = await fetchStateAgencies(state);
    if (agencies.length === 0) {
      console.warn(`[${s + 1}/${states.length}] ${state}: no agencies returned`);
      stateStatus.push({ state, matched: 0, persisted: 0, failed: 0 });
      continue;
    }

    // Buffer for THIS state only — flushed before we move on so a later
    // failure doesn't lose the work we already did.
    const stateRows: QualityPartial[] = [];
    let stateMatched = 0;
    for (const city of cities) {
      let agency = findAgency(city.name, agencies);
      let usedCountyFallback = false;

      if (!agency) {
        // City has no municipal PD match — try the county sheriff's office
        // for whichever county the city's centroid falls in. Catches CDPs,
        // sheriff-only jurisdictions, and consolidated city-counties whose
        // names don't match a PD pattern.
        if (city.latitude != null && city.longitude != null) {
          const county = await lookupCounty(city.latitude, city.longitude);
          if (county) {
            const sheriff = findCountySheriff(county.name, agencies);
            if (sheriff) {
              agency = sheriff;
              usedCountyFallback = true;
            }
          }
        }
      }

      if (!agency) {
        unmatched++;
        continue;
      }
      stateMatched++;
      if (usedCountyFallback) countyFallback++;
      else matched++;

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

      stateRows.push({
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

    // Persist this state's data immediately. If Supabase blips here we lose
    // at most one state's worth (typically <30 rows); the prior states are
    // already safe in the DB and the script is idempotent so a retry just
    // refills the gap.
    const persisted = await upsertQualityMerge(stateRows);
    const failed = stateRows.length - persisted;
    totalPersisted += persisted;
    stateStatus.push({ state, matched: stateMatched, persisted, failed });

    const tail = failed > 0 ? `  ⚠ ${failed} rows failed to persist` : "";
    console.log(
      `[${s + 1}/${states.length}] ${state}: matched ${stateMatched}/${cities.length} cities, persisted ${persisted}${tail}`,
    );
  }

  console.log(
    `\nMatched ${matched} city agencies + ${countyFallback} county-sheriff fallbacks (${unmatched} truly unmatched). Missing offense data: ${missing}.`,
  );
  console.log(
    `Persisted ${totalPersisted}/${matched + countyFallback - missing} rows to city_quality.`,
  );

  const partialStates = stateStatus.filter((s) => s.failed > 0);
  if (partialStates.length > 0) {
    console.log(
      `\n⚠ ${partialStates.length} states had partial persistence — re-run to fill gaps:`,
    );
    for (const s of partialStates) {
      console.log(`  ${s.state}: ${s.failed} rows lost`);
    }
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
