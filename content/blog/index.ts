import type { Article } from "./types";

import * as calcGuide from "./how-to-use-cost-of-living-calculator";
import * as indexExplainer from "./what-is-cost-of-living-index";
import * as cheapestStates from "./cheapest-states-to-live-in-2026";
import * as salaryNeeded from "./salary-needed-major-us-cities";
import * as nycAustin from "./moving-nyc-to-austin-cost-comparison";
import * as remoteArbitrage from "./remote-work-arbitrage-guide";

export const articles: Article[] = [
  { meta: calcGuide.meta, Body: calcGuide.Body },
  { meta: indexExplainer.meta, Body: indexExplainer.Body },
  { meta: cheapestStates.meta, Body: cheapestStates.Body },
  { meta: salaryNeeded.meta, Body: salaryNeeded.Body },
  { meta: nycAustin.meta, Body: nycAustin.Body },
  { meta: remoteArbitrage.meta, Body: remoteArbitrage.Body },
];

/** Most recent first. */
export const articlesByDate = [...articles].sort((a, b) =>
  b.meta.published.localeCompare(a.meta.published),
);

export function getArticle(slug: string): Article | null {
  return articles.find((a) => a.meta.slug === slug) ?? null;
}

export function allSlugs(): string[] {
  return articles.map((a) => a.meta.slug);
}
