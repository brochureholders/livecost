/**
 * Shared OG-image renderer for static pages. Each route file calls
 * `renderOgTemplate` with its own copy and passes the result to
 * `new ImageResponse(...)`.
 *
 * Brand tokens are duplicated from the global app/opengraph-image.tsx
 * so a future tweak to that file should be mirrored here, but having
 * them in one place beats per-route duplication.
 */

const BG = "#241c14";
const TEXT = "#f5f1e8";
const MUTED = "#a8967c";
const ACCENT = "#ff7b6a";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type OgTemplateProps = {
  /** Small label above the headline, e.g. "About". Optional. */
  eyebrow?: string;
  /** First line of the headline, rendered in foreground color. */
  headline: string;
  /** Second line of the headline, rendered in accent color. */
  accent: string;
  /** Subhead under the headline, muted. Optional. */
  subhead?: string;
};

export function renderOgTemplate(props: OgTemplateProps) {
  return (
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
        {props.eyebrow && (
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            {props.eyebrow}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {props.headline}
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
          {props.accent}
        </div>
        {props.subhead && (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: MUTED,
              maxWidth: 1000,
            }}
          >
            {props.subhead}
          </div>
        )}
      </div>
    </div>
  );
}
