import type { Metadata } from "next";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { DIMENSIONS, colorForScore, gradeFor } from "@/lib/urbrank-score";
import type { DimensionKey } from "@/lib/urbrank-score";
import { decodeWeights } from "@/lib/quiz";
import ResultCard from "./ResultCard";

/** Forward the same searchParams the page consumes to the OG image
 *  route handler so it can render a personalized share card. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qp.set(k, v);
  }
  const ogUrl = `/quiz/results/og${qp.toString() ? `?${qp.toString()}` : ""}`;
  return {
    title: "Your UrbRank Results — Best Cities For You",
    description:
      "Personalized ranking of US cities based on your quiz answers, powered by the UrbRank Score.",
    alternates: { canonical: "/quiz/results" },
    robots: { index: false, follow: true },
    openGraph: {
      title: "Your UrbRank Results — Best Cities For You",
      description:
        "Personalized ranking of US cities based on your quiz answers.",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      images: [ogUrl],
    },
  };
}

type CityRow = {
  city_id: string;
  score: number;
  dimension_scores: Partial<Record<DimensionKey, number>>;
  cities:
    | { name: string; slug: string; state: string; state_code: string }
    | Array<{ name: string; slug: string; state: string; state_code: string }>
    | null;
};

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  affordability: "Affordability",
  safety: "Safety",
  climate: "Climate",
  walkability: "Walkability",
  job_market: "Job Market",
  environment: "Environment",
  education: "Education",
};

type Ranked = {
  city_id: string;
  name: string;
  slug: string;
  state: string;
  state_code: string;
  score: number;
  dimension_scores: Partial<Record<DimensionKey, number>>;
};

async function loadRanked(
  weights: Record<DimensionKey, number>,
): Promise<Ranked[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("urbrank_scores")
    .select(
      `city_id, score, dimension_scores,
       cities ( name, slug, state, state_code )`,
    )
    .eq("profile", "general")
    .limit(1000);
  if (error || !data) return [];

  const ranked: Ranked[] = [];
  for (const r of data as unknown as CityRow[]) {
    const c = Array.isArray(r.cities) ? r.cities[0] : r.cities;
    if (!c) continue;
    // Apply custom weights to the city's dimension scores.
    let wsum = 0;
    let total = 0;
    for (const d of DIMENSIONS) {
      const v = r.dimension_scores[d];
      const w = weights[d];
      if (v == null || w == null) continue;
      wsum += v * w;
      total += w;
    }
    if (total === 0) continue;
    ranked.push({
      city_id: r.city_id,
      name: c.name,
      slug: c.slug,
      state: c.state,
      state_code: c.state_code,
      score: Number((wsum / total).toFixed(2)),
      dimension_scores: r.dimension_scores,
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

const COLORS: Record<string, { text: string; bar: string }> = {
  emerald: { text: "text-emerald-500", bar: "bg-emerald-500" },
  amber: { text: "text-amber-500", bar: "bg-amber-500" },
  orange: { text: "text-orange-500", bar: "bg-orange-500" },
  red: { text: "text-red-500", bar: "bg-red-500" },
};

export default async function QuizResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
  }
  const weights = decodeWeights(params);
  const ranked = await loadRanked(weights);
  const top10 = ranked.slice(0, 10);

  // Top 3 weights for the "your priorities" summary
  const weightEntries = (Object.entries(weights) as [DimensionKey, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 md:py-12">
      <section className="mt-4 md:mt-8">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Your UrbRank Results
        </p>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          Your top US cities
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--muted)] text-lg">
          Based on your answers, these are the US cities that best match your
          priorities — ranked by a custom-weighted UrbRank Score.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-[var(--muted)]">
          Your priorities
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {weightEntries.map(([d, w]) => (
            <span
              key={d}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
            >
              {DIMENSION_LABELS[d]} · {Math.round(w)}%
            </span>
          ))}
        </div>
      </section>

      {top10.length === 0 ? (
        <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[var(--muted)]">
            UrbRank data is still loading. Try refreshing, or{" "}
            <Link href="/quiz" className="text-[var(--accent)] hover:underline">
              retake the quiz
            </Link>
            .
          </p>
        </section>
      ) : (
        <section className="mt-10">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Top 10 matches
          </h2>
          <ol className="mt-6 space-y-3">
            {top10.map((r, i) => {
              const colors = COLORS[colorForScore(r.score)];
              const grade = gradeFor(r.score);
              const topDim = weightEntries
                .map(([d]) => ({ d, v: r.dimension_scores[d] ?? 0 }))
                .sort((a, b) => b.v - a.v)[0];
              return (
                <li key={r.city_id}>
                  <ResultCard
                    rank={i + 1}
                    slug={r.slug}
                    name={r.name}
                    stateCode={r.state_code}
                    score={r.score}
                    grade={grade}
                    topDimLabel={topDim ? DIMENSION_LABELS[topDim.d] : null}
                    topDimValue={topDim ? topDim.v : null}
                    barColorClass={colors.bar}
                    textColorClass={colors.text}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          What do these scores mean?
        </h2>
        <p className="mt-3 text-[var(--muted)] text-sm">
          Each city is scored 0-100 on seven dimensions — affordability, safety,
          climate, walkability, jobs, environment, education — using public data
          from Census, BLS, FBI, EPA, NOAA, and Walk Score. Your quiz answers
          determine how much each dimension counts toward the final score. Your
          top-weighted dimensions are shown above.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/quiz"
            className="inline-flex items-center px-5 py-3 rounded-full border border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
          >
            Retake the quiz
          </Link>
          <Link
            href="/best-cities"
            className="inline-flex items-center px-5 py-3 rounded-full bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Browse all rankings
          </Link>
        </div>
      </section>
    </div>
  );
}
