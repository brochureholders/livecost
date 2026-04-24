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
 * City → MSA mapping: BEA publishes by MSA (CBSA). We infer each city's
 * MSA via:
 *   1. Direct name match — if an MSA name contains our city's name,
 *      that city is in that MSA.
 *   2. Proximity fallback — any city that doesn't match by name gets
 *      assigned to the MSA whose name-matched anchor city is closest
 *      by haversine distance.
 *
 * This isn't as accurate as the Census CBSA crosswalk (which would
 * require another API call), but it's correct for the ~200 cities that
 * share an MSA name with a larger city, and close enough for most
 * suburb cases (a suburb 15 miles from Cleveland shouldn't differ
 * meaningfully from Cleveland-Elyria MSA on RPPs).
 *
 * Run: npx tsx scripts/ingest-bea-rpp.ts
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

/** Extract primary city names from an MSA name:
 *    "Austin-Round Rock, TX (Metropolitan Statistical Area)"
 *    → ["Austin", "Round Rock"], "TX"
 */
function parseMsaName(name: string): { cities: string[]; state: string | null } {
  // Strip the trailing (... Area) portion
  const cleaned = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  // Split on ", " for the state suffix
  const parts = cleaned.split(", ");
  if (parts.length < 2) return { cities: [cleaned], state: null };
  const state = parts[parts.length - 1].trim().split("-")[0]; // "TX-AR" → "TX" (primary)
  const cityPart = parts.slice(0, -1).join(", ");
  const cities = cityPart.split("-").map((c) => c.trim());
  return { cities, state };
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

  // Phase 1: direct name match. For each MSA, find cities in our DB whose
  // name appears in the MSA name AND state matches.
  const cityToMsa = new Map<string, string>(); // city_id → MSA geoFips
  for (const msa of msaMap.values()) {
    const { cities: msaCities, state } = parseMsaName(msa.geoName);
    if (!state) continue;
    for (const mc of msaCities) {
      const normalized = mc.toLowerCase();
      for (const c of cities) {
        if (c.state_code !== state) continue;
        if (cityToMsa.has(c.id)) continue;
        if (c.name.toLowerCase() === normalized) {
          cityToMsa.set(c.id, msa.geoFips);
        }
      }
    }
  }
  const directMatched = cityToMsa.size;
  console.log(`  direct name match: ${directMatched} cities`);

  // Phase 2: proximity fallback. For each unmatched city, find the MSA
  // whose name-matched anchor city is closest.
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
    `  proximity match: ${proximityMatched} cities, skipped ${proximitySkipped}\n`,
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
