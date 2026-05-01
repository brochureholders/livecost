import { ImageResponse } from "next/og";
import { renderOgTemplate, OG_SIZE } from "@/lib/og-template";

export const runtime = "edge";
export const alt = "UrbRank Privacy — what we log, what we don't";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function PrivacyOgImage() {
  return new ImageResponse(
    renderOgTemplate({
      eyebrow: "Privacy",
      headline: "What we log,",
      accent: "what we don't.",
      subhead:
        "No cookies. No ad networks. No fingerprinting. Pageview path + cookieless analytics.",
    }),
    { ...size },
  );
}
