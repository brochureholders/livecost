import { ImageResponse } from "next/og";
import { renderOgTemplate, OG_SIZE } from "@/lib/og-template";

export const runtime = "edge";
export const alt = "Contact UrbRank";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function ContactOgImage() {
  return new ImageResponse(
    renderOgTemplate({
      eyebrow: "Contact",
      headline: "Tell us",
      accent: "what to fix.",
      subhead:
        "Data corrections, missing cities, feature requests — info@urbrank.com.",
    }),
    { ...size },
  );
}
