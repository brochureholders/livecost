import { xmlResponse, urlsetXml, type SitemapUrl } from "@/lib/sitemap-utils";

export const revalidate = 86400;

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const urls: SitemapUrl[] = [
    { path: "/", lastmod: today, changefreq: "weekly", priority: 1.0 },
    { path: "/compare", lastmod: today, changefreq: "monthly", priority: 0.6 },
    { path: "/rankings", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculator", lastmod: today, changefreq: "monthly", priority: 0.5 },
    { path: "/blog", lastmod: today, changefreq: "weekly", priority: 0.5 },
    { path: "/about", lastmod: today, changefreq: "yearly", priority: 0.3 },
    { path: "/methodology", lastmod: today, changefreq: "yearly", priority: 0.3 },
    { path: "/privacy", lastmod: today, changefreq: "yearly", priority: 0.2 },
    { path: "/contact", lastmod: today, changefreq: "yearly", priority: 0.3 },
  ];
  return xmlResponse(urlsetXml(urls));
}
