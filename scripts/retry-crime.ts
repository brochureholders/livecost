/**
 * Cheap probe + retry for the FBI CDE outage.
 *
 * The full ingest-crime.ts iterates 50 states × hundreds of agencies and
 * blindly burns through the api.data.gov rate budget even when the API is
 * still 403'ing. This wrapper does one canary request first; if the API
 * responds 200, it spawns the full ingest. If the canary fails, it prints
 * the status and exits without touching the rate limit.
 *
 * Wire to cron (daily/hourly) so the moment the federal API recovers, the
 * pipeline auto-fills the ~538 cities currently flagged on /coverage.
 *
 * Usage:
 *   npx tsx scripts/retry-crime.ts             # probe + run on success
 *   npx tsx scripts/retry-crime.ts --probe     # probe only, no ingest run
 *
 * Exit codes:
 *   0  API up (and ingest succeeded, if not --probe)
 *   1  API still degraded — no ingest attempted
 *   2  Ingest spawned but failed
 *   3  Misconfiguration (missing env)
 */
import { config as loadEnv } from "dotenv";
import { spawn } from "child_process";

loadEnv({ path: ".env.local" });

const API_KEY = process.env.API_DATA_GOV_KEY;
if (!API_KEY) {
  console.error("Missing API_DATA_GOV_KEY in .env.local");
  process.exit(3);
}

// Canary: a small, stable response. California has the most agencies so it's
// the most reliable signal that the byStateAbbr endpoint is back online; the
// payload is small enough to not waste bandwidth.
const CANARY_URL = `https://api.usa.gov/crime/fbi/cde/agency/byStateAbbr/CA?api_key=${API_KEY}`;
const TIMEOUT_MS = 15_000;

const probeOnly = process.argv.includes("--probe");

async function probe(): Promise<{ ok: boolean; status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CANARY_URL, { signal: ctrl.signal });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function runIngest(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "scripts/ingest-crime.ts"], {
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  console.log(`[retry-crime] Probing FBI CDE via ${new URL(CANARY_URL).host}…`);
  const t0 = Date.now();
  let result: { ok: boolean; status: number; body: string };
  try {
    result = await probe();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[retry-crime] Probe failed: ${msg}`);
    console.error(
      "  Network or timeout error — not the same as a 403. Check connectivity.",
    );
    process.exit(1);
  }
  const ms = Date.now() - t0;

  if (!result.ok) {
    console.log(
      `[retry-crime] API still degraded — HTTP ${result.status} in ${ms}ms`,
    );
    if (result.body) console.log(`  Body preview: ${result.body}`);
    console.log("  No ingest attempted. Try again later.");
    process.exit(1);
  }

  console.log(
    `[retry-crime] API responded HTTP ${result.status} in ${ms}ms — looks recovered.`,
  );
  if (probeOnly) {
    console.log("[retry-crime] --probe set, exiting without running ingest.");
    process.exit(0);
  }

  console.log("[retry-crime] Spawning ingest-crime.ts…\n");
  const code = await runIngest();
  if (code === 0) {
    console.log(
      "\n[retry-crime] Ingest complete. Run `npm run refresh:audit` next so " +
        "the coverage report and DataCompletenessBadge reflect the new state.",
    );
    process.exit(0);
  } else {
    console.error(`\n[retry-crime] Ingest exited ${code}.`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
