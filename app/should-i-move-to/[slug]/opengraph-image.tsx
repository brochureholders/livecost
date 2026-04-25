/**
 * Dynamic Open Graph image for each /should-i-move-to/[slug] page.
 *
 * Renders a 1200×630 PNG at request time (cached on Vercel's edge after
 * the first request). Warm-dark variant: charcoal-warm background with
 * a glowing score badge sitting on the right.
 *
 * Auto-linked into og:image / twitter:image meta tags by Next.js.
 */
import { ImageResponse } from "next/og";
import { getCityBySlug } from "@/lib/cities";
import {
  getUrbRankScoresForCity,
  colorForScore,
} from "@/lib/urbrank-score";
import type { DimensionKey } from "@/lib/urbrank-score";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "UrbRank Score for this city";

// Warm-dark palette (variant 12). Matches the site's brand warmth but
// with the dramatic dark-mode-glow aesthetic.
const BG = "#241c14";
const SURFACE = "#2e2419";
const TEXT = "#f5f1e8";
const MUTED = "#a8967c";
const ACCENT = "#ff7b6a";

const SCORE_COLORS: Record<string, { fill: string; ring: string }> = {
  emerald: { fill: "#10b981", ring: "#a7f3d0" },
  amber: { fill: "#f59e0b", ring: "#fde68a" },
  orange: { fill: "#f97316", ring: "#fed7aa" },
  red: { fill: "#ef4444", ring: "#fecaca" },
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

type Params = { slug: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return defaultCard();

  const scores = await getUrbRankScoresForCity(city.id);
  const general = scores.general;

  const score = general?.score ?? null;
  const grade = general?.grade ?? "—";
  const rank = general?.national_rank ?? null;
  const colors = SCORE_COLORS[colorForScore(score ?? 50)];

  const topDims = general
    ? (Object.entries(general.dimension_scores) as [DimensionKey, number][])
        .filter(([, v]) => v != null)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => DIMENSION_LABELS[k])
    : [];

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
        {/* Top bar — UrbRank logo */}
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
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
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 64,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.25em",
                fontWeight: 500,
                marginBottom: 18,
              }}
            >
              Should I Move To
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 108,
                fontWeight: 600,
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
                color: TEXT,
              }}
            >
              {city.name}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 44,
                color: ACCENT,
                fontWeight: 500,
                letterSpacing: "0.02em",
                marginTop: 12,
              }}
            >
              {city.state}
            </div>
          </div>

          {/* Score badge with warm glow */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 320,
              height: 320,
              borderRadius: 320,
              background: SURFACE,
              border: `4px solid ${colors.fill}`,
              boxShadow: `0 0 60px ${colors.fill}88, 0 0 120px ${colors.fill}44`,
              flexShrink: 0,
            }}
          >
            {score != null ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 22,
                    color: MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  UrbRank
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 130,
                    fontWeight: 700,
                    color: colors.fill,
                    lineHeight: 1.0,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {String(Math.round(score))}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 30,
                    color: TEXT,
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  {`Grade ${grade}`}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  color: MUTED,
                  textAlign: "center",
                  padding: "0 32px",
                }}
              >
                Score being computed
              </div>
            )}
          </div>
        </div>

        {/* Bottom strip — top dims + national rank */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: MUTED,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          {topDims.length > 0 && rank != null
            ? `${topDims.join(" · ")} — Ranked #${rank} nationally`
            : topDims.length > 0
              ? topDims.join(" · ")
              : rank != null
                ? `Ranked #${rank} nationally`
                : "UrbRank Score · 7 lifestyle dimensions"}
        </div>
      </div>
    ),
    { ...size },
  );
}

/** Fallback card for missing cities or pre-data state. */
function defaultCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          background: BG,
          color: TEXT,
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 600, display: "flex" }}>
          <span>Urb</span>
          <span style={{ color: ACCENT }}>Rank</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Where Should I Live?
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
            Every US city scored 0-100 across 7 lifestyle dimensions.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
