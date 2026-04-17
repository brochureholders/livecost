import Link from "next/link";
import type { CitySummary } from "@/lib/cities";

type Props = {
  stateName: string;
  cities: CitySummary[];
};

export default function OtherCitiesInState({ stateName, cities }: Props) {
  if (cities.length === 0) return null;

  const sorted = [...cities].sort((a, b) => {
    if (a.cost_index == null && b.cost_index == null) return 0;
    if (a.cost_index == null) return 1;
    if (b.cost_index == null) return -1;
    return a.cost_index - b.cost_index;
  });

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Other cities in {stateName}
      </h2>
      <p className="mt-2 text-[var(--muted)]">
        Sorted by affordability — most affordable first.
      </p>
      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cost-of-living/${c.slug}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)] transition-colors"
            >
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {c.median_rent != null
                    ? `Median rent $${Math.round(c.median_rent).toLocaleString()}/mo`
                    : "No rent data"}
                </div>
              </div>
              <span className="text-lg font-semibold tabular-nums text-[var(--accent)]">
                {c.cost_index != null ? Math.round(c.cost_index) : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
