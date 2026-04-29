import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import CityCard from "@/components/CityCard";
import CompareForm from "@/components/compare/CompareForm";
import { getCityOptions } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";
import { featuredCities, popularComparisons } from "@/data/featured-cities";
import { DEMOGRAPHICS } from "@/lib/demographics";
import { getUrbRankLeaderboard } from "@/lib/urbrank-score";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 86400;

export default async function Home() {
  const [cities, topGeneral, ...byDemo] = await Promise.all([
    getCityOptions(500),
    getUrbRankLeaderboard("general", 6),
    ...DEMOGRAPHICS.map((d) => getUrbRankLeaderboard(d.profile, 3)),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
            Data-driven relocation
          </p>
          <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Where should I live next?
          </h1>
          <p className="mt-6 text-lg text-[var(--muted)] max-w-2xl">
            UrbRank scores every US city 0-100 across seven lifestyle
            dimensions — affordability, safety, climate, jobs, walkability,
            environment, education — and weights them to match what matters
            to you.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/quiz"
              className="inline-flex items-center px-6 py-3 rounded-full bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
            >
              Take the 2-minute quiz
            </Link>
            <Link
              href="/best-cities"
              className="inline-flex items-center px-6 py-3 rounded-full border border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
            >
              Browse best cities
            </Link>
          </div>
        </div>
      </section>

      {/* Top cities by profile */}
      <section className="py-12 border-t border-[var(--border)]">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Top-rated US cities
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              Ranked by UrbRank Score — a weighted average across 7 lifestyle
              dimensions.
            </p>
          </div>
          <Link
            href="/should-i-move-to"
            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] hidden sm:block shrink-0"
          >
            See all →
          </Link>
        </div>
        {topGeneral.length > 0 ? (
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topGeneral.map((r, i) => (
              <li key={r.city_id}>
                <Link
                  href={`/should-i-move-to/${r.slug}`}
                  className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)] transition-colors"
                >
                  <span className="text-2xl font-semibold tabular-nums text-[var(--muted)] w-8 text-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {r.name}
                      <span className="ml-2 text-sm text-[var(--muted)] font-normal">
                        {r.state_code}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      Score {r.score.toFixed(0)}/100 · {r.grade}
                    </div>
                  </div>
                  <div className="text-[var(--accent)] text-xs shrink-0">→</div>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--muted)] italic">
            Rankings update with our data pipeline — check back shortly.
          </p>
        )}
      </section>

      <AdSlot name="homepage-mid" pathname="/" />

      {/* Best-for rankings */}
      <section className="py-16 border-t border-[var(--border)]">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Best cities for every lifestyle
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Different people, different priorities. Same data, different weights.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {DEMOGRAPHICS.map((d, i) => {
            const rows = byDemo[i] ?? [];
            return (
              <div
                key={d.slug}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight">
                    Best for {d.singular}
                  </h3>
                  <Link
                    href={`/best-cities/${d.slug}`}
                    className="text-xs text-[var(--accent)] hover:underline shrink-0"
                  >
                    Full list →
                  </Link>
                </div>
                {rows.length > 0 ? (
                  <ol className="mt-4 space-y-1.5">
                    {rows.map((r, j) => (
                      <li key={r.city_id} className="flex items-center gap-3 text-sm">
                        <span className="text-[var(--muted)] tabular-nums w-4 text-right">
                          {j + 1}.
                        </span>
                        <Link
                          href={`/should-i-move-to/${r.slug}`}
                          className="hover:text-[var(--accent)] transition-colors flex-1"
                        >
                          {r.name},{" "}
                          <span className="text-[var(--muted)]">
                            {r.state_code}
                          </span>
                        </Link>
                        <span className="text-[var(--muted)] text-xs tabular-nums">
                          {r.score.toFixed(0)}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)] italic">
                    Loading…
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Compare form */}
      <section className="py-16 border-t border-[var(--border)]">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Or compare any two cities
        </h2>
        <p className="mt-2 text-[var(--muted)] max-w-2xl">
          Side-by-side cost of living, housing, salaries, and quality of life —
          for every major US metro.
        </p>
        <div className="mt-8 max-w-2xl">
          <CompareForm cities={cities} />
        </div>
      </section>

      {/* Featured cities */}
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

      {/* Popular comparisons */}
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
