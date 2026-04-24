import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMOGRAPHICS, getDemographicBySlug } from "@/lib/demographics";
import { getUrbRankLeaderboard } from "@/lib/urbrank-score";
import { STATES } from "@/lib/states";
import LeaderboardList from "@/components/urbrank/LeaderboardList";

export const revalidate = 86400;

type Params = { demographic: string };

export async function generateStaticParams(): Promise<Params[]> {
  return DEMOGRAPHICS.map((d) => ({ demographic: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { demographic } = await params;
  const d = getDemographicBySlug(demographic);
  if (!d) {
    return { title: "Not found — UrbRank", robots: { index: false, follow: false } };
  }
  const year = new Date().getFullYear();
  return {
    title: `${d.heroTitle} (${year}) — UrbRank`,
    description: `${d.heroSubtitle} Complete ranking with UrbRank Score, affordability, safety, and quality of life data.`,
    alternates: { canonical: `/best-cities/${d.slug}` },
    openGraph: {
      title: `${d.heroTitle} (${year})`,
      description: d.heroSubtitle,
      type: "article",
    },
  };
}

export default async function BestCitiesDemographicPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { demographic } = await params;
  const d = getDemographicBySlug(demographic);
  if (!d) notFound();

  const rows = await getUrbRankLeaderboard(d.profile, 100);
  const top25 = rows.slice(0, 25);

  // Group by state for state-landing links
  const statesWithData = new Set(rows.map((r) => r.state_code));
  const linkableStates = STATES.filter((s) => statesWithData.has(s.code));

  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <section className="mt-4 md:mt-8">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Best Cities · {d.label}
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          {d.heroTitle} <span className="text-[var(--muted)]">({year})</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[var(--muted)] text-lg">
          {d.heroSubtitle}
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
          What matters for {d.singular}
        </h2>
        <p className="mt-3 text-[var(--muted)]">{d.weights}</p>
        <ul className="mt-5 space-y-2">
          {d.whatMatters.map((w, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span className="text-sm">{w}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Top 25 cities for {d.singular}
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Ranked by UrbRank Score with weights tuned for {d.singular}.
        </p>
        <div className="mt-6">
          <LeaderboardList rows={top25} />
        </div>
        {rows.length > 25 && (
          <p className="mt-6 text-sm text-[var(--muted)]">
            Showing the top 25. See the{" "}
            <Link href="/rankings" className="text-[var(--accent)] hover:underline">
              full rankings page
            </Link>{" "}
            for more, or narrow to a specific state below.
          </p>
        )}
      </section>

      {linkableStates.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Best cities for {d.singular} by state
          </h2>
          <p className="mt-2 text-[var(--muted)]">
            State-specific rankings for every US state with scored cities.
          </p>
          <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {linkableStates.map((s) => (
              <li key={s.code}>
                <Link
                  href={`/best-cities/${d.slug}/${s.slug}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--accent)] transition-colors"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">FAQ</h2>
        <div className="mt-6 space-y-5">
          {d.faqs.map((f, i) => (
            <div key={i}>
              <h3 className="font-medium">{f.q}</h3>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          See other rankings
        </h2>
        <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEMOGRAPHICS.filter((o) => o.slug !== d.slug).map((o) => (
            <li key={o.slug}>
              <Link
                href={`/best-cities/${o.slug}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)] transition-colors"
              >
                <div className="font-semibold">Best cities for {o.singular}</div>
                <div className="text-sm text-[var(--muted)] mt-1">{o.weights}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${d.heroTitle} (${year})`,
            itemListElement: top25.map((r, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${r.name}, ${r.state_code}`,
              url: `/should-i-move-to/${r.slug}`,
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: d.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </div>
  );
}
