/**
 * One-time helper: fetch elevation in meters for every city from
 * Open-Meteo's free Elevation API and emit data/census/city-elevation.json.
 * Open-Meteo is free, no key, ~1k calls is well under their daily quota.
 *
 * Run: npx tsx scripts/_build-city-elevation.ts
 *
 * Not part of the regular pipeline — runs once. Elevation doesn't change.
 * The committed JSON is what lib/elevation.ts reads at request time.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
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

const OUT_PATH = resolve(process.cwd(), "data/census/city-elevation.json");
const REQUEST_DELAY_MS = 100; // be polite — Open-Meteo can take this rate easily

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { elevation?: number[] };
    const v = json.elevation?.[0];
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Loading cities…");
  const { data, error } = await sb
    .from("cities")
    .select("slug, latitude, longitude")
    .range(0, 9999);
  if (error) throw new Error(error.message);
  const cities = (data ?? []) as {
    slug: string;
    latitude: number | null;
    longitude: number | null;
  }[];
  const withCoords = cities.filter((c) => c.latitude != null && c.longitude != null);
  console.log(`${withCoords.length}/${cities.length} cities have coordinates.`);

  const out: Record<string, number> = {};
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < withCoords.length; i++) {
    const c = withCoords[i];
    const elevMeters = await fetchElevation(c.latitude!, c.longitude!);
    if (elevMeters != null) {
      // Round to nearest meter — sub-meter precision is noise
      out[c.slug] = Math.round(elevMeters);
      ok++;
    } else {
      fail++;
    }
    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${withCoords.length}  ok=${ok} fail=${fail}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${Object.keys(out).length} entries to ${OUT_PATH}.`);
  console.log(`Success: ${ok}, failures: ${fail}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
