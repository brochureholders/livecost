/**
 * Refresh the full data pipeline.
 *
 *   npm run refresh           → ingest + derive + audit (the works)
 *   npm run refresh:scores    → derive + audit only (no API calls; ~30s)
 *   npm run refresh:audit     → audit only (no DB writes; ~5s)
 *
 * Or call directly with flags:
 *   npx tsx scripts/refresh-all.ts                 # everything
 *   npx tsx scripts/refresh-all.ts --skip-ingest   # derive + audit
 *   npx tsx scripts/refresh-all.ts --only=audit    # just one stage
 *
 * Non-fatal failures (e.g. the FBI Crime API outage) are reported in the
 * final summary but don't abort the run. Set --strict to abort on first
 * failure instead.
 */
import { spawn } from "child_process";

type Stage = "ingest" | "derive" | "audit";
type Step = { name: string; script: string; stage: Stage };

const STEPS: Step[] = [
  // Raw ingestion — independent sources, run sequentially to avoid
  // hammering APIs and hitting rate limits.
  { name: "census", script: "ingest-census.ts", stage: "ingest" },
  { name: "bls", script: "ingest-bls.ts", stage: "ingest" },
  { name: "bea-rpp", script: "ingest-bea-rpp.ts", stage: "ingest" },
  { name: "walkscore", script: "ingest-walkscore.ts", stage: "ingest" },
  { name: "weather-ncei", script: "ingest-weather-ncei.ts", stage: "ingest" },
  { name: "weather", script: "ingest-weather.ts", stage: "ingest" },
  { name: "aqs", script: "ingest-aqs.ts", stage: "ingest" },
  { name: "crime", script: "ingest-crime.ts", stage: "ingest" },

  // Derived: must run AFTER raw ingestion, in this order.
  { name: "recompute-cost-indices", script: "recompute-cost-indices.ts", stage: "derive" },
  { name: "compute-urbrank-scores", script: "compute-urbrank-scores.ts", stage: "derive" },

  // Audit: snapshot of what landed. Must be last so the JSON reflects
  // everything the pipeline just produced.
  { name: "audit-coverage", script: "audit-coverage.ts", stage: "audit" },
];

type Result = { name: string; ok: boolean; durationMs: number; exitCode: number | null };

function run(scriptName: string): Promise<{ exitCode: number | null }> {
  // Pass a relative script path (no spaces) so the project living under a
  // path with spaces ("Cost of Living") doesn't break shell-quoted args.
  // shell:true is required on Windows to launch .cmd shims like npx.cmd.
  const relPath = `scripts/${scriptName}`;
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", relPath], {
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => resolve({ exitCode: code }));
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const skipIngest = args.includes("--skip-ingest");
  const strict = args.includes("--strict");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;
  return { skipIngest, strict, only };
}

async function main() {
  const { skipIngest, strict, only } = parseArgs();

  let steps = STEPS;
  if (only) {
    steps = steps.filter(
      (s) => only.includes(s.name) || only.includes(s.stage),
    );
    if (steps.length === 0) {
      console.error(`No steps matched --only=${only.join(",")}`);
      process.exit(1);
    }
  } else if (skipIngest) {
    steps = steps.filter((s) => s.stage !== "ingest");
  }

  console.log(`Refresh plan (${steps.length} steps):`);
  for (const s of steps) console.log(`  [${s.stage}] ${s.name}`);
  console.log("");

  const results: Result[] = [];
  for (const step of steps) {
    const banner = `── ${step.stage.toUpperCase()}: ${step.name} `;
    console.log("\n" + banner + "─".repeat(Math.max(0, 64 - banner.length)));
    const t0 = Date.now();
    const { exitCode } = await run(step.script);
    const durationMs = Date.now() - t0;
    const ok = exitCode === 0;
    results.push({ name: step.name, ok, durationMs, exitCode });
    if (!ok && strict) {
      console.error(`\n[refresh-all] ${step.name} failed; aborting (--strict).`);
      break;
    }
  }

  console.log("\n" + "═".repeat(64));
  console.log("Refresh summary");
  console.log("═".repeat(64));
  for (const r of results) {
    const status = r.ok ? "OK    " : "FAIL  ";
    const time = `${(r.durationMs / 1000).toFixed(1)}s`.padStart(7);
    console.log(`  ${status} ${r.name.padEnd(28)} ${time}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(
      `\n${failed.length} step(s) failed: ${failed.map((f) => f.name).join(", ")}`,
    );
    process.exit(1);
  }
  console.log("\nAll steps completed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
