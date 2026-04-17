import Link from "next/link";
import type { CitySummary } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";

type Props = {
  cities: CitySummary[];
  anchorSlug?: string;
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPop(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function indexClasses(index: number | null) {
  if (index == null) return "text-[var(--muted)]";
  if (index < 95) return "text-emerald-700";
  if (index <= 110) return "text-amber-700";
  return "text-red-700";
}

export default function RankedTable({ cities, anchorSlug }: Props) {
  if (cities.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] italic">
        No cities with cost-of-living data yet. Run the ingest scripts to
        populate this ranking.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--background)] text-left text-[var(--muted)]">
          <tr>
            <th className="px-5 py-3 font-medium w-14">#</th>
            <th className="px-5 py-3 font-medium">City</th>
            <th className="px-5 py-3 font-medium">Cost index</th>
            <th className="px-5 py-3 font-medium">Median rent</th>
            <th className="px-5 py-3 font-medium">Median income</th>
            <th className="px-5 py-3 font-medium">Population</th>
            <th className="px-5 py-3 font-medium w-24"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {cities.map((c, i) => {
            const comparePair = anchorSlug
              ? (() => {
                  const [x, y] = canonicalizePair(anchorSlug, c.slug);
                  return formatPair(x, y);
                })()
              : null;
            return (
              <tr key={c.id}>
                <td className="px-5 py-4 font-semibold tabular-nums text-[var(--muted)]">
                  {i + 1}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/cost-of-living/${c.slug}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {c.name}
                  </Link>
                </td>
                <td
                  className={`px-5 py-4 tabular-nums font-semibold ${indexClasses(c.cost_index)}`}
                >
                  {c.cost_index != null ? c.cost_index.toFixed(0) : "—"}
                </td>
                <td className="px-5 py-4 tabular-nums">
                  {c.median_rent != null
                    ? `${CURRENCY.format(c.median_rent)}/mo`
                    : "—"}
                </td>
                <td className="px-5 py-4 tabular-nums">
                  {c.median_household_income != null
                    ? CURRENCY.format(c.median_household_income)
                    : "—"}
                </td>
                <td className="px-5 py-4 tabular-nums text-[var(--muted)]">
                  {formatPop(c.population)}
                </td>
                <td className="px-5 py-4">
                  {comparePair ? (
                    <Link
                      href={`/compare/${comparePair}`}
                      className="inline-block text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                    >
                      Compare →
                    </Link>
                  ) : (
                    <Link
                      href={`/cost-of-living/${c.slug}`}
                      className="inline-block text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                    >
                      View →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
