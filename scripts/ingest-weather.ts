/**
 * Ingest 30-year climate normals into city_quality via Open-Meteo.
 *
 * Flow per city:
 *   1. Geocode name + state (geocoding-api.open-meteo.com) → lat/lon
 *   2. Fetch 30 years of daily archive (1994-2023) in one call
 *   3. Compute normals: summer avg high, winter avg low, annual precipitation,
 *      sunny-days per year. Results upserted into city_quality.
 *
 * Run: npx tsx scripts/ingest-weather.ts
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *   No API key required — Open-Meteo is open.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const YEAR = 2022; // matches Census / BLS ingests for row alignment

/** Climate-normal window: most recent full 30-year period. */
const NORMAL_START = "1994-01-01";
const NORMAL_END = "2023-12-31";
const NORMAL_YEARS = 30;

const GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search";
const ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive";
// Open-Meteo fair-use: <600/min, <5000/hr, <10k/day. Archive calls are
// heavy (30yr daily data = ~400KB each), and the server aggressively
// drops connections when we push past ~1 req/sec, so be conservative.
const REQUEST_DELAY_MS = 2000;
const MAX_RETRIES = 5;

/** "Sunny day" threshold: daily sunshine duration in seconds. */
const SUNNY_THRESHOLD_SEC = 8 * 3600;

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CityRow = {
  id: string;
  name: string;
  state: string;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
};

type GeocodeHit = {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  admin1_code?: string;
  country_code?: string;
};

type ArchiveResponse = {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    sunshine_duration: (number | null)[];
  };
};

type QualityRow = {
  city_id: string;
  year: number;
  avg_temp_summer: number | null;
  avg_temp_winter: number | null;
  annual_precipitation: number | null;
  sunshine_days: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  label: string,
): Promise<Response> {
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
      return res;
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

/** Strip Census place suffixes that confuse geocoders. */
function cleanCityName(name: string): string {
  return name
    .replace(
      /\s+(city|town|village|borough|CDP|municipality|township|metropolitan government.*|unified government.*|consolidated government.*|urban county.*|planning area|comunidad|zona urbana)(\s*\(balance\))?\s*$/i,
      "",
    )
    .split("/")[0] // "Louisville/Jefferson County" → "Louisville"
    .split("-")[0] // "Nashville-Davidson" → "Nashville"
    .trim();
}

async function geocode(
  name: string,
  stateCode: string,
): Promise<{ lat: number; lon: number } | null> {
  const candidates = [name, cleanCityName(name)].filter(
    (n, i, arr) => n && arr.indexOf(n) === i,
  );
  for (const candidate of candidates) {
    const qp = new URLSearchParams({
      name: candidate,
      count: "5",
      language: "en",
      country: "US",
    });
    const url = `${GEOCODE_API}?${qp.toString()}`;
    const res = await fetchWithRetry(url, `geocode ${candidate},${stateCode}`);
    if (!res.ok) continue;
    const json = (await res.json()) as { results?: GeocodeHit[] };
    const hits = json.results ?? [];
    const match =
      hits.find((h) => (h.admin1_code ?? "").toUpperCase() === stateCode) ??
      hits[0];
    if (match) return { lat: match.latitude, lon: match.longitude };
  }
  return null;
}

async function fetchArchive(
  lat: number,
  lon: number,
): Promise<ArchiveResponse["daily"] | null> {
  const qp = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: NORMAL_START,
    end_date: NORMAL_END,
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "America/New_York",
  });
  const url = `${ARCHIVE_API}?${qp.toString()}`;
  const res = await fetchWithRetry(url, `archive ${lat.toFixed(2)},${lon.toFixed(2)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as ArchiveResponse;
  return json.daily ?? null;
}

function month(iso: string): number {
  return Number(iso.slice(5, 7));
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function deriveNormals(daily: ArchiveResponse["daily"]) {
  const n = daily.time.length;
  const summerHighs: number[] = [];
  const winterLows: number[] = [];
  let totalPrecip = 0;
  let sunnyCount = 0;

  for (let i = 0; i < n; i++) {
    const m = month(daily.time[i]);
    const tmax = daily.temperature_2m_max[i];
    const tmin = daily.temperature_2m_min[i];
    const precip = daily.precipitation_sum[i];
    const sun = daily.sunshine_duration[i];

    if (tmax != null && (m === 6 || m === 7 || m === 8)) summerHighs.push(tmax);
    if (tmin != null && (m === 12 || m === 1 || m === 2)) winterLows.push(tmin);
    if (precip != null) totalPrecip += precip;
    if (sun != null && sun >= SUNNY_THRESHOLD_SEC) sunnyCount++;
  }

  const summer = mean(summerHighs);
  const winter = mean(winterLows);
  const annualPrecip = totalPrecip / NORMAL_YEARS;
  const sunny = sunnyCount / NORMAL_YEARS;

  return {
    avg_temp_summer: summer != null ? Number(summer.toFixed(2)) : null,
    avg_temp_winter: winter != null ? Number(winter.toFixed(2)) : null,
    annual_precipitation: Number(annualPrecip.toFixed(2)),
    sunshine_days: Math.round(sunny),
  };
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
async function loadCities(): Promise<CityRow[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, state, state_code, latitude, longitude")
    .order("population", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to load cities: ${error.message}`);
  return (data ?? []) as CityRow[];
}

/** Return the set of city_ids that already have weather data for YEAR,
 *  so re-runs can skip completed cities and resume after a crash. */
async function loadAlreadyIngested(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("city_quality")
    .select("city_id")
    .eq("year", YEAR)
    .not("avg_temp_summer", "is", null);
  if (error) {
    console.warn(`Could not load progress: ${error.message}`);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.city_id as string));
}

async function upsertCityLatLon(id: string, lat: number, lon: number) {
  const { error } = await supabase
    .from("cities")
    .update({ latitude: lat, longitude: lon })
    .eq("id", id);
  if (error) {
    console.warn(`  failed to backfill lat/lon for ${id}: ${error.message}`);
  }
}

async function upsertQualityBatch(rows: QualityRow[]) {
  if (rows.length === 0) return;
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
  console.log(
    `LiveCost weather ingest — Open-Meteo archive ${NORMAL_START.slice(0, 4)}–${NORMAL_END.slice(0, 4)}\n`,
  );

  const cities = await loadCities();
  const alreadyDone = await loadAlreadyIngested();
  console.log(
    `Loaded ${cities.length} cities; ${alreadyDone.size} already have weather data (will skip).\n`,
  );

  const qualityRows: QualityRow[] = [];
  let ok = 0;
  let skipped = 0;
  let geocodeFail = 0;
  let archiveFail = 0;

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    if (alreadyDone.has(city.id)) {
      skipped++;
      continue;
    }

    // Resolve coordinates (prefer DB value; otherwise geocode)
    let lat = city.latitude;
    let lon = city.longitude;
    if (lat == null || lon == null) {
      try {
        const coords = await geocode(city.name, city.state_code);
        if (!coords) {
          geocodeFail++;
          console.warn(
            `[${i + 1}/${cities.length}] ${city.name}, ${city.state_code}: geocode miss`,
          );
          await sleep(REQUEST_DELAY_MS);
          continue;
        }
        lat = coords.lat;
        lon = coords.lon;
        await upsertCityLatLon(city.id, lat, lon);
      } catch (err) {
        geocodeFail++;
        console.error(
          `[${i + 1}/${cities.length}] ${city.name}, ${city.state_code}: geocode error`,
          err,
        );
        await sleep(REQUEST_DELAY_MS);
        continue;
      }
      await sleep(REQUEST_DELAY_MS);
    }

    // Fetch 30-year archive + compute
    try {
      const daily = await fetchArchive(lat, lon);
      if (!daily) {
        archiveFail++;
        console.warn(
          `[${i + 1}/${cities.length}] ${city.name}, ${city.state_code}: archive empty`,
        );
        await sleep(REQUEST_DELAY_MS);
        continue;
      }
      const normals = deriveNormals(daily);
      qualityRows.push({ city_id: city.id, year: YEAR, ...normals });
      ok++;

      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(
          `[${i + 1}/${cities.length}] ${city.name}, ${city.state_code}: ` +
            `summer=${normals.avg_temp_summer}F, winter=${normals.avg_temp_winter}F, ` +
            `precip=${normals.annual_precipitation}in, sunny=${normals.sunshine_days}/yr`,
        );
      }

      // Flush every 25 so partial progress survives a crash
      if (qualityRows.length >= 25) {
        await upsertQualityBatch(qualityRows.splice(0));
      }
    } catch (err) {
      archiveFail++;
      console.error(
        `[${i + 1}/${cities.length}] ${city.name}, ${city.state_code}: archive error`,
        err,
      );
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `\nSkipped (already ingested): ${skipped}. Geocode failures: ${geocodeFail}, archive failures: ${archiveFail}, ok: ${ok}`,
  );
  if (qualityRows.length > 0) {
    console.log(`Final flush: ${qualityRows.length} rows…`);
    await upsertQualityBatch(qualityRows);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
