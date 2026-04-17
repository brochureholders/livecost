import type { CityProfile } from "./cities";

const SEPARATOR = "-vs-";

/** Parse `"austin-tx-vs-denver-co"` → `["austin-tx", "denver-co"]`. */
export function parsePair(pair: string): [string, string] | null {
  const idx = pair.indexOf(SEPARATOR);
  if (idx < 1) return null;
  const a = pair.slice(0, idx);
  const b = pair.slice(idx + SEPARATOR.length);
  if (!a || !b || a === b) return null;
  if (b.includes(SEPARATOR)) return null; // e.g. "a-vs-b-vs-c" is ambiguous
  return [a, b];
}

/** Alphabetical canonical order so Austin-vs-Denver === Denver-vs-Austin. */
export function canonicalizePair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function formatPair(a: string, b: string): string {
  return `${a}${SEPARATOR}${b}`;
}

export function isCanonicalOrder(a: string, b: string): boolean {
  return a <= b;
}

export type CategoryDiff = {
  key: string;
  label: string;
  aValue: number | null;
  bValue: number | null;
  unit: "index" | "usd" | "usd-month";
};

export function buildCategories(
  a: CityProfile,
  b: CityProfile,
): CategoryDiff[] {
  const ca = a.costs;
  const cb = b.costs;
  return [
    {
      key: "housing",
      label: "Housing",
      aValue: ca?.housing_index ?? null,
      bValue: cb?.housing_index ?? null,
      unit: "index",
    },
    {
      key: "groceries",
      label: "Groceries",
      aValue: ca?.grocery_index ?? null,
      bValue: cb?.grocery_index ?? null,
      unit: "index",
    },
    {
      key: "utilities",
      label: "Utilities",
      aValue: ca?.utilities_index ?? null,
      bValue: cb?.utilities_index ?? null,
      unit: "index",
    },
    {
      key: "transportation",
      label: "Transportation",
      aValue: ca?.transportation_index ?? null,
      bValue: cb?.transportation_index ?? null,
      unit: "index",
    },
    {
      key: "healthcare",
      label: "Healthcare",
      aValue: ca?.healthcare_index ?? null,
      bValue: cb?.healthcare_index ?? null,
      unit: "index",
    },
  ];
}

export type Verdict = {
  /** Percent difference of cheaper city relative to more expensive one */
  percent: number | null;
  /** Which city is cheaper: "a", "b", "tie", or null (insufficient data) */
  cheaper: "a" | "b" | "tie" | null;
};

export function verdict(
  indexA: number | null | undefined,
  indexB: number | null | undefined,
): Verdict {
  if (indexA == null || indexB == null) {
    return { percent: null, cheaper: null };
  }
  if (Math.abs(indexA - indexB) < 0.5) {
    return { percent: 0, cheaper: "tie" };
  }
  const cheaper: "a" | "b" = indexA < indexB ? "a" : "b";
  const [low, high] = cheaper === "a" ? [indexA, indexB] : [indexB, indexA];
  const percent = Number((((high - low) / high) * 100).toFixed(1));
  return { percent, cheaper };
}

/** For the salary calculator: salary_B = salary_A * (indexB / indexA) */
export function equivalentSalary(
  salaryA: number,
  indexA: number | null | undefined,
  indexB: number | null | undefined,
): number | null {
  if (indexA == null || indexA === 0 || indexB == null) return null;
  return Number((salaryA * (indexB / indexA)).toFixed(0));
}
