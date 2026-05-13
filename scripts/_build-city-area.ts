/**
 * One-time helper: parse the Census Gazetteer place file and emit
 * data/census/city-area.json — slug → land area in square miles for
 * every city in our cities table.
 *
 * Run: npx tsx scripts/_build-city-area.ts
 *
 * Not part of the regular pipeline — runs when a new Gazetteer
 * vintage drops (every few years). The committed JSON is what the
 * comparison page actually reads at request time.
 *
 * Source: data/census/2024_Gaz_place_national.txt (tab-separated).
 * Columns: USPS GEOID ANSICODE NAME LSAD FUNCSTAT ALAND AWATER
 *          ALAND_SQMI AWATER_SQMI INTPTLAT INTPTLONG
 * We match by the 7-digit GEOID which corresponds to our
 * cities.fips_code column.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase env in .env.local");
}
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const GAZ_PATH = resolve(
  process.cwd(),
  "data/census/2024_Gaz_place_national.txt",
);
const OUT_PATH = resolve(process.cwd(), "data/census/city-area.json");

async function main() {
  console.log("Loading cities from Supabase…");
  const { data, error } = await sb
    .from("cities")
    .select("slug, fips_code")
    .range(0, 9999);
  if (error) throw new Error(error.message);
  const cities = (data ?? []) as { slug: string; fips_code: string | null }[];
  console.log(`  ${cities.length} cities loaded`);

  // Build {fips → slug} for lookup
  const fipsToSlug = new Map<string, string>();
  for (const c of cities) {
    if (c.fips_code) fipsToSlug.set(c.fips_code, c.slug);
  }

  console.log(`Parsing Gazetteer at ${GAZ_PATH}…`);
  const text = readFileSync(GAZ_PATH, "utf8");
  const lines = text.split(/\r?\n/);
  const header = lines[0].split("\t");
  const geoidIdx = header.indexOf("GEOID");
  const areaIdx = header.findIndex((h) => h.trim() === "ALAND_SQMI");
  if (geoidIdx < 0 || areaIdx < 0) {
    throw new Error(
      `Gazetteer header missing required columns: GEOID=${geoidIdx}, ALAND_SQMI=${areaIdx}`,
    );
  }

  const out: Record<string, number> = {};
  let matched = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t");
    const geoid = cells[geoidIdx]?.trim();
    const area = Number(cells[areaIdx]);
    if (!geoid || !Number.isFinite(area)) continue;
    const slug = fipsToSlug.get(geoid);
    if (!slug) continue;
    out[slug] = Number(area.toFixed(3));
    matched++;
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(
    `Matched ${matched}/${cities.length} cities. Wrote ${OUT_PATH}.`,
  );
  if (matched < cities.length) {
    const missing = cities.filter((c) => !out[c.slug]);
    console.log(`Unmatched (${missing.length}, first 10):`);
    missing.slice(0, 10).forEach((c) =>
      console.log(`  ${c.slug} (fips=${c.fips_code ?? "—"})`),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
