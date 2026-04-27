import type { Metadata } from "next";
import Link from "next/link";
import { getCoverageReport, type Dim } from "@/lib/coverage";

export const metadata: Metadata = {
  title: "Coverage report — UrbRank (internal)",
  description: "Per-dimension data coverage across all cities.",
  robots: { index: false, follow: false },
};

const DIMENSIONS: Dim[] = [
  "affordability",
  "safety",
  "climate",
  "walkability",
  "job_market",
  "environment",
  "education",
];

const DIM_LABELS: Record<Dim, string> = {
  affordability: "Affordability",
  safety: "Safety",
  climate: "Climate",
  walkability: "Walkability",
  job_market: "Job Market",
  environment: "Environment",
  education: "Education",
};

function pct(n: number, total: number): string {
  if (total === 0) return "—";
  return `${((n / total) * 100).toFixed(1)}%`;
}

export default function CoveragePage() {
  const report = getCoverageReport();
  const total = report.total_cities;
  const generated = new Date(report.generated_at);

  // Sort histogram keys descending (7/7 first)
  const histKeys = Object.keys(report.histogram).sort(
    (a, b) => parseInt(b) - parseInt(a),
  );

  // Weakest large cities — same logic as the audit script's CLI output.
  const weak = [...report.cities]
    .filter((c) => (c.population ?? 0) >= 100_000)
    .sort(
      (a, b) =>
        a.present - b.present || (b.population ?? 0) - (a.population ?? 0),
    )
    .slice(0, 30);

  const anomalies = report.anomalies ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">
            Coverage report
          </li>
        </ol>
      </nav>

      <section className="mt-8">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Internal · noindex
        </p>
        <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
          Coverage report
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {total.toLocaleString()} cities · generated{" "}
          {generated.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Refresh with{" "}
          <code className="text-xs">npm run refresh:audit</code>.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Per-dimension fill rate
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--background)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Dimension</th>
                <th className="px-5 py-3 font-medium text-right">Present</th>
                <th className="px-5 py-3 font-medium text-right">Fallback</th>
                <th className="px-5 py-3 font-medium text-right">Missing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {DIMENSIONS.map((d) => {
                const s = report.per_dimension[d] ?? {
                  present: 0,
                  fallback: 0,
                  missing: 0,
                };
                const isProblem = s.missing / total > 0.25;
                return (
                  <tr
                    key={d}
                    className={isProblem ? "bg-amber-50 text-amber-900" : ""}
                  >
                    <td className="px-5 py-3 font-medium">{DIM_LABELS[d]}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {pct(s.present, total)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {s.fallback > 0 ? pct(s.fallback, total) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {s.missing > 0 ? pct(s.missing, total) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Highlighted rows have &gt;25% missing — likely an upstream API
          issue worth investigating.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Cities by dimensions populated
        </h2>
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <ul className="space-y-2 text-sm">
            {histKeys.map((k) => {
              const count = report.histogram[k];
              const w = (count / total) * 100;
              return (
                <li key={k} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 tabular-nums font-medium">
                    {k}
                  </span>
                  <span className="w-20 shrink-0 tabular-nums text-[var(--muted)]">
                    {count.toLocaleString()}
                  </span>
                  <span className="flex-1 h-2 rounded-full bg-[var(--border)] overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${w.toFixed(1)}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums text-[var(--muted)]">
                    {pct(count, total)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Top 30 weakest large cities (pop ≥ 100k)
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--background)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Coverage</th>
                <th className="px-5 py-3 font-medium">City</th>
                <th className="px-5 py-3 font-medium text-right">Population</th>
                <th className="px-5 py-3 font-medium">Missing / fallback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {weak.map((c) => {
                const missing = DIMENSIONS.filter(
                  (d) => c.dims[d] === "missing",
                );
                const fb = DIMENSIONS.filter((d) => c.dims[d] === "fallback");
                return (
                  <tr key={c.slug}>
                    <td className="px-5 py-3 font-medium tabular-nums">
                      {c.present}/7
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/cost-of-living/${c.slug}`}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {c.name}, {c.state_code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--muted)]">
                      {c.population?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--muted)]">
                      {missing.length > 0 && `missing: ${missing.join(", ")}`}
                      {missing.length > 0 && fb.length > 0 && " · "}
                      {fb.length > 0 && `fallback: ${fb.join(", ")}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {report.cities_missing_cost_index.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">
            Cities with no cost_index ({report.cities_missing_cost_index.length})
          </h2>
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="mb-2 font-medium">
              These cities are essentially unscorable — affordability is the
              one dimension every page depends on.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {report.cities_missing_cost_index.slice(0, 30).map((slug) => (
                <li key={slug}>{slug}</li>
              ))}
              {report.cities_missing_cost_index.length > 30 && (
                <li className="italic">
                  … and {report.cities_missing_cost_index.length - 30} more
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          Sanity-check anomalies ({anomalies.length})
        </h2>
        {anomalies.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No values outside the plausible-range bounds. The full rule set
            lives in <code className="text-xs">scripts/audit-coverage.ts</code>.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-300 bg-amber-50">
            <table className="w-full text-sm">
              <thead className="bg-amber-100 text-left text-amber-900">
                <tr>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Field</th>
                  <th className="px-5 py-3 font-medium text-right">Value</th>
                  <th className="px-5 py-3 font-medium">Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 text-amber-900">
                {anomalies.slice(0, 100).map((a, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">{a.city}</td>
                    <td className="px-5 py-3 font-mono text-xs">{a.field}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {String(a.value)}
                    </td>
                    <td className="px-5 py-3 text-xs">{a.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
