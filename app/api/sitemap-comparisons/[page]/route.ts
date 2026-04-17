import { notFound } from "next/navigation";
import { getTopCitySlugs } from "@/lib/cities";
import { formatPair } from "@/lib/comparison";
import { SITEMAP } from "@/lib/site";
import { xmlResponse, urlsetXml, type SitemapUrl } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page: pageStr } = await params;
  const page = Number(pageStr);
  if (!Number.isInteger(page) || page < 1) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const perPage = SITEMAP.urlsPerComparisonSitemap;
  const slugs = (await getTopCitySlugs(SITEMAP.comparisonsCitiesLimit))
    .slice()
    .sort();

  const start = (page - 1) * perPage;
  const end = start + perPage;
  const urls: SitemapUrl[] = [];
  let idx = 0;
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      if (idx >= end) break;
      if (idx >= start) {
        urls.push({
          path: `/compare/${formatPair(slugs[i], slugs[j])}`,
          lastmod: today,
          changefreq: "monthly",
          priority: 0.6,
        });
      }
      idx++;
    }
    if (idx >= end) break;
  }

  if (page > 1 && urls.length === 0) notFound();

  return xmlResponse(urlsetXml(urls));
}
