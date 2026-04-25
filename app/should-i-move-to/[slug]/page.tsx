import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCityBySlug,
  getOtherCitiesInState,
  getTopCitySlugs,
} from "@/lib/cities";
import {
  DIMENSIONS,
  PROFILE_LABELS,
  getUrbRankScoresForCity,
} from "@/lib/urbrank-score";
import type { DimensionKey } from "@/lib/urbrank-score";
import { generateNarrative } from "@/lib/city-narrative";
import Breadcrumbs from "@/components/profile/Breadcrumbs";
import ScoreDisplay from "@/components/urbrank/ScoreDisplay";

export const revalidate = 86400;

type Params = { slug: string };

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  affordability: "Affordability",
  safety: "Safety",
  climate: "Climate",
  walkability: "Walkability",
  job_market: "Job Market",
  environment: "Environment",
  education: "Education",
};

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await getTopCitySlugs(600);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) {
    return {
      title: "City not found — UrbRank",
      robots: { index: false, follow: false },
    };
  }
  const scores = await getUrbRankScoresForCity(city.id);
  const general = scores.general;
  const headline =
    general != null
      ? `Score ${general.score.toFixed(0)}/100 (${general.grade}).`
      : "See how it scores on cost, safety, climate, jobs, and more.";

  return {
    title: `Should I Move to ${city.name}, ${city.state}? UrbRank Score & Analysis`,
    description: `${city.name}, ${city.state} UrbRank Score. ${headline} Affordability, safety, climate, walkability, jobs — scored against every US city.`,
    alternates: { canonical: `/should-i-move-to/${slug}` },
    openGraph: {
      title: `Should I Move to ${city.name}, ${city.state}?`,
      description: `UrbRank Score: ${headline} Scored across 7 dimensions.`,
      type: "article",
    },
  };
}

export default async function ShouldIMoveToPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) notFound();

  const [scores, otherCities] = await Promise.all([
    getUrbRankScoresForCity(city.id),
    getOtherCitiesInState(city.state_code, city.id, 8),
  ]);

  const general = scores.general;
  const narrative = generateNarrative(city, scores);

  // Build pros/cons from top and bottom dimensions on the general profile.
  const dims = general?.dimension_scores ?? {};
  const ranked = (Object.entries(dims) as [DimensionKey, number][])
    .filter(([, v]) => v != null)
    .sort((a, b) => b[1] - a[1]);
  const pros = ranked.slice(0, 3);
  const cons = ranked.slice(-3).reverse();

  const hasScore = general != null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <Breadcrumbs
        stateName={city.state}
        stateCode={city.state_code}
        cityName={city.name}
      />

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Should I Move To
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          {city.name}, {city.state_code}?
        </h1>
        <p className="mt-4 max-w-3xl text-[var(--muted)] text-lg leading-relaxed">
          {narrative.intro}
        </p>
      </section>

      <section className="mt-12">
        {hasScore ? (
          <ScoreDisplay scores={scores} />
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-[var(--muted)]">
              UrbRank Score data is not yet available for {city.name}.
            </p>
            <Link
              href={`/cost-of-living/${city.slug}`}
              className="mt-4 inline-block text-[var(--accent)] hover:underline"
            >
              View the full cost of living profile →
            </Link>
          </div>
        )}
      </section>

      {hasScore && (pros.length > 0 || cons.length > 0) && (
        <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <h2 className="text-xl font-semibold tracking-tight text-emerald-500">
              What {city.name} does well
            </h2>
            <ul className="mt-4 space-y-3">
              {pros.map(([k, v]) => (
                <li key={k} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <div>
                    <div className="font-medium">{DIMENSION_LABELS[k]}</div>
                    <div className="text-sm text-[var(--muted)]">
                      {v}/100 — ranks in the{" "}
                      {v >= 80
                        ? "top 20%"
                        : v >= 60
                          ? "top 40%"
                          : "upper half"}{" "}
                      nationally.
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-6">
            <h2 className="text-xl font-semibold tracking-tight text-orange-500">
              Where {city.name} falls short
            </h2>
            <ul className="mt-4 space-y-3">
              {cons.map(([k, v]) => (
                <li key={k} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-orange-500" />
                  <div>
                    <div className="font-medium">{DIMENSION_LABELS[k]}</div>
                    <div className="text-sm text-[var(--muted)]">
                      {v}/100 — weaker than most US cities on this dimension.
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Narrative sections — give Google ~600 words of unique copy per
          city. Source: lib/city-narrative.ts (deterministic from data). */}
      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Cost of living in {city.name}
          </h2>
          <p className="mt-3 text-[var(--muted)] leading-relaxed">
            {narrative.costSnapshot}
          </p>
          <Link
            href={`/cost-of-living/${city.slug}`}
            className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
          >
            Full cost-of-living breakdown →
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Climate &amp; lifestyle
          </h2>
          <p className="mt-3 text-[var(--muted)] leading-relaxed">
            {narrative.climateAndLifestyle}
          </p>
        </div>
      </section>

      {narrative.verdictByProfile.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Is {city.name} right for you?
          </h2>
          <p className="mt-2 text-[var(--muted)]">
            Verdict by lifestyle profile — same data, different priorities.
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {narrative.verdictByProfile.map((v) => (
              <div
                key={v.profile}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    {PROFILE_LABELS[v.profile]}
                  </h3>
                  <Link
                    href={`/best-cities/${v.profile === "family" ? "families" : v.profile === "retiree" ? "retirees" : v.profile === "remote_worker" ? "remote-workers" : "young-professionals"}`}
                    className="text-xs text-[var(--accent)] hover:underline shrink-0"
                  >
                    See ranking →
                  </Link>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                  {v.verdict}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* City-specific FAQ — answers the long-tail questions Google
          actually surfaces (climate, walkability, expense, schools). */}
      {narrative.faqs.length > 0 && (
        <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Frequently asked questions about {city.name}
          </h2>
          <div className="mt-6 space-y-5">
            {narrative.faqs.map((f, i) => (
              <div key={i}>
                <h3 className="font-medium">{f.q}</h3>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          How UrbRank Score works
        </h2>
        <p className="mt-3 text-[var(--muted)]">
          Every US city is scored 0-100 on seven dimensions using public data
          from the US Census Bureau, Bureau of Labor Statistics, FBI Crime Data
          Explorer, EPA Air Quality System, NOAA NCEI, and Walk Score. Each
          dimension is a percentile rank against every other city — so a score
          of 80 means the city is in the top 20% nationally on that dimension.
        </p>
        <p className="mt-3 text-[var(--muted)]">
          The overall score is a weighted average. Five lifestyle profiles —
          general, families, retirees, remote workers, young professionals —
          weight the dimensions differently to reflect what each cares about.
          Families get more weight on safety and schools; young professionals
          get more weight on jobs and walkability; retirees get more weight on
          climate.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {DIMENSIONS.map((d) => (
            <span
              key={d}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs border border-[var(--border)] text-[var(--muted)]"
            >
              {DIMENSION_LABELS[d]}
            </span>
          ))}
        </div>
      </section>

      {otherCities.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Other cities in {city.state}
          </h2>
          <p className="mt-2 text-[var(--muted)]">
            Compare {city.name} with other {city.state} cities scored on UrbRank.
          </p>
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {otherCities.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/should-i-move-to/${c.slug}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="font-medium">
                    {c.name}{" "}
                    <span className="text-[var(--muted)] font-normal">
                      {c.state_code}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    See UrbRank Score →
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          Not sure which city fits you best?
        </h2>
        <p className="mt-3 text-[var(--muted)] max-w-2xl">
          Take the 2-minute UrbRank quiz to get a personalized ranking of US
          cities based on your priorities — cost, climate, commute, jobs, and
          more.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/quiz"
            className="inline-flex items-center px-5 py-3 rounded-full bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Take the quiz
          </Link>
          <Link
            href={`/cost-of-living/${city.slug}`}
            className="inline-flex items-center px-5 py-3 rounded-full border border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
          >
            Full cost of living profile
          </Link>
        </div>
      </section>

      {/* Structured data — Article + FAQ */}
      {hasScore && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: `Should I Move to ${city.name}, ${city.state}?`,
              datePublished: "2026-01-01",
              dateModified: new Date().toISOString().slice(0, 10),
              author: { "@type": "Organization", name: "UrbRank" },
              publisher: { "@type": "Organization", name: "UrbRank" },
              description: `UrbRank Score ${general!.score.toFixed(0)}/100 (${general!.grade}). Analysis of ${city.name} across 7 lifestyle dimensions.`,
            }),
          }}
        />
      )}
      {/* FAQPage schema mirrors the visible FAQ section so Google can
          surface rich-result snippets in SERPs. */}
      {narrative.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: narrative.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
      )}
    </div>
  );
}
