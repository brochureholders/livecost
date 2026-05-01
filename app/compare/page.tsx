import type { Metadata } from "next";
import Link from "next/link";
import { getCityOptions, getTopCitiesExcluding } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";
import CompareForm from "@/components/compare/CompareForm";

// The /compare?from=X&to=Y  →  /compare/{pair} canonical redirect is
// handled by middleware.ts so it fires at the edge before any ISR
// lookup. This page can stay statically rendered.
export const revalidate = 86400;

export const metadata: Metadata = {
  title:
    "Compare Cost of Living Between US Cities (2026) — Side-by-side Tool | UrbRank",
  description:
    "Pick two US cities and instantly see how they compare on housing, salary, groceries, crime, climate, and more. Free side-by-side comparison tool.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare US Cities Side-by-Side",
    description:
      "Free tool to compare any two US cities on housing, salary, cost of living, and quality of life.",
    type: "website",
  },
};

type SearchParams = Promise<{ from?: string; to?: string }>;

/** Popular pairs surfaced on the landing page. Kept as a manual list so we
 *  can tune for SEO intent rather than picking by population alone.
 *  Slugs MUST be canonical (not vanity aliases) so the link doesn't
 *  trigger a 301 round-trip — see lib/vanity-slugs.ts. */
const POPULAR_PAIRS: { label: string; a: string; b: string }[] = [
  { label: "New York vs San Francisco", a: "new-york-ny", b: "san-francisco-ca" },
  { label: "Austin vs Denver", a: "austin-tx", b: "denver-co" },
  {
    label: "Chicago vs Nashville",
    a: "chicago-il",
    b: "nashville-davidson-metropolitan-government-balance-tn",
  },
  { label: "Seattle vs Portland", a: "seattle-wa", b: "portland-or" },
  { label: "Miami vs Atlanta", a: "miami-fl", b: "atlanta-ga" },
  { label: "Boston vs Philadelphia", a: "boston-ma", b: "philadelphia-pa" },
  { label: "Los Angeles vs San Diego", a: "los-angeles-ca", b: "san-diego-ca" },
  { label: "Dallas vs Houston", a: "dallas-tx", b: "houston-tx" },
  { label: "Phoenix vs Las Vegas", a: "phoenix-az", b: "las-vegas-nv" },
];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  // ?from=&to=&mismatch is already redirected by middleware.ts. If either
  // param arrives here alone (partial submit), pre-fill the form with it.
  const cities = await getCityOptions(500);
  const topCitiesForGrid = await getTopCitiesExcluding([], 12);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">Compare</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          City comparison
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Compare two US cities side-by-side
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Housing, salaries, groceries, crime, climate, walkability — every
          data point we have for two cities, on one page. Pick any two US
          cities to start.
        </p>
      </section>

      <section className="mt-10">
        <CompareForm
          cities={cities}
          initialFrom={sp.from ?? null}
          initialTo={sp.to ?? null}
        />
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Popular comparisons
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          The most-searched pairs on UrbRank.
        </p>
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {POPULAR_PAIRS.map(({ label, a, b }) => {
            const [x, y] = canonicalizePair(a, b);
            return (
              <li key={`${a}-${b}`}>
                <Link
                  href={`/compare/${formatPair(x, y)}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {label} →
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {topCitiesForGrid.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Browse major cities
          </h2>
          <p className="mt-2 text-[var(--muted)]">
            Click a city to view its full profile, then compare from there.
          </p>
          <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {topCitiesForGrid.map((city) => (
              <li key={city.id}>
                <Link
                  href={`/cost-of-living/${city.slug}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {city.name}
                  <span className="ml-1 text-[var(--muted)] font-normal">
                    {city.state_code}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          Need a salary-equivalent number instead?
        </h2>
        <p className="mt-3 text-base text-[var(--muted)]">
          The comparison page shows every stat side-by-side. If you want a
          single-number answer — &quot;how much do I need to earn in City B
          to live like I do in City A?&quot; — use the{" "}
          <Link href="/calculator" className="text-[var(--accent)] hover:underline">
            cost of living calculator
          </Link>{" "}
          instead.
        </p>
      </section>
    </div>
  );
}
