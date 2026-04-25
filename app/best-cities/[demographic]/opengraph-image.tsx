/**
 * Dynamic Open Graph image for /best-cities/[demographic] (national).
 *
 * Pulls the demographic's hero copy and the top-3 cities for that
 * profile so the OG card teases the actual ranking. Same warm-dark
 * glow aesthetic as the rest of UrbRank's social cards.
 */
import { ImageResponse } from "next/og";
import { getDemographicBySlug } from "@/lib/demographics";
import { getUrbRankLeaderboard } from "@/lib/urbrank-score";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Best cities ranking";

const BG = "#241c14";
const SURFACE = "#2e2419";
const TEXT = "#f5f1e8";
const MUTED = "#a8967c";
const ACCENT = "#ff7b6a";

type Params = { demographic: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { demographic } = await params;
  const d = getDemographicBySlug(demographic);
  if (!d) return defaultCard();

  const top = await getUrbRankLeaderboard(d.profile, 3);
  const year = new Date().getFullYear();

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
            Best Cities
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
            }}
          >
            {`Best US cities for`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              color: ACCENT,
              marginTop: 8,
            }}
          >
            {`${d.singular} (${year})`}
          </div>
        </div>

        {/* Top 3 cities */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            gap: 16,
            marginTop: 24,
            marginBottom: 12,
          }}
        >
          {top.map((row, i) => (
            <div
              key={row.city_id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flex: 1,
                padding: "20px 24px",
                borderRadius: 16,
                background: SURFACE,
                border: `1px solid ${MUTED}33`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: MUTED,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  fontWeight: 600,
                }}
              >
                {`#${i + 1}`}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 34,
                  fontWeight: 600,
                  color: TEXT,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                {`${row.name}, ${row.state_code}`}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: MUTED,
                  fontWeight: 500,
                }}
              >
                {`Score ${row.score.toFixed(0)} · ${row.grade}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}

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
            Best US Cities
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
            Ranked by what matters to your lifestyle.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
