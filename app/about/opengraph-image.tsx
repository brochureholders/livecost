import { ImageResponse } from "next/og";
import { renderOgTemplate, OG_SIZE } from "@/lib/og-template";

export const runtime = "edge";
export const alt = "About UrbRank — Independent, data-driven US city rankings";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function AboutOgImage() {
  return new ImageResponse(
    renderOgTemplate({
      eyebrow: "About",
      headline: "Where should",
      accent: "I live next?",
      subhead:
        "Independent, data-driven US city rankings — built on Census, BLS, BEA, and FBI public data.",
    }),
    { ...size },
  );
}
