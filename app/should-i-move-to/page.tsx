import type { Metadata } from "next";
import Link from "next/link";
import { getTopCitySlugs, getCitiesByState } from "@/lib/cities";
import { PROFILES, PROFILE_LABELS } from "@/lib/urbrank-score";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Should I Move to This City? UrbRank Score for Every US City",
  description:
    "UrbRank scores every major US city on affordability, safety, climate, walkability, jobs, environment, and education — weighted by your lifestyle profile. Find where to move next.",
  alternates: { canonical: "/should-i-move-to" },
  openGraph: {
    title: "Should I Move Here? UrbRank Score for Every US City",
    description:
      "Compare US cities on 7 lifestyle dimensions with UrbRank Score.",
    type: "website",
  },
};

export default async function ShouldIMoveIndexPage() {
  const slugs = await getTopCitySlugs(300);

  // Friendly display: group first 60 into a showcase grid, then link "full list"
  const featured = slugs.slice(0, 60);

  // Grab a few state-level samples for internal-link density
  const sampleStates = ["CA", "TX", "FL", "NY", "CO", "WA"] as const;
  const stateSamples = await Promise.all(
    sampleStates.map((sc) => getCitiesByState(sc, 6).then((cs) => ({ sc, cs }))),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <section className="mt-4 md:mt-8">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          UrbRank Score
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Should I move here?
        </h1>
        <p className="mt-5 max-w-2xl text-[var(--muted)] text-lg">
          Every US city scored 0-100 on seven lifestyle dimensions and weighted
          by what matters to you — whether you&apos;re a family, a retiree, a
          remote worker, or a young professional. Pick a city to see its
          UrbRank Score.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/quiz"
            className="inline-flex items-center px-5 py-3 rounded-full bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Take the 2-minute quiz
          </Link>
          <Link
            href="/rankings"
            className="inline-flex items-center px-5 py-3 rounded-full border border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
          >
            Browse rankings
          </Link>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Scored across 5 lifestyle profiles
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Same data, different weights. Each profile emphasizes what that
          person typically cares about most.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROFILES.map((p) => (
            <div
              key={p}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="font-semibold">{PROFILE_LABELS[p]}</div>
              <div className="text-sm text-[var(--muted)] mt-1">
                {p === "general" && "Balanced weighting across all 6 core dimensions."}
                {p === "family" && "Safety + affordability + schools + climate."}
                {p === "retiree" && "Climate + affordability + safety + walkability."}
                {p === "remote_worker" && "Affordability + climate + walkability + environment."}
                {p === "young_professional" && "Jobs + walkability + affordability + climate."}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Featured cities
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          See the UrbRank Score for a sample of the 300 largest US cities.
        </p>
        <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {featured.map((slug) => {
            const pretty = slug
              .replace(/-[a-z]{2}$/, "")
              .split("-")
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(" ");
            const state = slug.slice(-2).toUpperCase();
            return (
              <li key={slug}>
                <Link
                  href={`/should-i-move-to/${slug}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--accent)] transition-colors"
                >
                  {pretty}{" "}
                  <span className="text-[var(--muted)]">{state}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Browse by state
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stateSamples.map(({ sc, cs }) => {
            if (cs.length === 0) return null;
            const stateName = cs[0].state;
            return (
              <div
                key={sc}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <div className="font-semibold">{stateName}</div>
                <ul className="mt-3 space-y-1.5">
                  {cs.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/should-i-move-to/${c.slug}`}
                        className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
                      >
                        {c.name}, {c.state_code} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
