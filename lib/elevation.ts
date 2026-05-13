/**
 * City elevation lookup. Source: Open-Meteo Elevation API, fetched once
 * per city and committed to data/census/city-elevation.json. Values are
 * meters above sea level (rounded to nearest integer).
 *
 * Used by the city-profile FAQ for the "What is the elevation of X?"
 * answer — Denver alone drives 14k mo searches on this pattern.
 */
import elevationJson from "@/data/census/city-elevation.json";

const ELEVATION: Record<string, number> = elevationJson as Record<string, number>;

/** Elevation in meters above sea level. Null when we don't have it. */
export function getElevationMeters(slug: string): number | null {
  return slug in ELEVATION ? ELEVATION[slug] : null;
}

/** Convenience: same value in feet. */
export function getElevationFeet(slug: string): number | null {
  const m = getElevationMeters(slug);
  return m == null ? null : Math.round(m * 3.28084);
}
