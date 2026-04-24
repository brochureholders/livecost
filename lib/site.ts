export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "UrbRank";

export const SITE_DESCRIPTION =
  "Compare cost of living across every major US city. Housing, salaries, groceries, and more — from Census and BLS data.";

/** Sitemap generation constants */
export const SITEMAP = {
  profilesLimit: 1000,
  comparisonsCitiesLimit: 250,
  urlsPerComparisonSitemap: 50_000,
} as const;

export function absoluteUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${trimmed}`;
}
