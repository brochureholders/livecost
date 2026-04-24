/**
 * Ingest US BLS CPI-U data into Supabase city_costs.
 *
 * Run: npx tsx scripts/ingest-bls.ts
 * Requires in .env.local: BLS_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * and either SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *
 * NOTE on Regional Price Parities: RPPs are published by the US Bureau of
 * Economic Analysis (BEA), not BLS. This script uses BLS CPI-U with the
 * national city-average as the baseline, i.e.
 *   metro_index = (metro_CPI / national_CPI) * 100
 * which approximates cross-metro price levels from the same base period.
 * For true RPPs, add a second ingest against the BEA API.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { STATES } from "../lib/states";

loadEnv({ path: ".env.local" });

const STATE_TO_REGION = new Map(STATES.map((s) => [s.code, s.region]));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TARGET_YEAR = 2022; // matches Census ACS 5-Year 2022, keeps city_costs rows aligned
const BLS_API = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const MAX_SERIES_PER_REQUEST = 50;
const REQUEST_DELAY_MS = 500;
const MAX_RETRIES = 4;

const BLS_API_KEY = process.env.BLS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!BLS_API_KEY) throw new Error("Missing BLS_API_KEY in .env.local");
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// CPI item codes (sub-indices of CPI-U, Not Seasonally Adjusted)
// ---------------------------------------------------------------------------
const ITEM = {
  allItems: "SA0",
  food: "SAF1", // Food
  housing: "SAH", // Housing
  utilities: "SAH2", // Housing: Fuels and utilities (electricity, gas, water)
  transport: "SAT", // Transportation
  medical: "SAM", // Medical care
} as const;

const NATIONAL_AREA = "0000"; // CUUR0000... = US city average

// ---------------------------------------------------------------------------
// Census regions — BLS publishes CPI for each of the four, which we use as
// a fallback for cities outside the ~20 metro-level CPI series. Coarser
// than metro data but still a real signal rooted in published CPI, not a
// guess. Cities get their region from lib/states.ts.
// ---------------------------------------------------------------------------
const REGION_CODES: Record<string, string> = {
  Northeast: "0100",
  Midwest: "0200",
  South: "0300",
  West: "0400",
};

// ---------------------------------------------------------------------------
// BLS local area codes for major metros → slugs of cities in our DB that
// the metro's CPI applies to. See
// https://www.bls.gov/cpi/additional-resources/bls-geographic-areas.htm
// Not every metro listed is guaranteed — empty series are logged and skipped.
// ---------------------------------------------------------------------------
const METROS: Record<string, { name: string; slugs: string[] }> = {
  S11A: { name: "Boston-Cambridge-Newton", slugs: ["boston-ma", "cambridge-ma"] },
  S12A: { name: "Los Angeles-Long Beach-Anaheim", slugs: ["los-angeles-ca", "long-beach-ca", "anaheim-ca"] },
  S12B: { name: "Riverside-San Bernardino-Ontario", slugs: ["riverside-ca", "san-bernardino-ca", "ontario-ca"] },
  S23A: { name: "Philadelphia-Camden-Wilmington", slugs: ["philadelphia-pa"] },
  S24A: { name: "Baltimore-Columbia-Towson", slugs: ["baltimore-md"] },
  S24B: { name: "Washington-Arlington-Alexandria", slugs: ["washington-dc", "arlington-va", "alexandria-va"] },
  S35A: { name: "Chicago-Naperville-Elgin", slugs: ["chicago-il", "naperville-il"] },
  S35B: { name: "Detroit-Warren-Dearborn", slugs: ["detroit-mi", "warren-mi"] },
  S35C: { name: "Minneapolis-St. Paul-Bloomington", slugs: ["minneapolis-mn", "saint-paul-mn"] },
  S37A: { name: "Houston-The Woodlands-Sugar Land", slugs: ["houston-tx"] },
  S37B: { name: "Dallas-Fort Worth-Arlington", slugs: ["dallas-tx", "fort-worth-tx", "arlington-tx"] },
  S37C: { name: "Atlanta-Sandy Springs-Roswell", slugs: ["atlanta-ga"] },
  S37D: { name: "Miami-Fort Lauderdale-West Palm Beach", slugs: ["miami-fl", "fort-lauderdale-fl"] },
  S37E: { name: "Tampa-St. Petersburg-Clearwater", slugs: ["tampa-fl", "saint-petersburg-fl"] },
  S48A: { name: "San Francisco-Oakland-Hayward", slugs: ["san-francisco-ca", "oakland-ca"] },
  S48B: { name: "Seattle-Tacoma-Bellevue", slugs: ["seattle-wa", "tacoma-wa", "bellevue-wa"] },
  S48C: { name: "San Diego-Carlsbad", slugs: ["san-diego-ca"] },
  S48D: { name: "Denver-Aurora-Lakewood", slugs: ["denver-co", "aurora-co", "lakewood-co"] },
  S48E: { name: "Phoenix-Mesa-Scottsdale", slugs: ["phoenix-az", "mesa-az", "scottsdale-az"] },
  S49A: { name: "New York-Newark-Jersey City", slugs: ["new-york-ny", "newark-nj", "jersey-city-nj"] },
  S49D: { name: "St. Louis", slugs: ["saint-louis-mo"] },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BlsDataPoint = {
  year: string;
  period: string; // "M01"–"M12", "M13" = annual avg, "S01"/"S02"/"S03" semi-annual
  periodName: string;
  value: string;
};

type BlsSeries = {
  seriesID: string;
  data: BlsDataPoint[];
};

type BlsResponse = {
  status: string;
  message: string[];
  Results: { series: BlsSeries[] };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function seriesId(area: string, item: string): string {
  return `CUUR${area}${item}`;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function fetchBlsBatch(
  seriesIds: string[],
  startYear: number,
  endYear: number,
): Promise<BlsSeries[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(BLS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesid: seriesIds,
          startyear: String(startYear),
          endyear: String(endYear),
          registrationkey: BLS_API_KEY,
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        const backoff = 1000 * 2 ** (attempt - 1);
        console.warn(`  HTTP ${res.status}, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        throw new Error(`BLS HTTP ${res.status}: ${await res.text()}`);
      }

      const json = (await res.json()) as BlsResponse;
      if (json.status !== "REQUEST_SUCCEEDED") {
        throw new Error(`BLS error: ${JSON.stringify(json.message)}`);
      }
      return json.Results.series;
    } catch (err) {
      lastErr = err;
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(`  network error, retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`, err);
      await sleep(backoff);
    }
  }
  throw new Error(`BLS batch failed after ${MAX_RETRIES} retries: ${lastErr}`);
}

/** Pick the annual-average (M13) value for TARGET_YEAR, or fall back to the
 *  average of available monthly periods if M13 isn't published. */
function annualValue(series: BlsSeries, year: number): number | null {
  const rows = series.data.filter((d) => d.year === String(year));
  if (rows.length === 0) return null;
  const m13 = rows.find((d) => d.period === "M13");
  if (m13) return Number(m13.value);
  const monthly = rows.filter((d) => /^M0[1-9]|M1[0-2]$/.test(d.period));
  if (monthly.length === 0) return null;
  const sum = monthly.reduce((acc, d) => acc + Number(d.value), 0);
  return Number((sum / monthly.length).toFixed(3));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`UrbRank BLS CPI ingest — year ${TARGET_YEAR}\n`);

  const items = Object.values(ITEM);
  // Fetch national + 4 Census regions + every metro area. Regions give us a
  // coarse but published fallback for cities outside metro coverage so every
  // city gets every sub-index populated.
  const areas = [
    NATIONAL_AREA,
    ...Object.values(REGION_CODES),
    ...Object.keys(METROS),
  ];
  const allSeries = areas.flatMap((a) => items.map((i) => seriesId(a, i)));

  console.log(
    `Fetching ${allSeries.length} series across ${areas.length} areas × ${items.length} items (batches of ${MAX_SERIES_PER_REQUEST})…`,
  );

  const valueByseries = new Map<string, number>();
  for (let i = 0; i < allSeries.length; i += MAX_SERIES_PER_REQUEST) {
    const batch = allSeries.slice(i, i + MAX_SERIES_PER_REQUEST);
    const series = await fetchBlsBatch(batch, TARGET_YEAR, TARGET_YEAR);
    for (const s of series) {
      const v = annualValue(s, TARGET_YEAR);
      if (v != null) valueByseries.set(s.seriesID, v);
      else console.warn(`  no data for ${s.seriesID}`);
    }
    console.log(
      `  batch ${Math.floor(i / MAX_SERIES_PER_REQUEST) + 1}: fetched ${series.length} series`,
    );
    await sleep(REQUEST_DELAY_MS);
  }

  // National baseline values for each sub-index
  const nat = {
    all: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.allItems)),
    food: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.food)),
    utilities: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.utilities)),
    transport: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.transport)),
    medical: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.medical)),
  };
  if (nat.all == null) {
    throw new Error("Missing national CPI-All-Items; cannot compute relative indices");
  }
  console.log(`\nNational CPI all-items ${TARGET_YEAR}: ${nat.all}\n`);

  // Regional indices keyed by region name
  const regionalIndices: Record<
    string,
    {
      grocery_index: number | null;
      utilities_index: number | null;
      transportation_index: number | null;
      healthcare_index: number | null;
    }
  > = {};
  for (const [region, areaCode] of Object.entries(REGION_CODES)) {
    regionalIndices[region] = {
      grocery_index: ratio(
        valueByseries.get(seriesId(areaCode, ITEM.food)) ?? null,
        nat.food ?? null,
      ),
      utilities_index: ratio(
        valueByseries.get(seriesId(areaCode, ITEM.utilities)) ?? null,
        nat.utilities ?? null,
      ),
      transportation_index: ratio(
        valueByseries.get(seriesId(areaCode, ITEM.transport)) ?? null,
        nat.transport ?? null,
      ),
      healthcare_index: ratio(
        valueByseries.get(seriesId(areaCode, ITEM.medical)) ?? null,
        nat.medical ?? null,
      ),
    };
    console.log(
      `  region ${region}: grocery=${regionalIndices[region].grocery_index}, utilities=${regionalIndices[region].utilities_index}, transport=${regionalIndices[region].transportation_index}, healthcare=${regionalIndices[region].healthcare_index}`,
    );
  }

  // Build a slug → metro code reverse lookup
  const slugToMetro = new Map<string, string>();
  for (const [code, meta] of Object.entries(METROS)) {
    for (const slug of meta.slugs) slugToMetro.set(slug, code);
  }

  // Load every city so we can apply regional fallback to non-metro cities too
  const { data: cities, error: citiesErr } = await supabase
    .from("cities")
    .select("id, slug, state_code");
  if (citiesErr) throw new Error(`Failed to load cities: ${citiesErr.message}`);
  console.log(`\nLoaded ${cities?.length ?? 0} cities from DB\n`);

  type CostUpdate = {
    city_id: string;
    year: number;
    grocery_index: number | null;
    utilities_index: number | null;
    transportation_index: number | null;
    healthcare_index: number | null;
    data_source: string;
  };

  const updates: CostUpdate[] = [];
  let metroCount = 0;
  let regionalCount = 0;
  let skippedCount = 0;

  // NOTE: we deliberately do NOT write cost_index or housing_index here.
  // Those fields are owned by the Census ingest (rent-based ratio), which
  // is internally consistent across all 500 cities. BLS CPI-U levels have
  // base-period quirks that make cross-metro ratios unreliable at the
  // overall level, but sub-category directional comparisons are still useful.
  for (const city of cities ?? []) {
    const id = city.id as string;
    const slug = city.slug as string;
    const stateCode = city.state_code as string;
    const region = STATE_TO_REGION.get(stateCode);
    if (!region) {
      skippedCount++;
      continue;
    }

    // Start with the regional values.
    const baseline = regionalIndices[region];
    const indices = { ...baseline };
    let source = "BLS CPI-U (regional)";

    // Override with metro-specific values where we have them.
    const metroCode = slugToMetro.get(slug);
    if (metroCode) {
      const metroAll = valueByseries.get(seriesId(metroCode, ITEM.allItems));
      if (metroAll != null) {
        const metroFood = ratio(
          valueByseries.get(seriesId(metroCode, ITEM.food)) ?? null,
          nat.food ?? null,
        );
        const metroUtil = ratio(
          valueByseries.get(seriesId(metroCode, ITEM.utilities)) ?? null,
          nat.utilities ?? null,
        );
        const metroTrans = ratio(
          valueByseries.get(seriesId(metroCode, ITEM.transport)) ?? null,
          nat.transport ?? null,
        );
        const metroMed = ratio(
          valueByseries.get(seriesId(metroCode, ITEM.medical)) ?? null,
          nat.medical ?? null,
        );
        if (metroFood != null) indices.grocery_index = metroFood;
        if (metroUtil != null) indices.utilities_index = metroUtil;
        if (metroTrans != null) indices.transportation_index = metroTrans;
        if (metroMed != null) indices.healthcare_index = metroMed;
        source = "BLS CPI-U (metro)";
        metroCount++;
      } else {
        regionalCount++;
      }
    } else {
      regionalCount++;
    }

    updates.push({
      city_id: id,
      year: TARGET_YEAR,
      ...indices,
      data_source: source,
    });
  }

  console.log(
    `\n${metroCount} cities from metro data, ${regionalCount} from regional fallback, ${skippedCount} skipped (unknown region). Upserting ${updates.length} city_costs rows…`,
  );

  // Upsert in chunks. city_costs is unique on (city_id, year), so this
  // merges into existing Census rows without overwriting income, rent, or
  // home value.
  const CHUNK = 200;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("city_costs")
      .upsert(chunk, { onConflict: "city_id,year" });
    if (error) {
      console.error(`  chunk ${i}-${i + chunk.length} failed: ${error.message}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
