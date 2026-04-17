import { STATES } from "@/lib/states";
import { xmlResponse, urlsetXml, type SitemapUrl } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const urls: SitemapUrl[] = STATES.map((s) => ({
    path: `/cheapest-cities/${s.slug}`,
    lastmod: today,
    changefreq: "monthly",
    priority: 0.7,
  }));
  return xmlResponse(urlsetXml(urls));
}
