import { articlesByDate } from "@/content/blog";
import { DEMOGRAPHICS } from "@/lib/demographics";
import { STATES } from "@/lib/states";
import { xmlResponse, urlsetXml, type SitemapUrl } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const urls: SitemapUrl[] = [
    { path: "/", lastmod: today, changefreq: "weekly", priority: 1.0 },
    { path: "/compare", lastmod: today, changefreq: "monthly", priority: 0.6 },
    { path: "/rankings", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/rankings/cheapest-cities", lastmod: today, changefreq: "monthly", priority: 0.8 },
    { path: "/rankings/most-expensive-cities", lastmod: today, changefreq: "monthly", priority: 0.8 },
    { path: "/rankings/highest-income-cities", lastmod: today, changefreq: "monthly", priority: 0.8 },
    { path: "/rankings/cheapest-rent-cities", lastmod: today, changefreq: "monthly", priority: 0.8 },
    { path: "/calculator", lastmod: today, changefreq: "monthly", priority: 0.5 },
    { path: "/should-i-move-to", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/best-cities", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/quiz", lastmod: today, changefreq: "monthly", priority: 0.9 },
    ...DEMOGRAPHICS.map((d) => ({
      path: `/best-cities/${d.slug}`,
      lastmod: today,
      changefreq: "weekly" as const,
      priority: 0.8,
    })),
    ...DEMOGRAPHICS.flatMap((d) =>
      STATES.map((s) => ({
        path: `/best-cities/${d.slug}/${s.slug}`,
        lastmod: today,
        changefreq: "monthly" as const,
        priority: 0.6,
      })),
    ),
    { path: "/blog", lastmod: today, changefreq: "weekly", priority: 0.6 },
    ...articlesByDate.map(({ meta }) => ({
      path: `/blog/${meta.slug}`,
      lastmod: meta.updated ?? meta.published,
      changefreq: "monthly" as const,
      priority: 0.7,
    })),
    { path: "/about", lastmod: today, changefreq: "yearly", priority: 0.3 },
    { path: "/methodology", lastmod: today, changefreq: "yearly", priority: 0.3 },
    { path: "/privacy", lastmod: today, changefreq: "yearly", priority: 0.2 },
    { path: "/contact", lastmod: today, changefreq: "yearly", priority: 0.3 },
  ];
  return xmlResponse(urlsetXml(urls));
}
