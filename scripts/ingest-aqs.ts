/**
 * Ingest annual AQI into city_quality via EPA's AQS Data Mart API.
 *
 * EPA AQS publishes pre-computed annual summary statistics per monitoring
 * site. We fetch the PM2.5 (param 88101) annual mean in a small lat/lon
 * box around each city, average across the monitors in-box, and convert
 * the µg/m³ concentration to the EPA AQI using the official piecewise
 * breakpoints. PM2.5 is the dominant AQI driver in most US cities.
 *
 * Run: npx tsx scripts/ingest-aqs.ts
 * Requires in .env.local: AQS_EMAIL, AQS_KEY,
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or anon).
 * AQS rate limit: soft cap ~500 req/min, no hard daily cap. We pace at
 *   1 req/sec. Data lag is 6+ months, so 2022 is the most recent fully
 *   published year as of early 2026.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const YEAR = 2022;
const PARAM_PM25 = "88101";
const BOX_HALF_DEGREES = 0.3; // ~20 miles at mid-latitudes
const API_BASE = "https://aqs.epa.gov/data/api";
const REQUEST_DELAY_MS = 1000;
const MAX_RETRIES = 4;

const AQS_EMAIL = process.env.AQS_EMAIL;
const AQS_KEY = process.env.AQS_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!AQS_EMAIL || !AQS_KEY) {
  throw new Error("Missing AQS_EMAIL or AQS_KEY in .env.local");
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or anon) in .env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// EPA PM2.5 → AQI breakpoints (2024 revised NAAQS)
// PM2.5 µg/m³ 24h concentration → AQI value. Lerp within each band.
// Source: https://www.airnow.gov/aqi/aqi-calculator-concentration/
// ---------------------------------------------------------------------------
const AQI_BREAKPOINTS: [number, number, number, number][] = [
  [0.0, 9.0, 0, 50], // Good
  [9.1, 35.4, 51, 100], // Moderate
  [35.5, 55.4, 101, 150], // Unhealthy for sensitive
  [55.5, 125.4, 151, 200], // Unhealthy
  [125.5, 225.4, 201, 300], // Very unhealthy
  [225.5, 500.0, 301, 500], // Hazardous
];

function pm25ToAqi(concentration: number): number {
  const c = Math.max(0, Math.round(concentration * 10) / 10); // truncate to 0.1
  for (const [cLow, cHigh, iLow, iHigh] of AQI_BREAKPOINTS) {
    if (c >= cLow && c <= cHigh) {
      const aqi = ((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow;
      return Math.round(aqi);
    }
  }
  return 500; // off-scale
}

// ---------------------------------------------------------------------------
type CityRow = {
  id: string;
  name: string;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
};

type AnnualRow = {
  state_code: string;
  county_code: string;
  site_number: string;
  poc: number;
  sample_duration: string;
  arithmetic_mean: number | null;
};

type AqsResponse = {
  Header: [{ status: string; rows: number }];
  Data: AnnualRow[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry<T>(url: string, label: string): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        const backoff = 2000 * 2 ** (attempt - 1);
        console.warn(
          `  [${label}] HTTP ${res.status}, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        );
        await sleep(backoff);
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err) {
      const backoff = 2000 * 2 ** (attempt - 1);
      console.warn(
        `  [${label}] network error, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        err,
      );
      await sleep(backoff);
    }
  }
  return null;
}

async function fetchAnnualPm25(
  lat: number,
  lon: number,
): Promise<AnnualRow[] | null> {
  const qp = new URLSearchParams({
    email: AQS_EMAIL!,
    key: AQS_KEY!,
    param: PARAM_PM25,
    bdate: `${YEAR}0101`,
    edate: `${YEAR}1231`,
    minlat: (lat - BOX_HALF_DEGREES).toFixed(4),
    maxlat: (lat + BOX_HALF_DEGREES).toFixed(4),
    minlon: (lon - BOX_HALF_DEGREES).toFixed(4),
    maxlon: (lon + BOX_HALF_DEGREES).toFixed(4),
  });
  const json = await fetchWithRetry<AqsResponse>(
    `${API_BASE}/annualData/byBox?${qp.toString()}`,
    `aqs box ${lat.toFixed(2)},${lon.toFixed(2)}`,
  );
  if (!json || json.Header?.[0]?.status !== "Success") return null;
  return json.Data ?? [];
}

/** Average PM2.5 across unique (site, POC) pairs to avoid double-counting
 *  the same monitor reported in multiple aggregation durations. Prefer the
 *  24-HOUR duration when available (that's what AQS uses for annual NAAQS).
 */
function aggregatePm25(rows: AnnualRow[]): number | null {
  if (rows.length === 0) return null;

  const byMonitor = new Map<string, AnnualRow>();
  for (const r of rows) {
    if (r.arithmetic_mean == null) continue;
    const key = `${r.state_code}-${r.county_code}-${r.site_number}-${r.poc}`;
    const existing = byMonitor.get(key);
    if (!existing) {
      byMonitor.set(key, r);
      continue;
    }
    // Prefer 24-HOUR duration; otherwise the first entry wins.
    if (r.sample_duration === "24 HOUR" && existing.sample_duration !== "24 HOUR") {
      byMonitor.set(key, r);
    }
  }

  const means = [...byMonitor.values()]
    .map((r) => r.arithmetic_mean)
    .filter((v): v is number => v != null);
  if (means.length === 0) return null;
  return means.reduce((a, b) => a + b, 0) / means.length;
}

async function loadCities(): Promise<CityRow[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, state_code, latitude, longitude")
    .order("population", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Cities load failed: ${error.message}`);
  return (data ?? []) as CityRow[];
}

async function upsertBatch(
  rows: { city_id: string; year: number; air_quality_index: number }[],
) {
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("city_quality")
      .upsert(chunk, { onConflict: "city_id,year" });
    if (error) {
      console.error(
        `  upsert chunk ${i}..${i + chunk.length}: ${error.message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`LiveCost AQI ingest — EPA AQS annual PM2.5 ${YEAR}\n`);
  const cities = await loadCities();
  const withCoords = cities.filter(
    (c) => c.latitude != null && c.longitude != null,
  );
  console.log(
    `${withCoords.length} / ${cities.length} cities have lat/lon (need to ingest weather or walkscore first for the rest)\n`,
  );

  const out: { city_id: string; year: number; air_quality_index: number }[] = [];
  let ok = 0;
  let noMonitors = 0;
  let apiFail = 0;

  for (let i = 0; i < withCoords.length; i++) {
    const city = withCoords[i];
    const rows = await fetchAnnualPm25(city.latitude!, city.longitude!);
    if (rows == null) {
      apiFail++;
      console.warn(
        `[${i + 1}/${withCoords.length}] ${city.name}, ${city.state_code}: API error`,
      );
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    const meanPm25 = aggregatePm25(rows);
    if (meanPm25 == null) {
      noMonitors++;
      if ((i + 1) % 25 === 0 || i < 5) {
        console.warn(
          `[${i + 1}/${withCoords.length}] ${city.name}, ${city.state_code}: no PM2.5 monitors within ${BOX_HALF_DEGREES}°`,
        );
      }
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    const aqi = pm25ToAqi(meanPm25);
    out.push({ city_id: city.id, year: YEAR, air_quality_index: aqi });
    ok++;

    if ((i + 1) % 25 === 0 || i < 3) {
      console.log(
        `[${i + 1}/${withCoords.length}] ${city.name}, ${city.state_code}: ` +
          `PM2.5=${meanPm25.toFixed(2)} µg/m³ → AQI ${aqi}`,
      );
    }

    if (out.length >= 50) await upsertBatch(out.splice(0));
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `\nOK: ${ok}, no-monitor: ${noMonitors}, API fail: ${apiFail}`,
  );
  if (out.length > 0) {
    console.log(`Final flush: ${out.length}`);
    await upsertBatch(out);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
