import type { Metadata } from "next";
import Link from "next/link";
import { getNationalRanking, type RankingSort } from "@/lib/cities";
import { STATES } from "@/lib/states";
import RankedTable from "@/components/ranking/RankedTable";

export const revalidate = 86400;

type Params = { sort?: string };

const SORTS: Array<{
  value: RankingSort;
  label: string;
  hint: string;
  eyebrow: string;
}> = [
  {
    value: "cheapest",
    label: "Cheapest",
    hint: "Lowest cost-of-living index",
    eyebrow: "Most affordable US cities",
  },
  {
    value: "expensive",
    label: "Most expensive",
    hint: "Highest cost-of-living index",
    eyebrow: "Priciest US cities",
  },
  {
    value: "income-high",
    label: "Highest incomes",
    hint: "Highest median household income",
    eyebrow: "Highest-earning US cities",
  },
  {
    value: "rent-low",
    label: "Cheapest rent",
    hint: "Lowest median rent",
    eyebrow: "Lowest-rent US cities",
  },
];

function resolveSort(raw: string | undefined): (typeof SORTS)[number] {
  const match = SORTS.find((s) => s.value === raw);
  return match ?? SORTS[0];
}

const TITLES: Record<RankingSort, string> = {
  cheapest:
    "Cheapest Cities to Live in the US (2026) — Ranked by Cost of Living | LiveCost",
  expensive:
    "Most Expensive US Cities (2026) — Ranked by Cost of Living | LiveCost",
  "income-high":
    "Highest-Income US Cities (2026) — Ranked by Median Household Income | LiveCost",
  "rent-low":
    "Cheapest Rent in the US (2026) — Cities Ranked by Median Rent | LiveCost",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const sort = resolveSort(sp.sort);
  const cities = await getNationalRanking(sort.value, 100);
  const top = cities[0];

  const description = top
    ? `${top.name}, ${top.state_code} tops the ranking. See all 100 US cities ranked by ${sort.hint.toLowerCase()}.`
    : `Every major US city ranked by ${sort.hint.toLowerCase()}.`;

  // Base ranking always resolves to /rankings; sort variants live behind query
  // strings but we canonicalize to the shortest form to avoid duplicate-content
  // penalties on ?sort=cheapest which equals the default.
  const canonical =
    sort.value === "cheapest" ? "/rankings" : `/rankings?sort=${sort.value}`;

  return {
    title: TITLES[sort.value],
    description,
    alternates: { canonical },
    openGraph: {
      title: TITLES[sort.value],
      description,
      type: "article",
    },
  };
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const sort = resolveSort(sp.sort);
  const cities = await getNationalRanking(sort.value, 100);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `National ranking — ${sort.label}`,
    numberOfItems: cities.length,
    itemListElement: cities.slice(0, 20).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${c.name}, ${c.state_code}`,
      url: `/cost-of-living/${c.slug}`,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Rankings" },
    ],
  };

  const anchorSlug = cities[0]?.slug;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
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
          National ranking
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          {sort.eyebrow}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          {cities.length > 0
            ? `Top ${cities.length} US cities ranked by ${sort.hint.toLowerCase()}, based on the latest Census ACS and BLS data.`
            : `Rankings will appear here once the ingest scripts run.`}
        </p>
      </section>

      <nav
        aria-label="Ranking sort"
        className="mt-8 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
      >
        {SORTS.map((s) => {
          const active = s.value === sort.value;
          return (
            <Link
              key={s.value}
              href={s.value === "cheapest" ? "/rankings" : `/rankings?sort=${s.value}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex flex-col rounded-lg px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              <span className="font-medium">{s.label}</span>
              <span
                className={`text-xs ${active ? "text-white/80" : "text-[var(--muted)]"}`}
              >
                {s.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="mt-6">
        <RankedTable cities={cities} anchorSlug={anchorSlug} showState />
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          By state
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          See how cities stack up inside each state.
        </p>
        <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {STATES.map((state) => (
            <li key={state.code}>
              <Link
                href={`/cheapest-cities/${state.slug}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {state.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
