/**
 * Ingest BEA Regional Price Parities (RPPs) into city_costs.
 *
 * Source: data/bea/MARPP_MSA_2008_2024.csv (downloaded from
 * https://apps.bea.gov/regional/zip/MARPP.zip — no API key required).
 *
 * The CSV has 393 MSAs × 5 line codes × 17 years. For our use we pull
 * the latest year (2024) × 5 line codes:
 *   LineCode 1: All items   → cost_index
 *   LineCode 2: Goods       → grocery_index (approx — goods is broader)
 *   LineCode 3: Services: Housing → housing_index
 *   LineCode 4: Services: Utilities → utilities_index
 *   LineCode 5: Services: Other → transportation_index + healthcare_index
 *
 * Services-Other is BEA's only remaining services bucket (excluding
 * housing + utilities), which effectively proxies transportation,
 * healthcare, and other services. We assign it to both transportation
 * and healthcare since we don't have a better breakdown.
 *
 * City → MSA mapping: BEA publishes by CBSA GEOID (5-digit) for each
 * MSA. We resolve each city's CBSA via the official Census Geocoder
 * API — call once per city's lat/lon, get back the canonical CBSA
 * GEOID, match directly against BEA's geoFips column. Results cached
 * to data/census/city-cbsa-cache.json so subsequent runs are instant.
 *
 * Cities outside any CBSA (rural standalone places) fall back to the
 * legacy proximity heuristic: pick the nearest geocoder-matched city's
 * CBSA, capped at 200 miles, otherwise skip.
 *
 * Run: npx tsx scripts/ingest-bea-rpp.ts
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

loadEnv({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

const CSV_PATH = resolve(
  process.cwd(),
  "data/bea/MARPP_MSA_2008_2024.csv",
);
const TARGET_YEAR_COL = "2024";
const COST_YEAR = 2022; // align with existing city_costs rows
// Blend: how much of the BEA signal overwrites the current city_costs values.
// 1.0 = fully replace; 0.0 = keep current. Partial blend keeps our Census
// rent-based housing_index influential (since Reading's MSA RPP doesn't
// capture that Reading proper is cheaper than Philly).
const BEA_WEIGHT = 0.7;
const EXISTING_WEIGHT = 1 - BEA_WEIGHT;

type MsaRow = {
  geoFips: string;
  geoName: string;
  lineCode: number;
  value: number | null;
};

function parseCsv(path: string, yearCol: string): MsaRow[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",");
  const yearIdx = header.indexOf(yearCol);
  if (yearIdx < 0) throw new Error(`Year column "${yearCol}" not in CSV header`);

  const rows: MsaRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser handling quoted fields (BEA CSV has commas in GeoName).
    const line = lines[i];
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    // Footer rows have a single cell; skip anything that doesn't look
    // like a MARPP data row.
    if (cells.length < yearIdx + 1) continue;
    if (cells[3]?.trim() !== "MARPP") continue;
    const geoFips = cells[0].trim().replace(/"/g, "");
    const geoName = cells[1].trim().replace(/"/g, "");
    const lineCode = Number(cells[4]);
    if (!Number.isFinite(lineCode)) continue;
    const rawValue = cells[yearIdx]?.trim() ?? "";
    const v = Number(rawValue);
    rows.push({
      geoFips,
      geoName,
      lineCode,
      value: Number.isFinite(v) ? v : null,
    });
  }
  return rows;
}

type MsaData = {
  geoFips: string;
  geoName: string;
  allItems: number | null;
  goods: number | null;
  housing: number | null;
  utilities: number | null;
  otherServices: number | null;
};

function indexMsas(rows: MsaRow[]): Map<string, MsaData> {
  const m = new Map<string, MsaData>();
  for (const r of rows) {
    if (r.geoFips === "00000" || r.geoFips === "00999") continue;
    if (!m.has(r.geoFips)) {
      m.set(r.geoFips, {
        geoFips: r.geoFips,
        geoName: r.geoName,
        allItems: null,
        goods: null,
        housing: null,
        utilities: null,
        otherServices: null,
      });
    }
    const d = m.get(r.geoFips)!;
    if (r.lineCode === 1) d.allItems = r.value;
    else if (r.lineCode === 2) d.goods = r.value;
    else if (r.lineCode === 3) d.housing = r.value;
    else if (r.lineCode === 4) d.utilities = r.value;
    else if (r.lineCode === 5) d.otherServices = r.value;
  }
  return m;
}

// ---------------------------------------------------------------------------
// County → CBSA resolution via FCC reverse-geocode + Census crosswalk
// ---------------------------------------------------------------------------
// FCC's free Block API takes a lat/lon and returns the 5-digit county FIPS.
// The Census-derived JSON crosswalk then maps that FIPS to a CBSA GEOID,
// which matches BEA's geoFips column directly. Lookups cached to disk.

const CACHE_PATH = resolve(process.cwd(), "data/census/city-cbsa-cache.json");
type CbsaHit = { geoid: string; countyFips: string; countyName: string } | null;
type Cache = Record<string, CbsaHit>;

function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
  } catch {
    return {};
  }
}
function saveCache(cache: Cache): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

const COUNTY_TO_CBSA_PATH = resolve(
  process.cwd(),
  "data/census/county-to-cbsa.json",
);
function loadCountyToCbsa(): Record<string, string> {
  if (!existsSync(COUNTY_TO_CBSA_PATH)) {
    throw new Error(
      `Missing county→CBSA crosswalk at ${COUNTY_TO_CBSA_PATH}. ` +
        `Generate it once via scripts/_build-cbsa-crosswalk.ts.`,
    );
  }
  return JSON.parse(readFileSync(COUNTY_TO_CBSA_PATH, "utf8")) as Record<
    string,
    string
  >;
}

type FccBlockResponse = {
  County?: { FIPS?: string; name?: string };
};

/** Resolve a (lat, lon) to its CBSA GEOID via FCC + the county→CBSA
 *  crosswalk. Returns null for cities outside any CBSA (rural standalone
 *  places — about 5% of the US population doesn't live in a CBSA). Cached
 *  per (lat, lon) rounded to 4 decimals. */
async function lookupCbsa(
  lat: number,
  lon: number,
  countyToCbsa: Record<string, string>,
  cache: Cache,
): Promise<CbsaHit> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (key in cache) return cache[key];

  const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      cache[key] = null;
      return null;
    }
    const json = (await res.json()) as FccBlockResponse;
    const countyFips = json.County?.FIPS;
    const countyName = json.County?.name;
    if (!countyFips || !countyName) {
      cache[key] = null;
      return null;
    }
    const cbsa = countyToCbsa[countyFips];
    if (!cbsa) {
      // County exists but isn't part of any CBSA (rural standalone county).
      cache[key] = null;
      return null;
    }
    const hit: CbsaHit = { geoid: cbsa, countyFips, countyName };
    cache[key] = hit;
    return hit;
  } catch {
    cache[key] = null;
    return null;
  }
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function blend(a: number | null, b: number | null, w: number): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Number((a * w + b * (1 - w)).toFixed(2));
}

async function main() {
  console.log("BEA RPP ingest — reading CSV…");
  const rows = parseCsv(CSV_PATH, TARGET_YEAR_COL);
  const msaMap = indexMsas(rows);
  console.log(`  ${msaMap.size} MSAs parsed for ${TARGET_YEAR_COL}`);

  // Sample
  const austinMsa = [...msaMap.values()].find((m) => m.geoName.includes("Austin"));
  if (austinMsa) {
    console.log(`  sample: ${austinMsa.geoName}`);
    console.log(
      `    allItems=${austinMsa.allItems}, goods=${austinMsa.goods}, housing=${austinMsa.housing}, utilities=${austinMsa.utilities}, other=${austinMsa.otherServices}`,
    );
  }

  // Load cities with lat/lon
  const { data: citiesRaw, error } = await sb
    .from("cities")
    .select("id, slug, name, state_code, latitude, longitude")
    .range(0, 999);
  if (error) throw new Error(error.message);
  type City = {
    id: string;
    slug: string;
    name: string;
    state_code: string;
    latitude: number | null;
    longitude: number | null;
  };
  const cities = (citiesRaw ?? []) as City[];
  console.log(`\nLoaded ${cities.length} cities.\n`);

  // Phase 1: FCC reverse-geocode + Census crosswalk. For each city's
  // lat/lon, FCC returns the 5-digit county FIPS; the crosswalk maps that
  // to a 5-digit CBSA GEOID, which matches BEA's geoFips directly. No
  // name heuristic, no proximity guess.
  const countyToCbsa = loadCountyToCbsa();
  console.log(`Loaded ${Object.keys(countyToCbsa).length} county→CBSA mappings.`);
  const lookupCache = loadCache();
  const cacheSizeBefore = Object.keys(lookupCache).length;
  const cityToMsa = new Map<string, string>();
  let cbsaMatched = 0;
  let outsideCbsa = 0;
  let cbsaMissingFips = 0;
  let progress = 0;
  for (const c of cities) {
    progress++;
    if (c.latitude == null || c.longitude == null) continue;
    const hit = await lookupCbsa(c.latitude, c.longitude, countyToCbsa, lookupCache);
    if (!hit) {
      outsideCbsa++;
      continue;
    }
    if (msaMap.has(hit.geoid)) {
      cityToMsa.set(c.id, hit.geoid);
      cbsaMatched++;
    } else {
      // City is in a CBSA but BEA doesn't publish RPP for it (BEA only
      // covers Metropolitan, not Micropolitan, so µSA cities miss). Falls
      // through to proximity below.
      cbsaMissingFips++;
    }
    // Persist the cache every 50 lookups so a mid-run abort doesn't
    // discard accumulated work.
    if (progress % 50 === 0) {
      saveCache(lookupCache);
      console.log(
        `  resolved ${progress}/${cities.length} (${cbsaMatched} matched, ${outsideCbsa} non-CBSA so far)`,
      );
    }
  }
  saveCache(lookupCache);
  const cacheSizeAfter = Object.keys(lookupCache).length;
  console.log(
    `  CBSA match: ${cbsaMatched} cities (${cbsaMissingFips} in a CBSA without BEA RPP, ${outsideCbsa} not in any CBSA)`,
  );
  console.log(
    `  cache: ${cacheSizeBefore} → ${cacheSizeAfter} entries (${cacheSizeAfter - cacheSizeBefore} new lookups)\n`,
  );

  // Phase 2: proximity fallback for cities the geocoder couldn't place in a
  // BEA-covered MSA. Anchored on the geocoder-matched cities, capped at
  // 200 miles so isolated rural cities aren't force-mapped to a distant
  // metro that's nothing like them.
  type Anchor = { msaFips: string; lat: number; lon: number };
  const anchors: Anchor[] = [];
  for (const c of cities) {
    const msaFips = cityToMsa.get(c.id);
    if (!msaFips) continue;
    if (c.latitude == null || c.longitude == null) continue;
    anchors.push({ msaFips, lat: c.latitude, lon: c.longitude });
  }
  let proximityMatched = 0;
  let proximitySkipped = 0;
  for (const c of cities) {
    if (cityToMsa.has(c.id)) continue;
    if (c.latitude == null || c.longitude == null) {
      proximitySkipped++;
      continue;
    }
    let bestMsa: string | null = null;
    let bestDist = Infinity;
    for (const a of anchors) {
      const d = haversineMiles(c.latitude, c.longitude, a.lat, a.lon);
      if (d < bestDist) {
        bestDist = d;
        bestMsa = a.msaFips;
      }
    }
    if (bestMsa && bestDist < 200) {
      cityToMsa.set(c.id, bestMsa);
      proximityMatched++;
    } else {
      proximitySkipped++;
    }
  }
  console.log(
    `  proximity fallback: ${proximityMatched} cities, skipped ${proximitySkipped}\n`,
  );

  // Fetch current city_costs for the target year so we can blend BEA with
  // existing values (keeps our Census rent-based housing_index influential).
  const { data: costsRaw, error: cErr } = await sb
    .from("city_costs")
    .select(
      "id, city_id, year, cost_index, housing_index, grocery_index, utilities_index, transportation_index, healthcare_index",
    )
    .eq("year", COST_YEAR)
    .range(0, 1999);
  if (cErr) throw new Error(cErr.message);
  type CostRow = {
    id: string;
    city_id: string;
    cost_index: number | null;
    housing_index: number | null;
    grocery_index: number | null;
    utilities_index: number | null;
    transportation_index: number | null;
    healthcare_index: number | null;
  };
  const costById = new Map<string, CostRow>();
  for (const r of (costsRaw ?? []) as CostRow[]) costById.set(r.city_id, r);
  console.log(`Loaded ${costById.size} existing city_costs rows for ${COST_YEAR}.\n`);

  // Build updates
  type Update = {
    id: string;
    cost_index: number | null;
    housing_index: number | null;
    grocery_index: number | null;
    utilities_index: number | null;
    transportation_index: number | null;
    healthcare_index: number | null;
  };
  const updates: Update[] = [];
  let updatedCount = 0;

  for (const c of cities) {
    const msaFips = cityToMsa.get(c.id);
    if (!msaFips) continue;
    const msa = msaMap.get(msaFips);
    if (!msa) continue;
    const cost = costById.get(c.id);
    if (!cost) continue;

    // Blend BEA (70%) with current (30%). Keeps city-level housing nuance.
    const housing = blend(msa.housing, cost.housing_index, BEA_WEIGHT);
    const grocery = blend(msa.goods, cost.grocery_index, BEA_WEIGHT);
    const utilities = blend(msa.utilities, cost.utilities_index, BEA_WEIGHT);
    const transportation = blend(
      msa.otherServices,
      cost.transportation_index,
      BEA_WEIGHT,
    );
    const healthcare = blend(
      msa.otherServices,
      cost.healthcare_index,
      BEA_WEIGHT,
    );
    // Recompute cost_index as a weighted composite of the new sub-indices.
    const SHARE = {
      housing: 0.33,
      grocery: 0.13,
      utilities: 0.07,
      transportation: 0.17,
      healthcare: 0.08,
    };
    const parts: { v: number; w: number }[] = [];
    if (housing != null) parts.push({ v: housing, w: SHARE.housing });
    if (grocery != null) parts.push({ v: grocery, w: SHARE.grocery });
    if (utilities != null) parts.push({ v: utilities, w: SHARE.utilities });
    if (transportation != null)
      parts.push({ v: transportation, w: SHARE.transportation });
    if (healthcare != null) parts.push({ v: healthcare, w: SHARE.healthcare });
    const wsum = parts.reduce((s, p) => s + p.w, 0);
    const cost_index = wsum > 0
      ? Number((parts.reduce((s, p) => s + p.v * p.w, 0) / wsum).toFixed(2))
      : cost.cost_index;

    updates.push({
      id: cost.id,
      cost_index,
      housing_index: housing,
      grocery_index: grocery,
      utilities_index: utilities,
      transportation_index: transportation,
      healthcare_index: healthcare,
    });
    updatedCount++;
  }

  console.log(`Updating ${updatedCount} city_costs rows with BEA-blended indices…`);

  const CONCURRENCY = 8;
  async function applyOne(u: Update, attempt = 1): Promise<void> {
    const { error: upErr } = await sb
      .from("city_costs")
      .update({
        cost_index: u.cost_index,
        housing_index: u.housing_index,
        grocery_index: u.grocery_index,
        utilities_index: u.utilities_index,
        transportation_index: u.transportation_index,
        healthcare_index: u.healthcare_index,
      })
      .eq("id", u.id);
    if (upErr && attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return applyOne(u, attempt + 1);
    }
    if (upErr) console.error(`  row ${u.id}: ${upErr.message}`);
  }

  let done = 0;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const batch = updates.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((u) => applyOne(u)));
    done += batch.length;
    if (done % 80 === 0 || done === updates.length) {
      console.log(`  ${done}/${updates.length}`);
    }
  }

  // Sanity check
  console.log("\nSanity check:");
  const { data: samples } = await sb
    .from("cities")
    .select("id, name")
    .in("slug", ["austin-tx", "reading-pa", "parma-oh", "san-francisco-ca", "auburn-al"]);
  if (samples) {
    for (const city of samples) {
      const { data: cc } = await sb
        .from("city_costs")
        .select(
          "cost_index, housing_index, grocery_index, utilities_index, transportation_index, healthcare_index",
        )
        .eq("city_id", city.id)
        .eq("year", COST_YEAR)
        .limit(1);
      console.log(`  ${city.name}:`, cc?.[0]);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
