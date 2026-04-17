import type { Metadata } from "next";
import Link from "next/link";
import CityCard from "@/components/CityCard";
import { featuredCities, popularComparisons } from "@/data/featured-cities";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
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
            Housing, groceries, transportation, taxes, and more — side by side
            for every major metro. Real numbers, updated monthly from Census
            and BLS data.
          </p>
          <form
            action="/compare"
            className="mt-10 flex flex-col sm:flex-row gap-3 max-w-2xl"
          >
            <label htmlFor="city-a" className="sr-only">
              From city
            </label>
            <input
              id="city-a"
              name="from"
              type="text"
              placeholder="Enter a city, e.g. Austin, TX"
              className="flex-1 h-12 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <label htmlFor="city-b" className="sr-only">
              To city
            </label>
            <input
              id="city-b"
              name="to"
              type="text"
              placeholder="Compare to, e.g. Denver, CO"
              className="flex-1 h-12 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Compare
            </button>
          </form>
        </div>
      </section>

      <section className="py-12 border-t border-[var(--border)]">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Featured cities
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              The most-searched metros on LiveCost this month.
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
          {popularComparisons.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/compare/${c.slug}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {c.label} →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
