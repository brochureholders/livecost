import Link from "next/link";
import type { CityProfile, CitySummary } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";

type Props = {
  city: CityProfile;
  suggestions: CitySummary[];
};

export default function CrossLinks({ city, suggestions }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div>
      <h3 className="text-lg font-semibold tracking-tight">
        Compare {city.name} with other cities
      </h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((other) => {
          const [x, y] = canonicalizePair(city.slug, other.slug);
          return (
            <li key={other.id}>
              <Link
                href={`/compare/${formatPair(x, y)}`}
                className="inline-block rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {city.name} vs {other.name}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 text-sm">
        <Link
          href={`/cost-of-living/${city.slug}`}
          className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          View full {city.name} profile →
        </Link>
      </div>
    </div>
  );
}
