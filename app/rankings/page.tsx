import type { Metadata } from "next";
import Link from "next/link";
import { getNationalRanking, type RankingSort } from "@/lib/cities";

export const revalidate = 86400;

export const metadata: Metadata = {
  title:
    "US Cost of Living Rankings — Cheapest, Priciest, Highest Income | UrbRank",
  description:
    "The cheapest, most expensive, highest-income, and lowest-rent US cities — four national rankings built from Census ACS and BLS data.",
  alternates: { canonical: "/rankings" },
  openGraph: {
    title: "US Cost of Living Rankings",
    description:
      "Cheapest, priciest, highest-income, and lowest-rent US cities — four rankings, one page.",
    type: "website",
  },
};

type RankingCard = {
  href: string;
  label: string;
  headline: string;
  sort: RankingSort;
  eyebrow: string;
};

const CARDS: RankingCard[] = [
  {
    href: "/rankings/cheapest-cities",
    label: "Cheapest cities",
    headline: "Lowest overall cost of living",
    sort: "cheapest",
    eyebrow: "Most affordable",
  },
  {
    href: "/rankings/most-expensive-cities",
    label: "Most expensive cities",
    headline: "Highest overall cost of living",
    sort: "expensive",
    eyebrow: "Priciest",
  },
  {
    href: "/rankings/highest-income-cities",
    label: "Highest-income cities",
    headline: "Top median household incomes",
    sort: "income-high",
    eyebrow: "Wealthiest",
  },
  {
    href: "/rankings/cheapest-rent-cities",
    label: "Cheapest rent",
    headline: "Lowest median monthly rent",
    sort: "rent-low",
    eyebrow: "Cheapest rent",
  },
];

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function teaserValue(sort: RankingSort, city: {
  cost_index: number | null;
  median_rent: number | null;
  median_household_income: number | null;
}): string {
  switch (sort) {
    case "cheapest":
    case "expensive":
      return city.cost_index != null ? city.cost_index.toFixed(0) : "—";
    case "income-high":
      return city.median_household_income != null
        ? CURRENCY.format(city.median_household_income)
        : "—";
    case "rent-low":
      return city.median_rent != null
        ? `${CURRENCY.format(city.median_rent)}/mo`
        : "—";
  }
}

export default async function RankingsHub() {
  // `?sort=...` URL variants are 308-redirected to their SEO-targeted
  // detail pages via next.config.ts redirects (runs at the edge before
  // ISR can serve a cached response), so we don't need to handle them
  // here.

  // Load all four rankings in parallel for the teaser cards.
  const [cheapest, expensive, income, rent] = await Promise.all([
    getNationalRanking("cheapest", 5),
    getNationalRanking("expensive", 5),
    getNationalRanking("income-high", 5),
    getNationalRanking("rent-low", 5),
  ]);
  const topByVariant: Record<RankingSort, typeof cheapest> = {
    cheapest,
    expensive,
    "income-high": income,
    "rent-low": rent,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "US Cost of Living Rankings",
    hasPart: CARDS.map((c) => ({
      "@type": "WebPage",
      name: c.label,
      url: c.href,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">Rankings</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          National rankings
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          US cost of living rankings
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Four rankings of the top US cities — by affordability, income, and
          rent. Built from Census ACS and BLS data for every major metro.
        </p>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        {CARDS.map((card) => {
          const rows = topByVariant[card.sort];
          return (
            <Link
              key={card.sort}
              href={card.href}
              className="group block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)] transition-colors"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
                {card.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {card.label}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {card.headline}
              </p>

              <ol className="mt-5 space-y-2 text-sm">
                {rows.map((city, i) => (
                  <li
                    key={city.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-6 text-right tabular-nums text-[var(--muted)]">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">
                        {city.name}{" "}
                        <span className="text-[var(--muted)] font-normal">
                          {city.state_code}
                        </span>
                      </span>
                    </span>
                    <span className="tabular-nums text-[var(--muted)]">
                      {teaserValue(card.sort, city)}
                    </span>
                  </li>
                ))}
              </ol>

              <span className="mt-5 inline-block text-sm font-medium text-[var(--accent)] group-hover:text-[var(--accent-hover)]">
                See full top 100 →
              </span>
            </Link>
          );
        })}
      </section>

    </div>
  );
}
