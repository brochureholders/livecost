/**
 * Rough US time-zone resolver for the comparison page's "what's the time
 * difference between X and Y" Q&A. State code takes priority for the four
 * states that break the simple longitude rule (HI, AK, AZ, plus the FL /
 * IN / TX panhandle edge cases handled below), then longitude bands fill
 * in the rest.
 *
 * Returns standard-time offset in hours from UTC. DST cancels out between
 * any pair where both cities observe it, which is every CONUS pair except
 * those involving AZ or HI — and even those preserve the absolute hour
 * difference for half the year. The Q&A copy notes this explicitly.
 */

/** Standard-time UTC offset for a US city. */
export function getTimezoneOffset(stateCode: string, longitude: number): number {
  // Special cases first: states whose offset doesn't follow longitude.
  if (stateCode === "HI") return -10; // Hawaii–Aleutian, no DST
  if (stateCode === "AK") return -9; // Most populated Alaska is AKT
  if (stateCode === "AZ") return -7; // MST, no DST (except Navajo Nation)

  // Longitude bands for the lower 48. Boundaries chosen at the rough
  // east edge of each zone's western state(s) so split states (TX, KS, ND,
  // SD, NE, KY, TN, IN, MI, FL) end up in the zone matching most of their
  // population.
  if (longitude >= -82.5) return -5; // Eastern
  if (longitude >= -100) return -6; // Central — TX panhandle west of this lands in MT
  if (longitude >= -114) return -7; // Mountain
  return -8; // Pacific
}

const TZ_NAMES: Record<number, string> = {
  [-5]: "Eastern",
  [-6]: "Central",
  [-7]: "Mountain",
  [-8]: "Pacific",
  [-9]: "Alaska",
  [-10]: "Hawaii–Aleutian",
};

/** Human-readable zone name for the offset. */
export function tzName(offset: number): string {
  return TZ_NAMES[offset] ?? `UTC${offset >= 0 ? "+" : ""}${offset}`;
}

/** Standard abbreviation (ET, CT, etc.) — used in tight UI spots. */
export function tzAbbrev(offset: number): string {
  switch (offset) {
    case -5:
      return "ET";
    case -6:
      return "CT";
    case -7:
      return "MT";
    case -8:
      return "PT";
    case -9:
      return "AKT";
    case -10:
      return "HST";
    default:
      return `UTC${offset >= 0 ? "+" : ""}${offset}`;
  }
}

/** Format the time difference as a sentence fragment, e.g. "2 hours ahead
 *  of" or "in the same time zone as". `offsetA - offsetB`: positive means
 *  A is east of B and therefore ahead. */
export function describeOffsetDiff(offsetA: number, offsetB: number): {
  diffHours: number;
  direction: "ahead" | "behind" | "same";
} {
  const diff = offsetA - offsetB;
  if (diff === 0) return { diffHours: 0, direction: "same" };
  return {
    diffHours: Math.abs(diff),
    direction: diff > 0 ? "ahead" : "behind",
  };
}

/** Given a 24-hour clock hour in zone A, return the matching clock hour
 *  in zone B as a friendly string ("9 a.m.", "noon", "midnight"). */
export function formatLocalTime(
  hourA: number,
  offsetA: number,
  offsetB: number,
): string {
  let h = hourA + (offsetB - offsetA);
  while (h < 0) h += 24;
  while (h >= 24) h -= 24;
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  const period = h < 12 ? "a.m." : "p.m.";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${period}`;
}
