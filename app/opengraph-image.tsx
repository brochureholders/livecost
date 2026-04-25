import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "UrbRank — Where Should I Live? Score every US city.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#241c14";
const TEXT = "#f5f1e8";
const MUTED = "#a8967c";
const ACCENT = "#ff7b6a";

export default function OgImage() {
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
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: ACCENT,
            }}
          >
            Score every US city.
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
            Affordability · Safety · Climate · Jobs · Walkability
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
