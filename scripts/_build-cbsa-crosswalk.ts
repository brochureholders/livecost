/**
 * One-time helper: parse Census's CBSA delineation XLSX and emit
 * data/census/county-to-cbsa.json — a flat mapping county FIPS (5-digit
 * "SSCCC") → CBSA GEOID (5-digit). Source:
 *   https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx
 *
 * Run: npx tsx scripts/_build-cbsa-crosswalk.ts /path/to/list1.xlsx
 *
 * Not part of the regular pipeline — runs once when Census publishes a
 * new delineation vintage. The committed JSON is what the BEA ingest
 * actually reads at run time.
 */
import * as xlsx from "xlsx";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("usage: tsx scripts/_build-cbsa-crosswalk.ts <list1_YYYY.xlsx>");
  process.exit(1);
}

const wb = xlsx.readFile(inputPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const grid = xlsx.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

// The file has a few title rows at the top. Find the header row by looking
// for the literal "CBSA Code".
let headerIdx = -1;
for (let i = 0; i < Math.min(grid.length, 10); i++) {
  const row = grid[i];
  if (row.some((c) => typeof c === "string" && /CBSA Code/i.test(c))) {
    headerIdx = i;
    break;
  }
}
if (headerIdx < 0) {
  console.error("Could not locate CBSA Code header in the first 10 rows");
  process.exit(1);
}
const header = grid[headerIdx].map((c) => (typeof c === "string" ? c.trim() : ""));
const colCbsa = header.findIndex((h) => /^CBSA Code$/i.test(h));
const colState = header.findIndex((h) => /^FIPS State Code$/i.test(h));
const colCounty = header.findIndex((h) => /^FIPS County Code$/i.test(h));
if (colCbsa < 0 || colState < 0 || colCounty < 0) {
  console.error("Missing one of the required columns. Header was:", header);
  process.exit(1);
}

const map: Record<string, string> = {};
for (let i = headerIdx + 1; i < grid.length; i++) {
  const row = grid[i];
  if (!row || row.length < Math.max(colCbsa, colState, colCounty)) continue;
  const cbsa = String(row[colCbsa] ?? "").trim();
  const state = String(row[colState] ?? "").trim();
  const county = String(row[colCounty] ?? "").trim();
  if (!/^\d{5}$/.test(cbsa)) continue;
  if (!/^\d{2}$/.test(state)) continue;
  if (!/^\d{3}$/.test(county)) continue;
  map[`${state}${county}`] = cbsa;
}

const outPath = resolve(process.cwd(), "data/census/county-to-cbsa.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(map, null, 2));
console.log(`Wrote ${Object.keys(map).length} county→CBSA mappings to ${outPath}`);
