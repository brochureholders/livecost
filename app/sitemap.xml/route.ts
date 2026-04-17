import { getTopCitySlugs } from "@/lib/cities";
import { SITEMAP } from "@/lib/site";
import { sitemapIndexXml, xmlResponse } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const slugs = await getTopCitySlugs(SITEMAP.comparisonsCitiesLimit);
  const nPairs = (slugs.length * Math.max(0, slugs.length - 1)) / 2;
  const nComparisonSitemaps = Math.max(
    1,
    Math.ceil(nPairs / SITEMAP.urlsPerComparisonSitemap),
  );

  const entries = [
    { path: "/sitemap-pages.xml", lastmod: today },
    { path: "/sitemap-states.xml", lastmod: today },
    { path: "/sitemap-cities.xml", lastmod: today },
    ...Array.from({ length: nComparisonSitemaps }, (_, i) => ({
      path: `/sitemap-comparisons-${i + 1}.xml`,
      lastmod: today,
    })),
  ];

  return xmlResponse(sitemapIndexXml(entries));
}
