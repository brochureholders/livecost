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
import AffordabilityBadge from "@/components/profile/AffordabilityBadge";
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
  const year = a.costs?.year ?? b.costs?.year ?? new Date().getFullYear();

  const headline =
    v.cheaper === "a"
      ? `${a.name} is ${v.percent}% cheaper than ${b.name}`
      : v.cheaper === "b"
        ? `${b.name} is ${v.percent}% cheaper than ${a.name}`
        : v.cheaper === "tie"
          ? `${a.name} and ${b.name} cost about the same`
          : `${a.name} and ${b.name} compared`;

  return {
    title: `${a.name}, ${a.state_code} vs ${b.name}, ${b.state_code}: Cost of Living Comparison (${year}) | UrbRank`,
    description: `${headline}. Compare housing, salaries, groceries, and more side by side.`,
    alternates: { canonical: `/compare/${formatPair(a.slug, b.slug)}` },
    openGraph: {
      title: `${a.name} vs ${b.name} — Cost of Living ${year}`,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${a.name}, ${a.state_code} vs ${b.name}, ${b.state_code} — Cost of Living`,
    about: [
      { "@type": "Place", name: `${a.name}, ${a.state}` },
      { "@type": "Place", name: `${b.name}, ${b.state}` },
    ],
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
