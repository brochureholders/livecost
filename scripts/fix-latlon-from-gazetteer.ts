/**
 * Repair latitude/longitude for every city in the DB by looking up its FIPS
 * code in the US Census 2024 Gazetteer file. The Gazetteer publishes the
 * authoritative centroid ("internal point" INTPTLAT/INTPTLONG) for every
 * incorporated place in the US.
 *
 * Runs idempotently — updates lat/lon for all matches, leaves the rest alone.
 *
 * Source file: data/census/2024_Gaz_place_national.txt
 * Downloaded from https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip
 *
 * Run: npx tsx scripts/fix-latlon-from-gazetteer.ts
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

const GAZ_PATH = resolve(
  process.cwd(),
  "data/census/2024_Gaz_place_national.txt",
);

async function main() {
  console.log("Loading Census Gazetteer…");
  const raw = readFileSync(GAZ_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split("\t").map((h) => h.trim());
  const iGeoId = header.indexOf("GEOID");
  const iLat = header.indexOf("INTPTLAT");
  const iLon = header.indexOf("INTPTLONG");
  if (iGeoId < 0 || iLat < 0 || iLon < 0) {
    throw new Error(`Missing expected columns in Gazetteer: ${header.join(",")}`);
  }

  const latLonByGeoId = new Map<string, { lat: number; lon: number }>();
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t").map((c) => c.trim());
    const geoId = cells[iGeoId];
    const lat = Number(cells[iLat]);
    const lon = Number(cells[iLon]);
    if (!geoId || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    latLonByGeoId.set(geoId, { lat, lon });
  }
  console.log(`  ${latLonByGeoId.size} place centroids indexed by GEOID`);

  // Load our cities
  const { data: cities, error } = await sb
    .from("cities")
    .select("id, slug, name, state_code, fips_code, latitude, longitude")
    .range(0, 999);
  if (error) throw new Error(error.message);
  console.log(`  ${cities?.length ?? 0} cities loaded from DB\n`);

  const updates: { id: string; lat: number; lon: number; slug: string }[] = [];
  let unmatched = 0;
  let alreadyGood = 0;

  for (const c of cities ?? []) {
    if (!c.fips_code) {
      unmatched++;
      continue;
    }
    const gaz = latLonByGeoId.get(c.fips_code);
    if (!gaz) {
      unmatched++;
      continue;
    }
    // Only update if current lat/lon differ meaningfully (>0.01 degrees)
    const needsUpdate =
      c.latitude == null ||
      c.longitude == null ||
      Math.abs(c.latitude - gaz.lat) > 0.01 ||
      Math.abs(c.longitude - gaz.lon) > 0.01;
    if (!needsUpdate) {
      alreadyGood++;
      continue;
    }
    updates.push({
      id: c.id,
      lat: gaz.lat,
      lon: gaz.lon,
      slug: c.slug,
    });
  }

  console.log(
    `${updates.length} cities need lat/lon update; ${alreadyGood} already match; ${unmatched} unmatched (missing FIPS or not in Gazetteer)`,
  );

  // Apply updates
  const CONCURRENCY = 8;
  async function applyOne(
    u: { id: string; lat: number; lon: number; slug: string },
    attempt = 1,
  ): Promise<void> {
    const { error: upErr } = await sb
      .from("cities")
      .update({ latitude: u.lat, longitude: u.lon })
      .eq("id", u.id);
    if (upErr && attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return applyOne(u, attempt + 1);
    }
    if (upErr) console.error(`  ${u.slug}: ${upErr.message}`);
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
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
