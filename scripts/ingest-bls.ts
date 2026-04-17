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

loadEnv({ path: ".env.local" });

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
  transport: "SAT", // Transportation
  medical: "SAM", // Medical care
} as const;

const NATIONAL_AREA = "0000"; // CUUR0000... = US city average

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
  console.log(`LiveCost BLS CPI ingest — year ${TARGET_YEAR}\n`);

  const items = Object.values(ITEM);
  const areas = [NATIONAL_AREA, ...Object.keys(METROS)];
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

  // National baseline
  const nat = {
    all: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.allItems)),
    food: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.food)),
    housing: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.housing)),
    transport: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.transport)),
    medical: valueByseries.get(seriesId(NATIONAL_AREA, ITEM.medical)),
  };
  if (nat.all == null) {
    throw new Error("Missing national CPI-All-Items; cannot compute relative indices");
  }
  console.log(`\nNational CPI all-items ${TARGET_YEAR}: ${nat.all}\n`);

  // Load existing cities so we can map slugs → city_id
  const { data: cities, error: citiesErr } = await supabase
    .from("cities")
    .select("id, slug");
  if (citiesErr) throw new Error(`Failed to load cities: ${citiesErr.message}`);
  const slugToId = new Map<string, string>(
    (cities ?? []).map((c) => [c.slug as string, c.id as string]),
  );
  console.log(`Loaded ${slugToId.size} cities from DB\n`);

  // Build per-metro indices and stage city_costs updates
  type CostUpdate = {
    city_id: string;
    year: number;
    cost_index: number | null;
    grocery_index: number | null;
    housing_index: number | null;
    transportation_index: number | null;
    healthcare_index: number | null;
    data_source: string;
  };

  const updates: CostUpdate[] = [];
  let metrosWithData = 0;

  for (const [code, meta] of Object.entries(METROS)) {
    const metroAll = valueByseries.get(seriesId(code, ITEM.allItems));
    if (metroAll == null) {
      console.warn(`  skipping ${code} ${meta.name}: no all-items CPI`);
      continue;
    }
    metrosWithData++;

    const indices = {
      cost_index: ratio(metroAll, nat.all),
      grocery_index: ratio(valueByseries.get(seriesId(code, ITEM.food)) ?? null, nat.food ?? null),
      housing_index: ratio(valueByseries.get(seriesId(code, ITEM.housing)) ?? null, nat.housing ?? null),
      transportation_index: ratio(
        valueByseries.get(seriesId(code, ITEM.transport)) ?? null,
        nat.transport ?? null,
      ),
      healthcare_index: ratio(
        valueByseries.get(seriesId(code, ITEM.medical)) ?? null,
        nat.medical ?? null,
      ),
    };

    console.log(
      `  ${code} ${meta.name}: cost_index=${indices.cost_index}, housing=${indices.housing_index}`,
    );

    for (const slug of meta.slugs) {
      const cityId = slugToId.get(slug);
      if (!cityId) {
        console.warn(`    no city record for ${slug} (run ingest-census first?)`);
        continue;
      }
      updates.push({
        city_id: cityId,
        year: TARGET_YEAR,
        ...indices,
        data_source: "BLS CPI-U",
      });
    }
  }

  console.log(
    `\n${metrosWithData}/${Object.keys(METROS).length} metros had CPI data. Upserting ${updates.length} city_costs rows…`,
  );

  // Upsert in chunks. Because city_costs is unique on (city_id, year), this
  // merges into existing Census rows: fields we don't set (income, rent,
  // home value) are preserved.
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
