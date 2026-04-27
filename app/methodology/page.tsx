import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — How UrbRank Scores and Compares US Cities",
  description:
    "Data sources, scoring formulas, and refresh cadence behind UrbRank's cost-of-living, salary, and quality-of-life comparisons. Census, BLS, BEA, EPA, FBI, NCEI, Walk Score.",
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: "UrbRank Methodology",
    description:
      "How we calculate cost-of-living indices, salary equivalence, and the seven-dimension UrbRank Score.",
    type: "article",
  },
};

const SOURCES: { name: string; agency: string; covers: string; updates: string }[] = [
  {
    name: "American Community Survey (ACS) 5-Year",
    agency: "US Census Bureau",
    covers:
      "Median household income, median rent, median home value, age, education, poverty, commute time",
    updates: "Annually, with a 1–2 year lag",
  },
  {
    name: "Consumer Price Index (CPI-U)",
    agency: "Bureau of Labor Statistics",
    covers:
      "Metro-level price levels for food, housing, transportation, medical care, used to derive sub-category cost indices",
    updates: "Monthly, with retroactive revisions",
  },
  {
    name: "Regional Price Parities (RPP)",
    agency: "Bureau of Economic Analysis",
    covers:
      "Cross-metro price level comparisons; baseline for cost_index calibration",
    updates: "Annually",
  },
  {
    name: "Climate Normals",
    agency: "NOAA NCEI + Open-Meteo",
    covers: "30-year temperature, precipitation, and sunshine averages",
    updates:
      "NCEI publishes new normals every decade; Open-Meteo runs on a daily archive",
  },
  {
    name: "Air Quality System (AQS)",
    agency: "EPA",
    covers: "Annual PM2.5 → AQI conversion using EPA breakpoints",
    updates: "Annually",
  },
  {
    name: "Crime Data Explorer",
    agency: "FBI",
    covers: "Violent and property crime rates per 100,000 residents",
    updates:
      "Annually, when the federal API is operating (currently degraded)",
  },
  {
    name: "Walk Score / Transit Score / Bike Score",
    agency: "Walk Score (private, public methodology)",
    covers: "Daily-errand walkability, transit access, and bikeability",
    updates: "Periodically; we refresh on a quarterly cadence",
  },
];

const DIMENSIONS: { key: string; what: string; how: string }[] = [
  {
    key: "Affordability",
    what: "Inverse percentile of composite cost-of-living index",
    how: "Lower cost_index ranks higher",
  },
  {
    key: "Safety",
    what: "Inverse percentile of crime rate per 100k",
    how: "Lower crime rate ranks higher",
  },
  {
    key: "Climate",
    what: "Composite of summer temp, winter temp, and precipitation",
    how: "Penalizes hot summers, cold winters, and extreme rainfall asymmetrically",
  },
  {
    key: "Walkability",
    what: "Walk Score (0–100)",
    how: "Used directly without further normalization",
  },
  {
    key: "Job Market",
    what: "Composite of unemployment rate and median household income",
    how: "Lower unemployment + higher income ranks higher",
  },
  {
    key: "Environment",
    what: "Inverse percentile of air quality index (PM2.5)",
    how: "Lower AQI ranks higher",
  },
  {
    key: "Education",
    what: "Percentile of share of adults 25+ with a bachelor's degree or higher",
    how: "Higher share ranks higher",
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">Methodology</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Methodology
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          How we calculate every number on this site
        </h1>
        <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed">
          Every value comes from a public, named source. This page covers
          where each dataset comes from, how the seven-dimension UrbRank
          Score is computed, and how often we refresh.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">Data sources</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--background)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">What it provides</th>
                <th className="px-5 py-3 font-medium">Refresh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {SOURCES.map((s) => (
                <tr key={s.name}>
                  <td className="px-5 py-3 align-top">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      {s.agency}
                    </div>
                  </td>
                  <td className="px-5 py-3 align-top text-[var(--muted)]">
                    {s.covers}
                  </td>
                  <td className="px-5 py-3 align-top text-[var(--muted)]">
                    {s.updates}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          The composite cost-of-living index
        </h2>
        <p>
          Each city&apos;s <code>cost_index</code> is a weighted average of
          five sub-indices (housing 33%, transportation 17%, groceries 13%,
          healthcare 8%, utilities 7%, with the remainder absorbed by other
          household costs). The baseline is the BLS metro CPI-U for the
          relevant region; city-level variation comes from BEA RPP and ACS
          rent/home value, applied with category-specific dampening factors
          so a city with 2× the rent doesn&apos;t end up with a
          2× grocery index.
        </p>
        <p>
          100 represents the US city average. A city at 85 is roughly 15%
          cheaper overall; a city at 130 is 30% more expensive.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          The seven scoring dimensions
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Each city is scored 0–100 against every other US city in our
          dataset on each dimension below.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--background)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Dimension</th>
                <th className="px-5 py-3 font-medium">Underlying signal</th>
                <th className="px-5 py-3 font-medium">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {DIMENSIONS.map((d) => (
                <tr key={d.key}>
                  <td className="px-5 py-3 font-medium">{d.key}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">{d.what}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">{d.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Profile-weighted UrbRank Scores
        </h2>
        <p>
          The headline UrbRank Score is a weighted average of the seven
          dimensions. We publish five weighting profiles — general, family,
          retiree, remote worker, young professional — each emphasizing
          different dimensions. Retirees get more weight on healthcare and
          climate; young professionals on jobs and walkability; families on
          schools and safety.
        </p>
        <p>
          Letter grades (A+ through F) map to score percentiles, not absolute
          thresholds, so they&apos;re always relative to the rest of the
          ranked set.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Honest gaps and fallbacks
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--muted)]">
          <li>
            About half of cities are missing FBI crime data right now (the
            federal API has been intermittent). Those pages show a banner
            instead of pretending we have a number.
          </li>
          <li>
            For cities without a local NCEI weather station, climate falls
            back to the state average — coarser than direct station data,
            but still a real geographic signal. The state-fallback path
            currently fires for less than 1% of cities.
          </li>
          <li>
            BEA price parities are published at the metropolitan area
            level. We map cities to MSAs by name and proximity, which is
            close to perfect for primary cities and approximate for outer
            suburbs.
          </li>
          <li>
            Cities with fewer than 5 of the 7 dimensions populated are
            de-prioritized in the sitemap and excluded from search-engine
            indexing — we&apos;d rather under-promise than serve a thin
            page.
          </li>
        </ul>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Refresh cadence
        </h2>
        <p>
          Census ACS, BLS CPI-U, BEA RPP, EPA AQS, and FBI Crime are
          re-ingested annually as new vintages land. Walk Score and AQI run
          on a quarterly cadence. Pages are regenerated daily via Next.js
          ISR, so a corrected upstream value reaches the site within 24
          hours of being re-ingested.
        </p>
        <p>
          The vintage year is shown on every comparison so you can tell at
          a glance how recent the data is.
        </p>
      </section>
    </div>
  );
}
