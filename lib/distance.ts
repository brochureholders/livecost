/**
 * Pairwise distance helpers for the comparison page. Straight-line via
 * haversine, plus a US-road approximation and a typical flight time.
 *
 * The crow-flies number is the only exact value here. The driving
 * estimate is great-circle × 1.25, which underestimates for cities
 * separated by mountain ranges (LA → Denver) and overestimates for
 * cities in flat country with direct interstates — but is roughly
 * right within ±15% across the US, which is the level of precision
 * users care about at this stage of a "should I move" search.
 */

const EARTH_RADIUS_MILES = 3958.8;
const EARTH_RADIUS_KM = 6371.0;

/** Great-circle distance in miles between two lat/lon pairs. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

/** Same as haversineMiles but in kilometers. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return haversineMiles(lat1, lon1, lat2, lon2) * (EARTH_RADIUS_KM / EARTH_RADIUS_MILES);
}

/** Rough driving-distance estimate for US road networks. Calibration
 *  factor of 1.25 captures the typical detour from straight-line through
 *  the interstate grid. Accurate to ~±15% for most CONUS pairs. */
export function estimatedDrivingMiles(crowMiles: number): number {
  return crowMiles * 1.25;
}

/** Typical flight duration in hours at airline cruise speed (~500 mph
 *  block-to-block including taxi/climb/descent). For consumer-facing
 *  comparisons, this is more useful than aircraft-only flight time. */
export function flightTimeHours(crowMiles: number): number {
  return crowMiles / 500;
}

/** Round a distance to a tidy human number: nearest 10 below 100,
 *  nearest 25 below 500, nearest 50 below 1000, nearest 100 beyond. */
export function roundDistanceFriendly(miles: number): number {
  if (miles < 100) return Math.round(miles / 10) * 10;
  if (miles < 500) return Math.round(miles / 25) * 25;
  if (miles < 1000) return Math.round(miles / 50) * 50;
  return Math.round(miles / 100) * 100;
}

/** Format flight time as "1 h 45 min" — drop hours below 1 (use minutes
 *  only), drop minutes when rounded to 0. */
export function formatFlightTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
