import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMOGRAPHICS, getDemographicBySlug } from "@/lib/demographics";
import { getUrbRankLeaderboard } from "@/lib/urbrank-score";
import { STATES, getStateBySlug, regionPeers } from "@/lib/states";
import LeaderboardList from "@/components/urbrank/LeaderboardList";

export const revalidate = 86400;

type Params = { demographic: string; state: string };

export async function generateStaticParams(): Promise<Params[]> {
  // Full cartesian — 4 demographics × 51 states = 204 combinations.
  // Only generate for states that actually have scored cities; this is a
  // best-effort filter at build time and also enforced in the page.
  const params: Params[] = [];
  for (const d of DEMOGRAPHICS) {
    for (const s of STATES) {
      params.push({ demographic: d.slug, state: s.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { demographic, state } = await params;
  const d = getDemographicBySlug(demographic);
  const s = getStateBySlug(state);
  if (!d || !s) {
    return { title: "Not found — UrbRank", robots: { index: false, follow: false } };
  }
  const year = new Date().getFullYear();
  return {
    title: `Best Cities in ${s.name} for ${d.label} (${year}) — UrbRank`,
    description: `The best cities in ${s.name} for ${d.singular}. UrbRank Score, affordability, safety, climate, and quality of life — ranked.`,
    alternates: { canonical: `/best-cities/${d.slug}/${s.slug}` },
    openGraph: {
      title: `Best Cities in ${s.name} for ${d.label}`,
      description: `UrbRank-ranked ${s.name} cities for ${d.singular}.`,
      type: "article",
    },
  };
}

export default async function BestCitiesStatePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { demographic, state } = await params;
  const d = getDemographicBySlug(demographic);
  const s = getStateBySlug(state);
  if (!d || !s) notFound();

  // Fetch the state-filtered leaderboard (up to 50) and national for cross-link.
  const [stateRows, nationalRows] = await Promise.all([
    getUrbRankLeaderboard(d.profile, 50, s.code),
    getUrbRankLeaderboard(d.profile, 100),
  ]);

  // If the state has no scored cities, show a light placeholder instead of 404.
  const year = new Date().getFullYear();
  const peers = regionPeers(s.code, 6);
  const top = stateRows[0];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">Home</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/best-cities" className="hover:text-[var(--foreground)]">
              Best Cities
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={`/best-cities/${d.slug}`}
              className="hover:text-[var(--foreground)]"
            >
              {d.label}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">{s.name}</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          {s.name} · {d.label}
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Best cities in {s.name}<br />
          for {d.singular} <span className="text-[var(--muted)]">({year})</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[var(--muted)] text-lg">
          {stateRows.length > 0 && top
            ? `${top.name} tops the ${s.name} ranking for ${d.singular} with an UrbRank Score of ${top.score.toFixed(0)}/100. See the full state ranking below.`
            : `${d.heroSubtitle}`}
        </p>
      </section>

      {stateRows.length === 0 ? (
        <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            No scored cities in {s.name} yet
          </h2>
          <p className="mt-3 text-[var(--muted)] max-w-xl mx-auto">
            We don&apos;t have enough public data to score cities in {s.name}{" "}
            on the {d.label.toLowerCase()} profile yet. Check out the{" "}
            <Link href={`/best-cities/${d.slug}`} className="text-[var(--accent)] hover:underline">
              national {d.label.toLowerCase()} ranking
            </Link>{" "}
            or{" "}
            <Link href="/rankings" className="text-[var(--accent)] hover:underline">
              browse all rankings
            </Link>
            .
          </p>
        </section>
      ) : (
        <>
          <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
              What matters for {d.singular}
            </h2>
            <p className="mt-3 text-[var(--muted)]">{d.weights}</p>
          </section>

          <section className="mt-16">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {s.name} ranking
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              {stateRows.length} scored cit{stateRows.length === 1 ? "y" : "ies"} in {s.name}, ranked by UrbRank Score.
            </p>
            <div className="mt-6">
              <LeaderboardList rows={stateRows} rankOverride={(_, i) => i + 1} />
            </div>
          </section>
        </>
      )}

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Top cities for {d.singular} nationally
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          How {s.name}&apos;s best stack up against the rest of the country.
        </p>
        <div className="mt-6">
          <LeaderboardList rows={nationalRows.slice(0, 10)} />
        </div>
        <p className="mt-4 text-sm">
          <Link
            href={`/best-cities/${d.slug}`}
            className="text-[var(--accent)] hover:underline"
          >
            See the full national ranking →
          </Link>
        </p>
      </section>

      {peers.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Nearby states
          </h2>
          <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {peers.map((p) => (
              <li key={p.code}>
                <Link
                  href={`/best-cities/${d.slug}/${p.slug}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--accent)] transition-colors"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stateRows.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `Best cities in ${s.name} for ${d.singular} (${year})`,
              itemListElement: stateRows.slice(0, 25).map((r, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `${r.name}, ${r.state_code}`,
                url: `/should-i-move-to/${r.slug}`,
              })),
            }),
          }}
        />
      )}
    </div>
  );
}
