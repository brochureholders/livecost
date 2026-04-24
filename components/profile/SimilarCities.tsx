import Link from "next/link";
import type { CitySummary } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";

type Props = {
  anchorName: string;
  anchorSlug: string;
  anchorIndex: number | null;
  cities: CitySummary[];
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function SimilarCities({
  anchorName,
  anchorSlug,
  anchorIndex,
  cities,
}: Props) {
  if (cities.length === 0) return null;

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Cities with similar cost of living
      </h2>
      <p className="mt-2 text-[var(--muted)]">
        {anchorIndex != null
          ? `Within 10 points of ${anchorName}'s cost index of ${anchorIndex.toFixed(0)}, sorted by closest match.`
          : `Cities comparable to ${anchorName}.`}
      </p>
      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cities.map((c) => {
          const diff =
            anchorIndex != null && c.cost_index != null
              ? c.cost_index - anchorIndex
              : null;
          const [x, y] = canonicalizePair(anchorSlug, c.slug);
          const pair = formatPair(x, y);
          return (
            <li key={c.id}>
              <Link
                href={`/compare/${pair}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {c.name}{" "}
                    <span className="text-[var(--muted)] font-normal">
                      {c.state_code}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {c.median_rent != null
                      ? `Median rent ${CURRENCY.format(c.median_rent)}/mo`
                      : "Population " + (c.population?.toLocaleString() ?? "—")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-semibold tabular-nums text-[var(--accent)]">
                    {c.cost_index != null ? c.cost_index.toFixed(0) : "—"}
                  </div>
                  {diff != null && (
                    <div className="text-xs text-[var(--muted)] tabular-nums">
                      {diff === 0
                        ? "same"
                        : diff > 0
                          ? `+${diff.toFixed(0)}`
                          : diff.toFixed(0)}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
