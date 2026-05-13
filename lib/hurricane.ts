/**
 * Atlantic / Gulf hurricane-relevance check. Returns true when the city is
 * far enough east + south that hurricane season is a real local topic.
 *
 * Conservative inclusion list — these states feel hurricane effects
 * (storms, rain bands, sometimes direct hits) even at inland points:
 *   - Gulf coast: TX, LA, MS, AL, FL
 *   - South Atlantic: GA, SC, NC
 *   - Mid + North Atlantic: VA, MD, DE, NJ, NY, CT, RI, MA, NH, ME
 *   - DC for completeness (the District is hurricane-relevant)
 *
 * Texas needs lat/lon filtering since El Paso (-106° lon) is irrelevant.
 * Same for inland TX cities like Lubbock and Amarillo — we restrict to
 * longitude east of -100° to capture only the Gulf-facing half.
 */

const ALWAYS_HURRICANE_STATES = new Set([
  "FL", "AL", "MS", "LA",
  "GA", "SC", "NC",
  "VA", "MD", "DC", "DE",
  "NJ", "NY", "CT", "RI", "MA", "NH", "ME",
]);

const CONDITIONAL_STATES = new Set(["TX"]);

/** Returns true when "When is hurricane season in [City]?" is a relevant
 *  question to surface on this city's profile. */
export function isHurricaneRelevant(
  stateCode: string,
  longitude: number | null,
): boolean {
  if (ALWAYS_HURRICANE_STATES.has(stateCode)) return true;
  if (CONDITIONAL_STATES.has(stateCode)) {
    // Texas: include the Gulf-facing east half only.
    return longitude != null && longitude > -100;
  }
  return false;
}
