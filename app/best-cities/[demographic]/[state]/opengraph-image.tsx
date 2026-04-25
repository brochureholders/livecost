/**
 * Dynamic Open Graph image for /best-cities/[demographic]/[state].
 * State-specific ranking — shows demographic + state name + top city.
 */
import { ImageResponse } from "next/og";
import { getDemographicBySlug } from "@/lib/demographics";
import { getStateBySlug } from "@/lib/states";
import { getUrbRankLeaderboard } from "@/lib/urbrank-score";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Best cities by state ranking";

const BG = "#241c14";
const SURFACE = "#2e2419";
const TEXT = "#f5f1e8";
const MUTED = "#a8967c";
const ACCENT = "#ff7b6a";

type Params = { demographic: string; state: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { demographic, state } = await params;
  const d = getDemographicBySlug(demographic);
  const s = getStateBySlug(state);
  if (!d || !s) return defaultCard();
  const rows = await getUrbRankLeaderboard(d.profile, 3, s.code);
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
            {`Best Cities · ${s.name}`}
          </div>
        </div>
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
              marginBottom: 10,
            }}
          >
            {`Best ${s.name} cities for`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 124,
              fontWeight: 700,
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              color: ACCENT,
            }}
          >
            {d.singular}
          </div>
          {rows.length > 0 && (
            <div
              style={{
                display: "flex",
                marginTop: 32,
                padding: "20px 28px",
                borderRadius: 16,
                background: SURFACE,
                border: `1px solid ${MUTED}33`,
                alignItems: "center",
                gap: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  color: MUTED,
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                }}
              >
                #1 in state
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 38,
                  color: TEXT,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                }}
              >
                {`${rows[0].name}, ${rows[0].state_code}`}
              </div>
              <div
                style={{
                  display: "flex",
                  marginLeft: "auto",
                  fontSize: 24,
                  color: MUTED,
                  fontWeight: 500,
                }}
              >
                {`Score ${rows[0].score.toFixed(0)} · ${rows[0].grade}`}
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            color: MUTED,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          {`UrbRank ${year} · ${d.label} profile · ${rows.length} ranked ${s.name} ${rows.length === 1 ? "city" : "cities"}`}
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
            Best Cities by State
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
