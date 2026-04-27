import Link from "next/link";

export type CityCardData = {
  slug: string;
  name: string;
  state: string;
  index: number;
  medianRent: number;
  population: string;
};

export default function CityCard({ city }: { city: CityCardData }) {
  const vsNational = city.index - 100;
  const diffLabel =
    Math.abs(vsNational) < 0.5
      ? "at national average"
      : vsNational > 0
        ? `${vsNational.toFixed(0)}% above average`
        : `${Math.abs(vsNational).toFixed(0)}% below average`;

  return (
    <Link
      href={`/cost-of-living/${city.slug}`}
      className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)] transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{city.name}</h3>
          <p className="text-sm text-[var(--muted)]">{city.state}</p>
        </div>
        <span className="text-2xl font-semibold tabular-nums text-[var(--accent)]">
          {city.index.toFixed(0)}
        </span>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Median rent</dt>
          <dd className="font-medium tabular-nums">
            ${city.medianRent.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Population</dt>
          <dd className="font-medium tabular-nums">{city.population}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Cost of living index {diffLabel}
      </p>
    </Link>
  );
}
