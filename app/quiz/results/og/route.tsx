/**
 * Personalized Open Graph image for /quiz/results.
 *
 * Reads the same weight searchParams the results page consumes, applies
 * them to all 1000 city dimension scores, and renders the user's #1
 * match in the warm-dark glow theme. Lets users share their personal
 * "your best US city is X" result.
 *
 * Why a route handler instead of opengraph-image.tsx? OG image files
 * only receive route segment params — they don't get searchParams. We
 * need searchParams to read the weight vector, so this is a regular
 * route handler that returns ImageResponse.
 *
 * Wired into the page via generateMetadata().openGraph.images, with the
 * same query string forwarded so the image matches the user's results.
 */
import { ImageResponse } from "next/og";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { DIMENSIONS } from "@/lib/urbrank-score";
import type { DimensionKey } from "@/lib/urbrank-score";
import { decodeWeights } from "@/lib/quiz";

export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

const BG = "#241c14";
const SURFACE = "#2e2419";
const TEXT = "#f5f1e8";
const MUTED = "#a8967c";
const ACCENT = "#ff7b6a";

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  affordability: "Affordability",
  safety: "Safety",
  climate: "Climate",
  walkability: "Walkability",
  job_market: "Jobs",
  environment: "Environment",
  education: "Education",
};

type CityRow = {
  city_id: string;
  score: number;
  dimension_scores: Partial<Record<DimensionKey, number>>;
  cities:
    | { name: string; slug: string; state: string; state_code: string }
    | Array<{ name: string; slug: string; state: string; state_code: string }>
    | null;
};

async function topMatch(
  weights: Record<DimensionKey, number>,
): Promise<{ name: string; state_code: string; score: number; topDim: string | null } | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from("urbrank_scores")
    .select(
      `city_id, score, dimension_scores,
       cities!inner ( name, slug, state, state_code )`,
    )
    .eq("profile", "general")
    .limit(1500);
  if (!data) return null;

  let bestName = "";
  let bestStateCode = "";
  let bestScore = -1;
  let bestTopDim: DimensionKey | null = null;

  for (const r of data as unknown as CityRow[]) {
    const c = Array.isArray(r.cities) ? r.cities[0] : r.cities;
    if (!c) continue;
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
    const score = wsum / total;
    if (score > bestScore) {
      bestScore = score;
      bestName = c.name;
      bestStateCode = c.state_code;
      // top dim within this city, restricted to user's most-weighted ones
      const topUserDims = (Object.entries(weights) as [DimensionKey, number][])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d]) => d);
      let bestDimVal = -1;
      bestTopDim = null;
      for (const d of topUserDims) {
        const v = r.dimension_scores[d] ?? 0;
        if (v > bestDimVal) {
          bestDimVal = v;
          bestTopDim = d;
        }
      }
    }
  }
  if (bestScore < 0) return null;
  return {
    name: bestName,
    state_code: bestStateCode,
    score: bestScore,
    topDim: bestTopDim ? DIMENSION_LABELS[bestTopDim] : null,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const weights = decodeWeights(url.searchParams);

  // Find the user's three most-weighted dimensions for the eyebrow line
  const topPriorities = (Object.entries(weights) as [DimensionKey, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => DIMENSION_LABELS[d]);

  const top = await topMatch(weights);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: TEXT,
          fontFamily: "sans-serif",
          padding: "60px 72px",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            <span>Urb</span>
            <span style={{ color: ACCENT }}>Rank</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.25em",
              fontWeight: 500,
            }}
          >
            Quiz Results
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 36,
              color: MUTED,
              fontWeight: 500,
              letterSpacing: "0.05em",
              marginBottom: 14,
            }}
          >
            Your top US city is
          </div>
          {top ? (
            <>
              <div
                style={{
                  display: "flex",
                  fontSize: 132,
                  fontWeight: 700,
                  lineHeight: 1.0,
                  letterSpacing: "-0.04em",
                  color: ACCENT,
                }}
              >
                {`${top.name}, ${top.state_code}`}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 28,
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 22px",
                    borderRadius: 999,
                    background: SURFACE,
                    border: `1px solid ${MUTED}33`,
                    fontSize: 24,
                    color: TEXT,
                    fontWeight: 600,
                  }}
                >
                  {`Match score ${Math.round(top.score)}/100`}
                </div>
                {top.topDim && (
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      color: MUTED,
                      fontWeight: 500,
                    }}
                  >
                    {`Especially strong on ${top.topDim.toLowerCase()}`}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                fontSize: 64,
                fontWeight: 600,
                color: TEXT,
                letterSpacing: "-0.02em",
              }}
            >
              Take the quiz to find out
            </div>
          )}
        </div>

        {/* Footer — user's top priorities */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: MUTED,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.03em",
          }}
        >
          {`Your priorities: ${topPriorities.join(" · ")}`}
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
