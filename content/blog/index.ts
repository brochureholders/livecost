import type { Article } from "./types";

import * as calcGuide from "./how-to-use-cost-of-living-calculator";
import * as indexExplainer from "./what-is-cost-of-living-index";
import * as cheapestStates from "./cheapest-states-to-live-in-2026";
import * as salaryNeeded from "./salary-needed-major-us-cities";
import * as nycAustin from "./moving-nyc-to-austin-cost-comparison";
import * as remoteArbitrage from "./remote-work-arbitrage-guide";
import * as bestFamilies from "./best-cities-for-families-2026";
import * as bestRetirees from "./best-cities-for-retirees-2026";
import * as bestRemoteWorkers from "./best-cities-for-remote-workers-2026";
import * as quizGuide from "./where-should-i-move-quiz-guide";
import * as safestCities from "./safest-cities-in-america-2026";

export const articles: Article[] = [
  { meta: calcGuide.meta, Body: calcGuide.Body },
  { meta: indexExplainer.meta, Body: indexExplainer.Body },
  { meta: cheapestStates.meta, Body: cheapestStates.Body },
  { meta: salaryNeeded.meta, Body: salaryNeeded.Body },
  { meta: nycAustin.meta, Body: nycAustin.Body },
  { meta: remoteArbitrage.meta, Body: remoteArbitrage.Body },
  { meta: bestFamilies.meta, Body: bestFamilies.Body },
  { meta: bestRetirees.meta, Body: bestRetirees.Body },
  { meta: bestRemoteWorkers.meta, Body: bestRemoteWorkers.Body },
  { meta: quizGuide.meta, Body: quizGuide.Body },
  { meta: safestCities.meta, Body: safestCities.Body },
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
