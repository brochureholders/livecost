/**
 * Ingest 1991-2020 climate normals into city_quality via NCEI.
 *
 * NCEI's Data Access v1 API publishes pre-computed 30-year normals per
 * station (no auth, no rate limits). We use a curated map of city slugs
 * to major-airport station IDs since each station has a long climate
 * record. Cities outside the map get no weather data — the UI hides the
 * Climate section when values are null.
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
// Curated city-slug → NCEI GHCN station ID map. Airport stations are preferred
// because they have the longest continuous records. 1991-2020 normals require
// a station to have ≥80% data coverage in the window.
// ---------------------------------------------------------------------------
const STATION_MAP: Record<string, string> = {
  "new-york-ny": "USW00094728", // NYC Central Park
  "los-angeles-ca": "USW00023174", // LAX
  "chicago-il": "USW00094846", // Chicago O'Hare
  "houston-tx": "USW00012960", // Houston Hobby
  "phoenix-az": "USW00023183", // Phoenix Sky Harbor
  "philadelphia-pa": "USW00013739", // PHL
  "san-antonio-tx": "USW00012921", // San Antonio Intl
  "san-diego-ca": "USW00023188", // San Diego Lindbergh
  "dallas-tx": "USW00013960", // Dallas-Fort Worth
  "san-jose-ca": "USW00023293", // San Jose Intl
  "austin-tx": "USW00013904", // Austin Bergstrom
  "jacksonville-fl": "USW00013889", // Jacksonville Intl
  "fort-worth-tx": "USW00013961", // Fort Worth Meacham
  "columbus-oh": "USW00014821", // Columbus Intl
  "charlotte-nc": "USW00013881", // Charlotte Douglas
  "indianapolis-in": "USW00093819", // Indianapolis Intl
  "san-francisco-ca": "USW00023234", // SFO
  "seattle-wa": "USW00024233", // Seattle-Tacoma
  "denver-co": "USW00003017", // Denver Intl
  "washington-dc": "USW00013743", // Reagan National
  "boston-ma": "USW00014739", // Boston Logan
  "el-paso-tx": "USW00023044", // El Paso Intl
  "nashville-tn": "USW00013897", // Nashville Intl
  "detroit-mi": "USW00094847", // Detroit Metro
  "oklahoma-city-ok": "USW00013967", // Will Rogers
  "portland-or": "USW00024229", // Portland Intl
  "las-vegas-nv": "USW00023169", // Harry Reid (McCarran)
  "memphis-tn": "USW00013893", // Memphis Intl
  "louisville-ky": "USW00093821", // Louisville Intl
  "baltimore-md": "USW00093721", // BWI
  "milwaukee-wi": "USW00014839", // Mitchell Intl
  "albuquerque-nm": "USW00023050", // Albuquerque Intl
  "tucson-az": "USW00023160", // Tucson Intl
  "fresno-ca": "USW00093193", // Fresno Yosemite
  "sacramento-ca": "USW00023232", // Sacramento Exec
  "mesa-az": "USW00023183", // shares Phoenix Sky Harbor
  "kansas-city-mo": "USW00003947", // Kansas City Intl
  "atlanta-ga": "USW00013874", // Hartsfield-Jackson
  "long-beach-ca": "USW00023129", // Long Beach Daugherty
  "colorado-springs-co": "USW00093037", // Colorado Springs Muni
  "raleigh-nc": "USW00013722", // Raleigh-Durham Intl
  "miami-fl": "USW00012839", // Miami Intl
  "virginia-beach-va": "USW00013702", // Norfolk Intl (nearest)
  "omaha-ne": "USW00094918", // Eppley Airfield
  "oakland-ca": "USW00023230", // Oakland Intl
  "minneapolis-mn": "USW00014922", // MSP
  "tulsa-ok": "USW00013968", // Tulsa Intl
  "arlington-tx": "USW00013960", // shares DFW
  "new-orleans-la": "USW00012916", // Louis Armstrong
  "wichita-ks": "USW00003928", // Dwight D Eisenhower
  "cleveland-oh": "USW00014820", // Cleveland Hopkins
  "tampa-fl": "USW00012842", // Tampa Intl
  "bakersfield-ca": "USW00023155", // Meadows Field
  "aurora-co": "USW00003017", // shares Denver Intl
  "anaheim-ca": "USW00023174", // close to LAX
  "honolulu-hi": "USW00022521", // Honolulu Intl
  "santa-ana-ca": "USW00023129", // shares Long Beach
  "riverside-ca": "USW00023161", // Riverside Muni
  "corpus-christi-tx": "USW00012924", // Corpus Christi Intl
  "lexington-ky": "USW00093820", // Blue Grass Airport
  "stockton-ca": "USW00023237", // Stockton Metro
  "henderson-nv": "USW00023169", // shares Las Vegas
  "saint-paul-mn": "USW00014922", // shares MSP
  "cincinnati-oh": "USW00093814", // Cincinnati/Northern KY
  "pittsburgh-pa": "USW00094823", // Pittsburgh Intl
  "greensboro-nc": "USW00013723", // Piedmont Triad
  "anchorage-ak": "USW00026451", // Ted Stevens Intl
  "plano-tx": "USW00013960", // shares DFW
  "lincoln-ne": "USW00014939", // Lincoln Muni
  "orlando-fl": "USW00012815", // Orlando Intl
  "irvine-ca": "USW00023129", // shares Long Beach
  "newark-nj": "USW00014734", // Newark Liberty
  "durham-nc": "USW00013722", // shares RDU
  "chula-vista-ca": "USW00023188", // shares San Diego
  "toledo-oh": "USW00094830", // Toledo Express
  "fort-wayne-in": "USW00014827", // Fort Wayne Intl
  "saint-petersburg-fl": "USW00012842", // shares Tampa
  "laredo-tx": "USW00012907", // Laredo Intl
  "jersey-city-nj": "USW00094728", // close to NYC (Central Park)
  "chandler-az": "USW00023183", // shares Phoenix
  "madison-wi": "USW00014837", // Dane County Regional
  "lubbock-tx": "USW00023042", // Lubbock Intl
  "scottsdale-az": "USW00023183", // shares Phoenix
  "reno-nv": "USW00023185", // Reno-Tahoe Intl
  "buffalo-ny": "USW00014733", // Buffalo Niagara
  "gilbert-az": "USW00023183", // shares Phoenix
  "glendale-az": "USW00023183", // shares Phoenix
  "north-las-vegas-nv": "USW00023169", // shares Las Vegas
  "winston-salem-nc": "USW00013723", // shares Piedmont Triad
  "chesapeake-va": "USW00013702", // shares Norfolk
  "norfolk-va": "USW00013702", // Norfolk Intl
  "fremont-ca": "USW00023230", // shares Oakland
  "garland-tx": "USW00013960", // shares DFW
  "irving-tx": "USW00013960", // shares DFW
  "hialeah-fl": "USW00012839", // shares Miami
  "richmond-va": "USW00013740", // Richmond Intl
  "boise-city-id": "USW00024131", // Boise Air Terminal
  "spokane-wa": "USW00024157", // Spokane Intl
  "baton-rouge-la": "USW00013970", // Baton Rouge Metro
  "tacoma-wa": "USW00024233", // shares Seattle
  "san-bernardino-ca": "USW00023161", // shares Riverside
  "modesto-ca": "USW00023258", // Modesto City-County
  "fontana-ca": "USW00023161", // shares Riverside
  "des-moines-ia": "USW00014933", // Des Moines Intl
  "moreno-valley-ca": "USW00023161", // shares Riverside
  "santa-clarita-ca": "USW00023174", // close to LAX
  "fayetteville-nc": "USW00013714", // Fayetteville Regional
  "birmingham-al": "USW00013876", // Birmingham Intl
  "oxnard-ca": "USW00023136", // Oxnard Airport
  "rochester-ny": "USW00014768", // Greater Rochester Intl
  "port-saint-lucie-fl": "USW00012815", // shares Orlando
  "grand-rapids-mi": "USW00094860", // Gerald R Ford
  "huntsville-al": "USW00003856", // Huntsville Intl
  "salt-lake-city-ut": "USW00024127", // Salt Lake City Intl
  "frisco-tx": "USW00013960", // shares DFW
  "yonkers-ny": "USW00094728", // close to NYC
  "amarillo-tx": "USW00023047", // Rick Husband
  "glendale-ca": "USW00023174", // close to LAX
  "mckinney-tx": "USW00013960", // shares DFW
  "montgomery-al": "USW00013895", // Montgomery Regional
  "aurora-il": "USW00094846", // shares Chicago O'Hare
  "akron-oh": "USW00014895", // Akron-Canton Regional
  "little-rock-ar": "USW00013963", // Bill and Hillary Clinton
  "augusta-ga": "USW00003820", // Augusta Regional
  "columbus-ga": "USW00093842", // Columbus Metropolitan
  "shreveport-la": "USW00013957", // Shreveport Regional
  "mobile-al": "USW00013894", // Mobile Regional
  "overland-park-ks": "USW00003947", // shares Kansas City
  "knoxville-tn": "USW00013891", // McGhee Tyson
  "grand-prairie-tx": "USW00013960", // shares DFW
  "salem-or": "USW00024232", // McNary Field
  "tallahassee-fl": "USW00093805", // Tallahassee Intl
  "huntington-beach-ca": "USW00023129", // shares Long Beach
  "worcester-ma": "USW00094746", // Worcester Regional
  "knox-city-tn": "USW00013891", // shares Knoxville
};

// ---------------------------------------------------------------------------
type CityRow = { id: string; slug: string; name: string; state_code: string };

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
  const rows = await fetchJson<NceiRow[]>(`${API_BASE}?${qp.toString()}`, `normals ${stationId}`);
  return rows;
}

function n(s: string | undefined): number | null {
  if (s == null) return null;
  const v = Number(s.trim());
  return Number.isFinite(v) ? v : null;
}

function deriveNormals(rows: NceiRow[]) {
  // rows are 12 entries, DATE = "01".."12"
  const byMonth = new Map<number, NceiRow>();
  for (const r of rows) byMonth.set(Number(r.DATE), r);

  const tempAvg = (months: number[], key: "MLY-TMAX-NORMAL" | "MLY-TMIN-NORMAL") => {
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
    // If some months missing, scale proportionally.
    return Number(((sum * 12) / count).toFixed(2));
  };

  return {
    // Summer HIGH (avg daily max across Jun-Aug), winter LOW (avg daily min
    // across Dec-Feb). This matches how weather is typically reported ("avg
    // high of 84°F in summer") and keeps consistency with existing Open-Meteo
    // rows on the same table.
    avg_temp_summer: tempAvg([6, 7, 8], "MLY-TMAX-NORMAL"),
    avg_temp_winter: tempAvg([12, 1, 2], "MLY-TMIN-NORMAL"),
    annual_precipitation: precipTotal(),
    // NCEI's monthly normals don't include sunshine; leave null
    sunshine_days: null as number | null,
  };
}

// ---------------------------------------------------------------------------
async function main() {
  console.log("UrbRank weather ingest — NCEI 1991-2020 normals\n");

  const { data: cities, error } = await supabase
    .from("cities")
    .select("id, slug, name, state_code");
  if (error) throw new Error(`Cities load failed: ${error.message}`);

  const mappedCities = (cities ?? []).filter(
    (c): c is CityRow => (c.slug as string) in STATION_MAP,
  );
  console.log(
    `${mappedCities.length} / ${cities?.length} cities have station mappings.\n`,
  );

  const rows = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < mappedCities.length; i++) {
    const city = mappedCities[i];
    const sid = STATION_MAP[city.slug];
    const data = await fetchNormals(sid);
    if (!data || data.length === 0) {
      fail++;
      console.warn(
        `[${i + 1}/${mappedCities.length}] ${city.name}, ${city.state_code}: no data for station ${sid}`,
      );
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    const normals = deriveNormals(data);
    rows.push({ city_id: city.id, year: YEAR, ...normals });
    ok++;
    if ((i + 1) % 10 === 0 || i < 3) {
      console.log(
        `[${i + 1}/${mappedCities.length}] ${city.name}, ${city.state_code} (${sid}): ` +
          `summer=${normals.avg_temp_summer}F, winter=${normals.avg_temp_winter}F, precip=${normals.annual_precipitation}in`,
      );
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nOK: ${ok}, failed: ${fail}. Upserting ${rows.length} city_quality rows…`);
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("city_quality")
      .upsert(chunk, { onConflict: "city_id,year" });
    if (error) console.error(`  upsert chunk ${i}: ${error.message}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
