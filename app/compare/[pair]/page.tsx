import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  getCityBySlug,
  getTopCitySlugs,
  getTopCitiesExcluding,
} from "@/lib/cities";
import {
  buildCategories,
  canonicalizePair,
  formatPair,
  isCanonicalOrder,
  parsePair,
  verdict,
} from "@/lib/comparison";
import { shouldNoIndexComparison } from "@/lib/coverage";
import { getAreaSqMiles, roundAreaFriendly } from "@/lib/area";
import {
  estimatedDrivingMiles,
  flightTimeHours,
  formatFlightTime,
  haversineKm,
  haversineMiles,
  roundDistanceFriendly,
} from "@/lib/distance";
import AdSlot from "@/components/AdSlot";
import AffordabilityBadge from "@/components/profile/AffordabilityBadge";
import DataCompletenessBadge from "@/components/DataCompletenessBadge";
import ComparisonBars from "@/components/compare/ComparisonBars";
import ComparisonCalculator from "@/components/compare/ComparisonCalculator";
import ComparisonSummary from "@/components/compare/ComparisonSummary";
import ComparisonTable from "@/components/compare/ComparisonTable";
import CrossLinks from "@/components/compare/CrossLinks";
import QualitySideBySide from "@/components/compare/QualitySideBySide";
import VerdictBadge from "@/components/compare/VerdictBadge";

export const revalidate = 86400;

type Params = { pair: string };

// Pre-render the top-20 pairs only (190 pages) to keep the build fast.
// Other pairs render on-demand via ISR after first hit; the sitemap still
// surfaces all 19,900 canonical combinations for crawlers.
export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await getTopCitySlugs(20);
  slugs.sort();
  const params: Params[] = [];
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      params.push({ pair: formatPair(slugs[i], slugs[j]) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) {
    return {
      title: "Comparison not found — UrbRank",
      robots: { index: false, follow: false },
    };
  }

  const [slugA, slugB] = parsed;
  const [a, b] = await Promise.all([getCityBySlug(slugA), getCityBySlug(slugB)]);
  if (!a || !b) {
    return {
      title: "Comparison not found — UrbRank",
      robots: { index: false, follow: false },
    };
  }

  const v = verdict(a.costs?.cost_index, b.costs?.cost_index);

  const headline =
    v.cheaper === "a"
      ? `${a.name} is ${v.percent}% cheaper than ${b.name}`
      : v.cheaper === "b"
        ? `${b.name} is ${v.percent}% cheaper than ${a.name}`
        : v.cheaper === "tie"
          ? `${a.name} and ${b.name} cost about the same`
          : `${a.name} and ${b.name} compared`;

  // Distance fragment for the meta description — captures the
  // "how far is X from Y" intent right in the SERP snippet.
  let distanceFragment = "";
  if (
    a.latitude != null &&
    a.longitude != null &&
    b.latitude != null &&
    b.longitude != null
  ) {
    const miles = roundDistanceFriendly(
      haversineMiles(a.latitude, a.longitude, b.latitude, b.longitude),
    );
    distanceFragment = ` The two cities are about ${miles.toLocaleString()} miles apart.`;
  }

  return {
    title: `${a.name}, ${a.state_code} vs ${b.name}, ${b.state_code}: Cost of Living Comparison | UrbRank`,
    description: `${headline}.${distanceFragment} Compare housing, salaries, groceries, and more side by side.`,
    alternates: { canonical: `/compare/${formatPair(a.slug, b.slug)}` },
    ...(shouldNoIndexComparison(a.slug, b.slug)
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: {
      title: `${a.name} vs ${b.name} — Cost of Living`,
      description: headline,
      type: "article",
    },
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) notFound();
  const [rawA, rawB] = parsed;

  // Canonicalize: alphabetical order. Redirect non-canonical URLs so we don't
  // end up with duplicate content for both /a-vs-b and /b-vs-a.
  if (!isCanonicalOrder(rawA, rawB)) {
    const [x, y] = canonicalizePair(rawA, rawB);
    permanentRedirect(`/compare/${formatPair(x, y)}`);
  }

  const [a, b] = await Promise.all([
    getCityBySlug(rawA),
    getCityBySlug(rawB),
  ]);
  if (!a || !b) notFound();

  const categories = buildCategories(a, b);
  const v = verdict(a.costs?.cost_index, b.costs?.cost_index);
  const suggestions = await getTopCitiesExcluding([a.id, b.id], 10);

  // Distance — null when either city lacks coordinates (extremely rare;
  // ~100% of our 1k catalog has lat/lon today). When present, drives the
  // Q&A section, structured data, and the meta description fragment.
  const distance =
    a.latitude != null &&
    a.longitude != null &&
    b.latitude != null &&
    b.longitude != null
      ? (() => {
          const miles = haversineMiles(a.latitude, a.longitude, b.latitude, b.longitude);
          const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
          return {
            milesExact: miles,
            milesRounded: roundDistanceFriendly(miles),
            kmRounded: roundDistanceFriendly(km),
            drivingMiles: roundDistanceFriendly(estimatedDrivingMiles(miles)),
            flightTime: formatFlightTime(flightTimeHours(miles)),
          };
        })()
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${a.name}, ${a.state_code} vs ${b.name}, ${b.state_code} — Cost of Living`,
    about: [
      {
        "@type": "Place",
        name: `${a.name}, ${a.state}`,
        ...(a.latitude != null && a.longitude != null
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: a.latitude,
                longitude: a.longitude,
              },
            }
          : {}),
      },
      {
        "@type": "Place",
        name: `${b.name}, ${b.state}`,
        ...(b.latitude != null && b.longitude != null
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: b.latitude,
                longitude: b.longitude,
              },
            }
          : {}),
      },
    ],
  };

  // Q&A snippet schema — Google uses this to surface the distance answer
  // directly in "how far is X from Y" SERP results.
  const distanceJsonLd = distance && {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: `How far is ${a.name} from ${b.name}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text:
          `${a.name}, ${a.state_code} is about ${distance.milesRounded.toLocaleString()} miles ` +
          `(${distance.kmRounded.toLocaleString()} km) from ${b.name}, ${b.state_code} in a straight line. ` +
          `Driving is roughly ${distance.drivingMiles.toLocaleString()} miles, ` +
          `and a direct flight takes about ${distance.flightTime}.`,
      },
    },
  };

  // Size comparison — captures "is X bigger than Y" queries. We can answer
  // by population (always present), and by land area when the Census
  // Gazetteer covers both cities (~999/1000 today).
  const sizeAreaA = getAreaSqMiles(a.slug);
  const sizeAreaB = getAreaSqMiles(b.slug);
  const size =
    a.population != null && b.population != null
      ? (() => {
          const popDiff = a.population! - b.population!;
          const popBiggerName = popDiff > 0 ? a.name : b.name;
          const popSmallerName = popDiff > 0 ? b.name : a.name;
          const popBiggerPop = Math.max(a.population!, b.population!);
          const popSmallerPop = Math.min(a.population!, b.population!);
          const popMultiplier = popSmallerPop > 0
            ? popBiggerPop / popSmallerPop
            : null;
          const areaCompare =
            sizeAreaA != null && sizeAreaB != null
              ? (() => {
                  const aMore = sizeAreaA > sizeAreaB;
                  return {
                    biggerName: aMore ? a.name : b.name,
                    smallerName: aMore ? b.name : a.name,
                    biggerArea: roundAreaFriendly(Math.max(sizeAreaA, sizeAreaB)),
                    smallerArea: roundAreaFriendly(Math.min(sizeAreaA, sizeAreaB)),
                  };
                })()
              : null;
          return {
            popDiff,
            popBiggerName,
            popSmallerName,
            popBiggerPop,
            popSmallerPop,
            popMultiplier,
            areaA: sizeAreaA != null ? roundAreaFriendly(sizeAreaA) : null,
            areaB: sizeAreaB != null ? roundAreaFriendly(sizeAreaB) : null,
            areaCompare,
          };
        })()
      : null;

  const sizeJsonLd = size && {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: `Is ${a.name} bigger than ${b.name}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text:
          `${size.popBiggerName} has a population of ${size.popBiggerPop.toLocaleString()}, ` +
          `compared to ${size.popSmallerPop.toLocaleString()} in ${size.popSmallerName}` +
          (size.popMultiplier && size.popMultiplier >= 1.1
            ? ` — about ${size.popMultiplier.toFixed(1)}× larger by population`
            : "") +
          (size.areaCompare
            ? `. By land area, ${size.areaCompare.biggerName} covers about ` +
              `${size.areaCompare.biggerArea.toLocaleString()} sq mi vs ` +
              `${size.areaCompare.smallerArea.toLocaleString()} sq mi for ${size.areaCompare.smallerName}.`
            : "."),
      },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Compare", item: "/compare" },
      {
        "@type": "ListItem",
        position: 3,
        name: `${a.name} vs ${b.name}`,
      },
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
      {distanceJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(distanceJsonLd) }}
        />
      )}
      {sizeJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sizeJsonLd) }}
        />
      )}

      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/compare" className="hover:text-[var(--foreground)]">
              Compare
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">
            {a.name} vs {b.name}
          </li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          City comparison
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          {a.name}, {a.state_code} <span className="text-[var(--muted)]">vs</span>{" "}
          {b.name}, {b.state_code}
        </h1>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Link
            href={`/cost-of-living/${a.slug}`}
            className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)] transition-colors"
          >
            <div className="text-sm text-[var(--muted)]">{a.state}</div>
            <div className="text-2xl font-semibold">{a.name}</div>
            <div className="mt-4">
              <AffordabilityBadge index={a.costs?.cost_index ?? null} />
            </div>
          </Link>
          <Link
            href={`/cost-of-living/${b.slug}`}
            className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)] transition-colors"
          >
            <div className="text-sm text-[var(--muted)]">{b.state}</div>
            <div className="text-2xl font-semibold">{b.name}</div>
            <div className="mt-4">
              <AffordabilityBadge index={b.costs?.cost_index ?? null} />
            </div>
          </Link>
        </div>

        <div className="mt-8">
          <VerdictBadge verdict={v} nameA={a.name} nameB={b.name} />
        </div>
      </section>

      {(distance || size) && (
        <section className="mt-12 grid gap-5 md:grid-cols-2">
          {distance && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                How far is {a.name} from {b.name}?
              </h2>
              <p className="mt-3 text-base leading-relaxed">
                {a.name}, {a.state_code} is about{" "}
                <strong className="tabular-nums">
                  {distance.milesRounded.toLocaleString()} miles
                </strong>{" "}
                ({distance.kmRounded.toLocaleString()} km) from {b.name},{" "}
                {b.state_code} in a straight line. By road, the drive is
                roughly{" "}
                <strong className="tabular-nums">
                  {distance.drivingMiles.toLocaleString()} miles
                </strong>
                , and a direct flight takes about{" "}
                <strong>{distance.flightTime}</strong>.
              </p>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Driving distance is a rough estimate (great-circle × 1.25).
                Flight time uses 500 mph block-to-block.
              </p>
            </div>
          )}
          {size && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                Is {a.name} bigger than {b.name}?
              </h2>
              <p className="mt-3 text-base leading-relaxed">
                <strong>{size.popBiggerName}</strong> has a population of{" "}
                <strong className="tabular-nums">
                  {size.popBiggerPop.toLocaleString()}
                </strong>
                , vs{" "}
                <strong className="tabular-nums">
                  {size.popSmallerPop.toLocaleString()}
                </strong>{" "}
                in {size.popSmallerName}
                {size.popMultiplier && size.popMultiplier >= 1.1 ? (
                  <>
                    {" "}— about{" "}
                    <strong className="tabular-nums">
                      {size.popMultiplier.toFixed(1)}×
                    </strong>{" "}
                    larger by population
                  </>
                ) : (
                  <> — about the same size</>
                )}
                .
                {size.areaCompare && (
                  <>
                    {" "}By land area,{" "}
                    <strong>{size.areaCompare.biggerName}</strong> covers
                    about{" "}
                    <strong className="tabular-nums">
                      {size.areaCompare.biggerArea.toLocaleString()} sq mi
                    </strong>{" "}
                    vs{" "}
                    <strong className="tabular-nums">
                      {size.areaCompare.smallerArea.toLocaleString()} sq mi
                    </strong>{" "}
                    for {size.areaCompare.smallerName}.
                  </>
                )}
              </p>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Population from US Census ACS. Land area from the Census
                Gazetteer (city proper, excluding inland water).
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Category breakdown
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Cost indices by category, with the US city average (100) marked.
        </p>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
          <ComparisonBars
            categories={categories}
            nameA={a.name}
            nameB={b.name}
          />
        </div>
      </section>

      <div className="mt-12">
        <DataCompletenessBadge slugs={[a.slug, b.slug]} />
      </div>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Detailed numbers
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Side-by-side costs, salaries, and sub-category indices.
        </p>
        <div className="mt-6">
          <ComparisonTable a={a} b={b} />
        </div>
      </section>

      <section className="mt-16">
        <ComparisonCalculator
          nameA={a.name}
          nameB={b.name}
          indexA={a.costs?.cost_index ?? null}
          indexB={b.costs?.cost_index ?? null}
        />
      </section>

      <AdSlot
        name="compare-mid"
        pathname={`/compare/${formatPair(a.slug, b.slug)}`}
      />

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Quality of life
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Climate, safety, and demographics side by side.
        </p>
        <div className="mt-6">
          <QualitySideBySide a={a} b={b} />
        </div>
      </section>

      <section className="mt-16">
        <ComparisonSummary a={a} b={b} />
      </section>

      <section className="mt-16 grid gap-10 md:grid-cols-2">
        <CrossLinks city={a} suggestions={suggestions} />
        <CrossLinks city={b} suggestions={suggestions} />
      </section>
    </div>
  );
}
