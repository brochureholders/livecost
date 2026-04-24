import type { Metadata } from "next";
import Link from "next/link";
import { DEMOGRAPHICS } from "@/lib/demographics";
import { getUrbRankLeaderboard } from "@/lib/urbrank-score";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Best US Cities for Every Lifestyle — UrbRank",
  description:
    "The best US cities ranked for families, retirees, remote workers, and young professionals — scored on affordability, safety, climate, walkability, jobs, and more.",
  alternates: { canonical: "/best-cities" },
};

export default async function BestCitiesIndexPage() {
  // Preview top 3 per demographic
  const previews = await Promise.all(
    DEMOGRAPHICS.map(async (d) => {
      const rows = await getUrbRankLeaderboard(d.profile, 3);
      return { d, rows };
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <section className="mt-4 md:mt-8">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Best Cities
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Best US cities<br />for every lifestyle
        </h1>
        <p className="mt-5 max-w-2xl text-[var(--muted)] text-lg">
          The UrbRank Score weights 7 lifestyle dimensions differently for
          families, retirees, remote workers, and young professionals — so the
          rankings reflect what actually matters to you.
        </p>
      </section>

      <section className="mt-16 space-y-10">
        {previews.map(({ d, rows }) => (
          <div
            key={d.slug}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Best cities for {d.singular}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{d.weights}</p>
              </div>
              <Link
                href={`/best-cities/${d.slug}`}
                className="text-sm text-[var(--accent)] hover:underline shrink-0"
              >
                See full ranking →
              </Link>
            </div>
            {rows.length > 0 ? (
              <ol className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                {rows.map((r, i) => (
                  <li key={r.city_id}>
                    <Link
                      href={`/should-i-move-to/${r.slug}`}
                      className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 hover:border-[var(--accent)] transition-colors"
                    >
                      <span className="text-xl font-semibold tabular-nums text-[var(--muted)] w-6 text-center">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {r.name}{" "}
                          <span className="text-[var(--muted)] font-normal">
                            {r.state_code}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-0.5">
                          Score {r.score.toFixed(0)}/100 · {r.grade}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-6 text-sm text-[var(--muted)] italic">
                Scores still computing — check back shortly.
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
