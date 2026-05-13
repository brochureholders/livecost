/**
 * City land-area lookup. Source: Census 2024 Gazetteer place file, parsed
 * into data/census/city-area.json by scripts/_build-city-area.ts. Values
 * are land area in square miles (ALAND_SQMI), not including inland water.
 *
 * Used on the comparison page for the "Is X bigger than Y?" answer.
 */
import areaJson from "@/data/census/city-area.json";

const AREA: Record<string, number> = areaJson as Record<string, number>;

/** Square-mile land area for a city, or null when we don't have it.
 *  Today covers 999 of 1000 cities. */
export function getAreaSqMiles(slug: string): number | null {
  return AREA[slug] ?? null;
}

/** Round area to a friendly number for display. Same scheme as
 *  distance helpers — coarser as the value grows. */
export function roundAreaFriendly(sqMiles: number): number {
  if (sqMiles < 10) return Number(sqMiles.toFixed(1));
  if (sqMiles < 100) return Math.round(sqMiles);
  if (sqMiles < 1000) return Math.round(sqMiles / 5) * 5;
  return Math.round(sqMiles / 25) * 25;
}
