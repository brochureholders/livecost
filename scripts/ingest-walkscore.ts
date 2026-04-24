/**
 * Ingest Walk Score / Transit Score / Bike Score into city_quality.
 *
 * Walk Score's API scores a specific point (address + lat/lon). A true
 * "city-wide" walkability doesn't exist in their API, so we use the
 * city-center lat/lon as a proxy — Walk Score snaps the request to the
 * nearest scored location, which for most US cities is a downtown area.
 *
 * For cities without a latitude/longitude in the cities table, we geocode
 * via Open-Meteo (their geocoding endpoint is not affected by the archive
 * rate limits). Cities that can't be resolved are skipped.
 *
 * Run: npx tsx scripts/ingest-walkscore.ts
 * Requires in .env.local: WALKSCORE_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Walk Score free tier: 5000 calls/day — we use ~500.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const YEAR = 2022;
const WALKSCORE_API = "https://api.walkscore.com/score";
const GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search";
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 4;

const WALKSCORE_API_KEY = process.env.WALKSCORE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!WALKSCORE_API_KEY) throw new Error("Missing WALKSCORE_API_KEY in .env.local");
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
type CityRow = {
  id: string;
  name: string;
  state: string;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
};

type WalkScoreResponse = {
  status: number;
  walkscore?: number;
  transit?: { score?: number };
  bike?: { score?: number };
};

type QualityUpdate = {
  city_id: string;
  year: number;
  walk_score: number | null;
  transit_score: number | null;
  bike_score: number | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip Census place suffixes that confuse geocoders. */
function cleanCityName(name: string): string {
  return name
    .replace(
      /\s+(city|town|village|borough|CDP|municipality|township|metropolitan government.*|unified government.*|consolidated government.*|urban county.*|planning area)(\s*\(balance\))?\s*$/i,
      "",
    )
    .split("/")[0]
    .split("-")[0]
    .trim();
}

async function fetchWithRetry<T>(
  url: string,
  label: string,
): Promise<T | null> {
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
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err) {
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(
        `  [${label}] network error, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        err,
      );
      await sleep(backoff);
    }
  }
  return null;
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
    const json = await fetchWithRetry<{
      results?: {
        latitude: number;
        longitude: number;
        admin1_code?: string;
      }[];
    }>(`${GEOCODE_API}?${qp.toString()}`, `geocode ${candidate},${stateCode}`);
    const hits = json?.results ?? [];
    const match =
      hits.find((h) => (h.admin1_code ?? "").toUpperCase() === stateCode) ??
      hits[0];
    if (match) return { lat: match.latitude, lon: match.longitude };
  }
  return null;
}

async function fetchWalkScore(
  address: string,
  lat: number,
  lon: number,
): Promise<WalkScoreResponse | null> {
  const qp = new URLSearchParams({
    format: "json",
    address,
    lat: String(lat),
    lon: String(lon),
    transit: "1",
    bike: "1",
    wsapikey: WALKSCORE_API_KEY!,
  });
  return fetchWithRetry<WalkScoreResponse>(
    `${WALKSCORE_API}?${qp.toString()}`,
    `walkscore ${address}`,
  );
}

async function updateCityLatLon(id: string, lat: number, lon: number) {
  await supabase
    .from("cities")
    .update({ latitude: lat, longitude: lon })
    .eq("id", id);
}

async function upsertBatch(rows: QualityUpdate[]) {
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
  console.log("UrbRank Walk/Transit/Bike score ingest\n");

  const { data, error } = await supabase
    .from("cities")
    .select("id, name, state, state_code, latitude, longitude")
    .order("population", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Cities load failed: ${error.message}`);
  const cities = (data ?? []) as CityRow[];
  console.log(`Loaded ${cities.length} cities\n`);

  const updates: QualityUpdate[] = [];
  let ok = 0;
  let geocodeFail = 0;
  let scoreFail = 0;

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];

    let lat = city.latitude;
    let lon = city.longitude;
    if (lat == null || lon == null) {
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
      await updateCityLatLon(city.id, lat, lon);
      await sleep(REQUEST_DELAY_MS);
    }

    const address = `${cleanCityName(city.name)}, ${city.state_code}`;
    const resp = await fetchWalkScore(address, lat, lon);

    if (!resp || resp.status !== 1) {
      scoreFail++;
      if ((i + 1) % 25 === 0 || i < 5) {
        console.warn(
          `[${i + 1}/${cities.length}] ${city.name}, ${city.state_code}: walk score unavailable (status=${resp?.status})`,
        );
      }
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    const update: QualityUpdate = {
      city_id: city.id,
      year: YEAR,
      walk_score: resp.walkscore ?? null,
      transit_score: resp.transit?.score ?? null,
      bike_score: resp.bike?.score ?? null,
    };
    updates.push(update);
    ok++;

    if ((i + 1) % 25 === 0 || i < 3) {
      console.log(
        `[${i + 1}/${cities.length}] ${city.name}, ${city.state_code}: ` +
          `walk=${update.walk_score}, transit=${update.transit_score}, bike=${update.bike_score}`,
      );
    }

    // Flush every 50 so partial progress survives
    if (updates.length >= 50) {
      await upsertBatch(updates.splice(0));
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `\nOK: ${ok}, geocode failures: ${geocodeFail}, score failures: ${scoreFail}`,
  );
  if (updates.length > 0) {
    console.log(`Final flush: ${updates.length} rows…`);
    await upsertBatch(updates);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
