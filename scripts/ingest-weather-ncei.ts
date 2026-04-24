/**
 * Ingest 1991-2020 climate normals into city_quality via NCEI.
 *
 * NCEI Data Access v1 publishes pre-computed 30-year normals per station
 * (no auth, no rate limits). Strategy:
 *
 *   1. A curated STATION_MAP covers the largest metros with their airport
 *      GHCN station (long continuous records).
 *   2. For every other city we auto-map to the NEAREST mapped-city's
 *      station via haversine distance on lat/lon. Climate normals vary
 *      slowly across space, so sharing the nearest major-metro station's
 *      normals is a reasonable approximation (the alternative — hitting
 *      NCEI's station-search API for 500 cities — would be rate-limited
 *      and far slower).
 *   3. Each unique station is fetched once; results fan out to every city
 *      mapped to that station.
 *
 * Run: npx tsx scripts/ingest-weather-ncei.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const YEAR = 2022;
const API_BASE = "https://www.ncei.noaa.gov/access/services/data/v1";
const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 4;

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
// Curated city-slug → NCEI GHCN station ID map. Airport stations preferred
// because they have the longest continuous records. 1991-2020 normals require
// a station to have ≥80% data coverage in the window.
//
// Cities not listed here are auto-mapped to the nearest mapped-city's station
// via haversine below.
// ---------------------------------------------------------------------------
const STATION_MAP: Record<string, string> = {
  "new-york-ny": "USW00094728",
  "los-angeles-ca": "USW00023174",
  "chicago-il": "USW00094846",
  "houston-tx": "USW00012960",
  "phoenix-az": "USW00023183",
  "philadelphia-pa": "USW00013739",
  "san-antonio-tx": "USW00012921",
  "san-diego-ca": "USW00023188",
  "dallas-tx": "USW00013960",
  "san-jose-ca": "USW00023293",
  "austin-tx": "USW00013904",
  "jacksonville-fl": "USW00013889",
  "fort-worth-tx": "USW00013961",
  "columbus-oh": "USW00014821",
  "charlotte-nc": "USW00013881",
  "indianapolis-in": "USW00093819",
  "san-francisco-ca": "USW00023234",
  "seattle-wa": "USW00024233",
  "denver-co": "USW00003017",
  "washington-dc": "USW00013743",
  "boston-ma": "USW00014739",
  "el-paso-tx": "USW00023044",
  "nashville-tn": "USW00013897",
  "detroit-mi": "USW00094847",
  "oklahoma-city-ok": "USW00013967",
  "portland-or": "USW00024229",
  "las-vegas-nv": "USW00023169",
  "memphis-tn": "USW00013893",
  "louisville-ky": "USW00093821",
  "baltimore-md": "USW00093721",
  "milwaukee-wi": "USW00014839",
  "albuquerque-nm": "USW00023050",
  "tucson-az": "USW00023160",
  "fresno-ca": "USW00093193",
  "sacramento-ca": "USW00023232",
  "kansas-city-mo": "USW00003947",
  "atlanta-ga": "USW00013874",
  "colorado-springs-co": "USW00093037",
  "raleigh-nc": "USW00013722",
  "miami-fl": "USW00012839",
  "omaha-ne": "USW00094918",
  "oakland-ca": "USW00023230",
  "minneapolis-mn": "USW00014922",
  "tulsa-ok": "USW00013968",
  "new-orleans-la": "USW00012916",
  "wichita-ks": "USW00003928",
  "cleveland-oh": "USW00014820",
  "tampa-fl": "USW00012842",
  "bakersfield-ca": "USW00023155",
  "honolulu-hi": "USW00022521",
  "riverside-ca": "USW00023161",
  "corpus-christi-tx": "USW00012924",
  "lexington-ky": "USW00093820",
  "stockton-ca": "USW00023237",
  "cincinnati-oh": "USW00093814",
  "pittsburgh-pa": "USW00094823",
  "greensboro-nc": "USW00013723",
  "anchorage-ak": "USW00026451",
  "lincoln-ne": "USW00014939",
  "orlando-fl": "USW00012815",
  "newark-nj": "USW00014734",
  "toledo-oh": "USW00094830",
  "fort-wayne-in": "USW00014827",
  "laredo-tx": "USW00012907",
  "madison-wi": "USW00014837",
  "lubbock-tx": "USW00023042",
  "reno-nv": "USW00023185",
  "buffalo-ny": "USW00014733",
  "norfolk-va": "USW00013702",
  "richmond-va": "USW00013740",
  "boise-city-id": "USW00024131",
  "spokane-wa": "USW00024157",
  "baton-rouge-la": "USW00013970",
  "modesto-ca": "USW00023258",
  "des-moines-ia": "USW00014933",
  "fayetteville-nc": "USW00013714",
  "birmingham-al": "USW00013876",
  "oxnard-ca": "USW00023136",
  "rochester-ny": "USW00014768",
  "grand-rapids-mi": "USW00094860",
  "huntsville-al": "USW00003856",
  "salt-lake-city-ut": "USW00024127",
  "amarillo-tx": "USW00023047",
  "montgomery-al": "USW00013895",
  "akron-oh": "USW00014895",
  "little-rock-ar": "USW00013963",
  "augusta-ga": "USW00003820",
  "columbus-ga": "USW00093842",
  "shreveport-la": "USW00013957",
  "mobile-al": "USW00013894",
  "knoxville-tn": "USW00013891",
  "salem-or": "USW00024232",
  "tallahassee-fl": "USW00093805",
  "worcester-ma": "USW00094746",
};

// ---------------------------------------------------------------------------
type CityRow = {
  id: string;
  slug: string;
  name: string;
  state_code: string;
  latitude: number | null;
  longitude: number | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string, label: string): Promise<T | null> {
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
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err) {
      const backoff = 500 * 2 ** (attempt - 1);
      console.warn(
        `  [${label}] network error, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`,
        err,
      );
      await sleep(backoff);
    }
  }
  return null;
}

type NceiRow = {
  DATE: string;
  STATION: string;
  "MLY-TMAX-NORMAL"?: string;
  "MLY-TMIN-NORMAL"?: string;
  "MLY-PRCP-NORMAL"?: string;
};

async function fetchNormals(stationId: string): Promise<NceiRow[] | null> {
  const qp = new URLSearchParams({
    dataset: "normals-monthly-1991-2020",
    stations: stationId,
    dataTypes: "MLY-TMAX-NORMAL,MLY-TMIN-NORMAL,MLY-PRCP-NORMAL",
    format: "json",
  });
  const rows = await fetchJson<NceiRow[]>(
    `${API_BASE}?${qp.toString()}`,
    `normals ${stationId}`,
  );
  return rows;
}

function n(s: string | undefined): number | null {
  if (s == null) return null;
  const v = Number(s.trim());
  return Number.isFinite(v) ? v : null;
}

function deriveNormals(rows: NceiRow[]) {
  const byMonth = new Map<number, NceiRow>();
  for (const r of rows) byMonth.set(Number(r.DATE), r);

  const tempAvg = (
    months: number[],
    key: "MLY-TMAX-NORMAL" | "MLY-TMIN-NORMAL",
  ) => {
    const vals: number[] = [];
    for (const m of months) {
      const v = n(byMonth.get(m)?.[key]);
      if (v != null) vals.push(v);
    }
    if (vals.length === 0) return null;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  const precipTotal = () => {
    let sum = 0;
    let count = 0;
    for (let m = 1; m <= 12; m++) {
      const v = n(byMonth.get(m)?.["MLY-PRCP-NORMAL"]);
      if (v != null) {
        sum += v;
        count++;
      }
    }
    if (count === 0) return null;
    return Number(((sum * 12) / count).toFixed(2));
  };

  return {
    avg_temp_summer: tempAvg([6, 7, 8], "MLY-TMAX-NORMAL"),
    avg_temp_winter: tempAvg([12, 1, 2], "MLY-TMIN-NORMAL"),
    annual_precipitation: precipTotal(),
    sunshine_days: null as number | null,
  };
}

/** Haversine distance in miles between two lat/lon points. */
function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
async function main() {
  console.log("UrbRank weather ingest — NCEI 1991-2020 normals\n");

  const { data: cities, error } = await supabase
    .from("cities")
    .select("id, slug, name, state_code, latitude, longitude")
    .range(0, 999);
  if (error) throw new Error(`Cities load failed: ${error.message}`);
  const allCities = (cities ?? []) as CityRow[];
  console.log(`Loaded ${allCities.length} cities.\n`);

  // Build a station catalog from the curated map: station_id → list of anchor cities.
  type StationAnchor = { slug: string; lat: number; lon: number };
  const stationAnchors = new Map<string, StationAnchor[]>();
  const curatedSlugs = new Set(Object.keys(STATION_MAP));
  for (const c of allCities) {
    if (!curatedSlugs.has(c.slug)) continue;
    if (c.latitude == null || c.longitude == null) continue;
    const sid = STATION_MAP[c.slug];
    if (!stationAnchors.has(sid)) stationAnchors.set(sid, []);
    stationAnchors.get(sid)!.push({
      slug: c.slug,
      lat: c.latitude,
      lon: c.longitude,
    });
  }
  console.log(
    `Curated ${curatedSlugs.size} city-slug→station mappings across ${stationAnchors.size} unique stations.`,
  );

  // Build final city → station mapping: curated slug gets its station;
  // every other city gets the station whose nearest anchor city is closest.
  // Build a state-code index of anchors so we can fall back when lat/lon
  // is bad (e.g. Parma, OH originally had Parma, Italy coords). For the
  // state fallback we need an anchor city's state, which we'll derive
  // from the slug suffix "-xx".
  function slugStateCode(slug: string): string | null {
    const m = slug.match(/-([a-z]{2})$/);
    return m ? m[1].toUpperCase() : null;
  }
  const anchorsByState = new Map<string, StationAnchor[]>();
  for (const [sid, anchors] of stationAnchors) {
    for (const a of anchors) {
      const sc = slugStateCode(a.slug);
      if (!sc) continue;
      if (!anchorsByState.has(sc)) anchorsByState.set(sc, []);
      // Tag the station id on the anchor for reverse lookup
      anchorsByState.get(sc)!.push({ ...a, slug: sid });
    }
  }

  const cityToStation = new Map<string, string>(); // city_id → station_id
  let autoMapped = 0;
  let stateFallback = 0;
  let skipped = 0;
  for (const c of allCities) {
    if (curatedSlugs.has(c.slug)) {
      cityToStation.set(c.id, STATION_MAP[c.slug]);
      continue;
    }

    // First try: haversine to nearest anchor within 400mi (normal path).
    if (c.latitude != null && c.longitude != null) {
      let bestStation: string | null = null;
      let bestDist = Infinity;
      for (const [sid, anchors] of stationAnchors) {
        for (const a of anchors) {
          const d = haversineMiles(c.latitude, c.longitude, a.lat, a.lon);
          if (d < bestDist) {
            bestDist = d;
            bestStation = sid;
          }
        }
      }
      if (bestStation && bestDist < 400) {
        cityToStation.set(c.id, bestStation);
        autoMapped++;
        continue;
      }
    }

    // Fallback: any anchor in the same state. Handles missing / bad lat/lon.
    const sameState = anchorsByState.get(c.state_code);
    if (sameState && sameState.length > 0) {
      // anchor.slug was overridden to be the station_id above
      cityToStation.set(c.id, sameState[0].slug);
      stateFallback++;
      continue;
    }

    console.warn(`  ${c.name}, ${c.state_code} — no station match; skipping`);
    skipped++;
  }
  console.log(
    `Auto-mapped ${autoMapped} by proximity, ${stateFallback} by state fallback. Skipped ${skipped}.\n`,
  );

  // Fetch each unique station once, cache results.
  const uniqueStations = new Set<string>();
  for (const sid of cityToStation.values()) uniqueStations.add(sid);
  console.log(`Fetching ${uniqueStations.size} unique stations from NCEI…\n`);

  const stationData = new Map<string, ReturnType<typeof deriveNormals>>();
  let fetchOk = 0;
  let fetchFail = 0;
  let idx = 0;
  for (const sid of uniqueStations) {
    idx++;
    const data = await fetchNormals(sid);
    if (!data || data.length === 0) {
      fetchFail++;
      console.warn(`  [${idx}/${uniqueStations.size}] station ${sid}: no data`);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    const normals = deriveNormals(data);
    stationData.set(sid, normals);
    fetchOk++;
    if (idx % 20 === 0 || idx <= 3) {
      console.log(
        `  [${idx}/${uniqueStations.size}] ${sid}: summer=${normals.avg_temp_summer}F, winter=${normals.avg_temp_winter}F, precip=${normals.annual_precipitation}in`,
      );
    }
    await sleep(REQUEST_DELAY_MS);
  }
  console.log(
    `\nStations fetched OK: ${fetchOk}, failed: ${fetchFail}.\n`,
  );

  // Build rows for upsert
  const rows: Array<{
    city_id: string;
    year: number;
    avg_temp_summer: number | null;
    avg_temp_winter: number | null;
    annual_precipitation: number | null;
    sunshine_days: number | null;
  }> = [];
  for (const [cityId, sid] of cityToStation) {
    const d = stationData.get(sid);
    if (!d) continue;
    rows.push({ city_id: cityId, year: YEAR, ...d });
  }
  console.log(`Upserting ${rows.length} city_quality rows…`);

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: upErr } = await supabase
      .from("city_quality")
      .upsert(chunk, { onConflict: "city_id,year" });
    if (upErr) console.error(`  upsert chunk ${i}: ${upErr.message}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
