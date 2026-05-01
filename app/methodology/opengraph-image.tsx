import { ImageResponse } from "next/og";
import { renderOgTemplate, OG_SIZE } from "@/lib/og-template";

export const runtime = "edge";
export const alt = "UrbRank Methodology — How we score every US city";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function MethodologyOgImage() {
  return new ImageResponse(
    renderOgTemplate({
      eyebrow: "Methodology",
      headline: "Every number,",
      accent: "from a public source.",
      subhead:
        "Census · BLS · BEA · NCEI · EPA · FBI · Walk Score — refreshed annually.",
    }),
    { ...size },
  );
}
