import { getTopCitySlugs } from "@/lib/cities";
import { profilePriority } from "@/lib/coverage";
import { SITEMAP } from "@/lib/site";
import { xmlResponse, urlsetXml, type SitemapUrl } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const slugs = await getTopCitySlugs(SITEMAP.profilesLimit);
  const urls: SitemapUrl[] = [];
  for (const slug of slugs) {
    urls.push({
      path: `/cost-of-living/${slug}`,
      lastmod: today,
      changefreq: "monthly",
      priority: profilePriority(slug),
    });
  }
  // UrbRank Score pages — one per city, matching the /cost-of-living
  // catalog size.
  for (const slug of slugs) {
    urls.push({
      path: `/should-i-move-to/${slug}`,
      lastmod: today,
      changefreq: "monthly",
      priority: profilePriority(slug),
    });
  }
  return xmlResponse(urlsetXml(urls));
}
