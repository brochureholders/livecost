/**
 * Short, shareable aliases for cities whose canonical Census slug is
 * unfriendly. The canonical slug is what the cities table stores (taken
 * verbatim from Census place names), so vanity URLs 301-redirect to the
 * canonical at the edge — the page itself only ever renders one URL.
 *
 * Adding a new alias:
 *   1. Add `vanity-slug → canonical-slug` here.
 *   2. The middleware automatically picks it up on next deploy.
 *   3. Use the canonical slug everywhere internally (links, DB, sitemap)
 *      so we don't compete with our own redirects.
 */
export const VANITY_TO_CANONICAL: Record<string, string> = {
  // Consolidated city-county governments
  "indianapolis-in": "indianapolis-city-balance-in",
  "nashville-tn": "nashville-davidson-metropolitan-government-balance-tn",
  "louisville-ky": "louisville-jefferson-county-metro-government-balance-ky",
  "augusta-ga": "augusta-richmond-county-consolidated-government-balance-ga",
  "athens-ga": "athens-clarke-county-unified-government-balance-ga",
  "macon-ga": "macon-bibb-county-ga",
  "lexington-ky": "lexington-fayette-ky",

  // Census name oddities
  "honolulu-hi": "urban-honolulu-hi",
  "milford-ct": "milford-city-balance-ct",
};

/** Returns the canonical slug if `slug` is a known vanity alias, else null.
 *  Used by middleware to decide whether to issue a 301. */
export function resolveVanitySlug(slug: string): string | null {
  return VANITY_TO_CANONICAL[slug] ?? null;
}
