import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCitiesByState } from "@/lib/cities";
import { STATES, getStateBySlug, regionPeers } from "@/lib/states";
import RankedTable from "@/components/ranking/RankedTable";

export const revalidate = 86400;

type Params = { state: string };

export async function generateStaticParams(): Promise<Params[]> {
  return STATES.map((s) => ({ state: s.slug }));
}

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function sortByIndex<T extends { cost_index: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.cost_index == null && b.cost_index == null) return 0;
    if (a.cost_index == null) return 1;
    if (b.cost_index == null) return -1;
    return a.cost_index - b.cost_index;
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { state: slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) return { title: "State not found — UrbRank" };

  const cities = await getCitiesByState(state.code);
  const ranked = sortByIndex(cities).filter((c) => c.cost_index != null);
  const cheapest = ranked[0];

  const description = cheapest
    ? `The cheapest city in ${state.name} is ${cheapest.name} with a cost index of ${cheapest.cost_index?.toFixed(0)}. See all ${cities.length} cities ranked.`
    : `Ranked cost of living for every city in ${state.name}. Compare housing, salaries, and affordability.`;

  return {
    title: `Cheapest Cities to Live in ${state.name} — Ranked by Cost | UrbRank`,
    description,
    alternates: { canonical: `/cheapest-cities/${slug}` },
    openGraph: {
      title: `Cheapest Cities in ${state.name}`,
      description,
      type: "article",
    },
  };
}

export default async function CheapestCitiesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { state: slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) notFound();

  const cities = await getCitiesByState(state.code);
  const ranked = sortByIndex(cities);
  const withData = ranked.filter((c) => c.cost_index != null);
  const cheapest = withData[0];
  const priciest = withData[withData.length - 1];
  const mostExpensiveTop5 = [...withData].reverse().slice(0, 5);

  const peers = regionPeers(state.code, 5);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Cheapest Cities in ${state.name}`,
    numberOfItems: withData.length,
    itemListElement: withData.slice(0, 20).map((c, i) => ({
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
      {
        "@type": "ListItem",
        position: 2,
        name: "Cheapest Cities",
        item: "/cheapest-cities",
      },
      { "@type": "ListItem", position: 3, name: state.name },
    ],
  };

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
          <li>
            <Link
              href="/cheapest-cities"
              className="hover:text-[var(--foreground)]"
            >
              Cheapest Cities
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">{state.name}</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          {state.region} ranking
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Cheapest cities in {state.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          {cities.length > 0
            ? `${withData.length} ${state.name} ${
                withData.length === 1 ? "city" : "cities"
              } ranked by cost of living, cheapest first.`
            : `Rankings for ${state.name} will appear here once the ingest scripts run.`}
        </p>

        {withData.length > 0 && (
          <dl className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <dt className="text-xs uppercase tracking-widest text-[var(--muted)]">
                Cities ranked
              </dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {withData.length}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <dt className="text-xs uppercase tracking-widest text-[var(--muted)]">
                Cheapest
              </dt>
              <dd className="mt-2 text-xl font-semibold">
                {cheapest?.name ?? "—"}
              </dd>
              <p className="mt-1 text-xs text-[var(--muted)] tabular-nums">
                Index {cheapest?.cost_index?.toFixed(0) ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <dt className="text-xs uppercase tracking-widest text-[var(--muted)]">
                Most expensive
              </dt>
              <dd className="mt-2 text-xl font-semibold">
                {priciest?.name ?? "—"}
              </dd>
              <p className="mt-1 text-xs text-[var(--muted)] tabular-nums">
                Index {priciest?.cost_index?.toFixed(0) ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <dt className="text-xs uppercase tracking-widest text-[var(--muted)]">
                Index range
              </dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {cheapest?.cost_index?.toFixed(0) ?? "—"}–
                {priciest?.cost_index?.toFixed(0) ?? "—"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          All {state.name} cities, ranked
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Sorted by cost-of-living index — lowest (most affordable) first.
        </p>
        <div className="mt-6">
          <RankedTable cities={ranked} anchorSlug={cheapest?.slug} />
        </div>
      </section>

      {withData.length >= 2 && cheapest && priciest && (
        <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">
            What the numbers say
          </h2>
          <p className="mt-3 text-base leading-relaxed">
            Across {state.name}, {cheapest.name} is the most affordable city we
            track (cost index{" "}
            <span className="tabular-nums">
              {cheapest.cost_index?.toFixed(0)}
            </span>
            {cheapest.median_rent != null && (
              <>
                , with median rent around{" "}
                <span className="tabular-nums">
                  {CURRENCY.format(cheapest.median_rent)}/mo
                </span>
              </>
            )}
            ), while {priciest.name} sits at the top of the range with an index
            of{" "}
            <span className="tabular-nums">
              {priciest.cost_index?.toFixed(0)}
            </span>
            {cheapest.cost_index != null &&
              priciest.cost_index != null &&
              priciest.cost_index > cheapest.cost_index && (
                <>
                  —roughly{" "}
                  <span className="tabular-nums">
                    {(
                      ((priciest.cost_index - cheapest.cost_index) /
                        cheapest.cost_index) *
                      100
                    ).toFixed(0)}
                    %
                  </span>{" "}
                  pricier than {cheapest.name}
                </>
              )}
            . Use the table above to compare any {state.name} city directly
            against {cheapest.name}.
          </p>
        </section>
      )}

      {mostExpensiveTop5.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Most expensive cities in {state.name}
          </h2>
          <p className="mt-2 text-[var(--muted)]">
            The other end of the ranking — priciest first.
          </p>
          <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mostExpensiveTop5.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/cost-of-living/${c.slug}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)] transition-colors"
                >
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[var(--muted)]">
                      #{i + 1} priciest
                    </div>
                    <div className="mt-1 font-medium">{c.name}</div>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-[var(--accent)]">
                    {c.cost_index != null ? c.cost_index.toFixed(0) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Nearby in the {state.region}
          </h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {peers.map((peer) => (
              <li key={peer.code}>
                <Link
                  href={`/cheapest-cities/${peer.slug}`}
                  className="inline-block rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  Cheapest in {peer.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Broader context
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                href="/rankings"
                className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                National cost-of-living ranking →
              </Link>
            </li>
            {cheapest && (
              <li>
                <Link
                  href={`/cost-of-living/${cheapest.slug}`}
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  Full profile: {cheapest.name}, {state.code} →
                </Link>
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
