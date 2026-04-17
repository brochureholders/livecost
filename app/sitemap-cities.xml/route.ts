import { getTopCitySlugs } from "@/lib/cities";
import { SITEMAP } from "@/lib/site";
import { xmlResponse, urlsetXml, type SitemapUrl } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const slugs = await getTopCitySlugs(SITEMAP.profilesLimit);
  const urls: SitemapUrl[] = slugs.map((slug) => ({
    path: `/cost-of-living/${slug}`,
    lastmod: today,
    changefreq: "monthly",
    priority: 0.8,
  }));
  return xmlResponse(urlsetXml(urls));
}
