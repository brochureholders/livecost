import type { Metadata } from "next";
import Link from "next/link";
import CityCard from "@/components/CityCard";
import CompareForm from "@/components/compare/CompareForm";
import { getCityOptions } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";
import { featuredCities, popularComparisons } from "@/data/featured-cities";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const cities = await getCityOptions(500);
  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="py-20 md:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
            Data-driven relocation
          </p>
          <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Compare Cost of Living Across US Cities
          </h1>
          <p className="mt-6 text-lg text-[var(--muted)] max-w-2xl">
            Housing, salaries, groceries, utilities, transportation, healthcare,
            crime, climate, and walkability — side by side for every major
            metro. Real numbers from US Census, BLS, FBI, EPA, and NCEI data.
          </p>
          <div className="mt-10 max-w-2xl">
            <CompareForm cities={cities} />
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-[var(--border)]">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Featured cities
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              The most-searched metros on UrbRank this month.
            </p>
          </div>
          <Link
            href="/rankings"
            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] hidden sm:block"
          >
            View all rankings →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredCities.map((city) => (
            <CityCard key={city.slug} city={city} />
          ))}
        </div>
      </section>

      <section className="py-16 border-t border-[var(--border)]">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Popular comparisons
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          See how the country&apos;s most-compared city pairs stack up.
        </p>
        <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {popularComparisons.map((c) => {
            const [x, y] = canonicalizePair(c.a, c.b);
            return (
              <li key={`${c.a}-${c.b}`}>
                <Link
                  href={`/compare/${formatPair(x, y)}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {c.label} →
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
