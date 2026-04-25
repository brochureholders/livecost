/**
 * Dynamic Open Graph image for each /cost-of-living/[slug] page.
 *
 * Cost-focused variant — shows the city's cost index vs national average,
 * median rent, and median income. Same warm-dark glow aesthetic as
 * should-i-move-to but optimized for cost-of-living queries (the
 * dominant search intent for this route).
 */
import { ImageResponse } from "next/og";
import { getCityBySlug } from "@/lib/cities";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cost of Living for this city";

const BG = "#241c14";
const SURFACE = "#2e2419";
const TEXT = "#f5f1e8";
const MUTED = "#a8967c";
const ACCENT = "#ff7b6a";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function indexColor(idx: number | null): string {
  if (idx == null) return "#a8967c";
  if (idx < 90) return "#10b981"; // cheap = green
  if (idx < 110) return "#f59e0b"; // average = amber
  return "#f97316"; // expensive = orange
}

function indexLabel(idx: number | null): string {
  if (idx == null) return "—";
  const dev = idx - 100;
  const sign = dev >= 0 ? "+" : "";
  return `${sign}${Math.round(dev)}%`;
}

type Params = { slug: string };

export default async function Image({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return defaultCard();

  const costs = city.costs;
  const idx = costs?.cost_index ? Number(costs.cost_index) : null;
  const rent = costs?.median_rent ? Number(costs.median_rent) : null;
  const income = costs?.median_household_income
    ? Number(costs.median_household_income)
    : null;
  const idxColor = indexColor(idx);

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
            Cost of Living
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
            }}
          >
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

          {/* Cost-index badge */}
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
              border: `4px solid ${idxColor}`,
              boxShadow: `0 0 60px ${idxColor}88, 0 0 120px ${idxColor}44`,
              flexShrink: 0,
            }}
          >
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
                Cost Index
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 130,
                  fontWeight: 700,
                  color: idxColor,
                  lineHeight: 1.0,
                  letterSpacing: "-0.05em",
                }}
              >
                {idx != null ? String(Math.round(idx)) : "—"}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: TEXT,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {idx != null ? `${indexLabel(idx)} vs US` : "vs US 100"}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: rent + income */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: 48,
            color: MUTED,
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          {rent != null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ color: TEXT, fontWeight: 600 }}>
                {CURRENCY.format(rent)}/mo
              </span>
              <span>median rent</span>
            </div>
          )}
          {income != null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ color: TEXT, fontWeight: 600 }}>
                {CURRENCY.format(income)}
              </span>
              <span>median income</span>
            </div>
          )}
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
            Cost of Living
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
            Compare housing, salaries, and prices across US cities.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
