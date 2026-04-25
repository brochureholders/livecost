/**
 * Compact city index for the global header search autocomplete.
 *
 * Returns every city's slug/name/state_code, sorted by population.
 * Cached aggressively at the edge — payload changes only when we ingest
 * new cities, which is rare.
 */
import { getCityIndex } from "@/lib/cities";

export const revalidate = 86400; // refresh daily

export async function GET() {
  const cities = await getCityIndex();
  return Response.json(cities, {
    headers: {
      // s-maxage: edge cache for 1 day; stale-while-revalidate keeps
      // returning the cached response for another day while refetching.
      "Cache-Control":
        "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
