import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "UrbRank — Compare Cost of Living Across US Cities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          background: "#faf6f0",
          color: "#1a1a1a",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 600 }}>
          Live<span style={{ color: "#d64545" }}>Cost</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Compare Cost of
            <br />
            Living Across US Cities
          </div>
          <div style={{ fontSize: 28, color: "#6b6b6b" }}>
            Housing · Salaries · Groceries · Transportation
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
