/**
 * Quiz engine — 8 questions produce a custom weight vector over the 7 UrbRank
 * dimensions. `/quiz/results` then applies those weights to every city's
 * pre-computed dimension scores to produce a personalized ranking.
 */
import { DIMENSIONS } from "./urbrank-score";
import type { DimensionKey } from "./urbrank-score";

export type QuestionOption = {
  id: string;
  label: string;
  /** Dimension weight deltas (positive = boost, negative = de-emphasize). */
  weights: Partial<Record<DimensionKey, number>>;
};

export type Question = {
  id: string;
  title: string;
  subtitle?: string;
  options: QuestionOption[];
};

export const QUESTIONS: Question[] = [
  {
    id: "priority",
    title: "What's your top priority when picking a city?",
    subtitle: "Pick the one that matters most right now.",
    options: [
      { id: "cost", label: "Low cost of living", weights: { affordability: 25 } },
      { id: "career", label: "Career growth & jobs", weights: { job_market: 25 } },
      { id: "family", label: "Family life & schools", weights: { safety: 15, education: 15 } },
      { id: "retire", label: "Retirement & ease of living", weights: { climate: 15, safety: 10, walkability: 10 } },
      { id: "climate", label: "Great climate", weights: { climate: 25 } },
    ],
  },
  {
    id: "work",
    title: "How much do you work remotely?",
    options: [
      { id: "never", label: "Never — I need to be in an office", weights: { job_market: 10 } },
      { id: "hybrid", label: "Hybrid — a few days a week", weights: { job_market: 5, walkability: 5 } },
      { id: "always", label: "Always remote", weights: { affordability: 15, environment: 5 } },
    ],
  },
  {
    id: "walk",
    title: "How important is walkability?",
    subtitle: "Coffee shops, restaurants, and errands on foot.",
    options: [
      { id: "low", label: "Not important — I'll drive", weights: {} },
      { id: "med", label: "Nice to have", weights: { walkability: 8 } },
      { id: "high", label: "Very important", weights: { walkability: 20 } },
    ],
  },
  {
    id: "climate",
    title: "What climate suits you?",
    options: [
      { id: "warm", label: "Warm year round", weights: { climate: 15 } },
      { id: "four", label: "Four distinct seasons", weights: { climate: 10 } },
      { id: "mild", label: "Mild — no extremes", weights: { climate: 15 } },
      { id: "any", label: "Don't care", weights: {} },
    ],
  },
  {
    id: "safety",
    title: "How important is low crime?",
    options: [
      { id: "low", label: "I'll manage — cities are cities", weights: {} },
      { id: "med", label: "Important", weights: { safety: 10 } },
      { id: "high", label: "Non-negotiable", weights: { safety: 20 } },
    ],
  },
  {
    id: "budget",
    title: "What's your cost-of-living budget?",
    subtitle: "How tight is your monthly bottom line?",
    options: [
      { id: "tight", label: "Tight — every dollar counts", weights: { affordability: 25 } },
      { id: "mid", label: "Moderate — comfortable but not wealthy", weights: { affordability: 10 } },
      { id: "flex", label: "Flexible — I can afford most places", weights: {} },
    ],
  },
  {
    id: "schools",
    title: "Are quality schools important?",
    options: [
      { id: "yes", label: "Yes — I have kids or plan to", weights: { education: 15, safety: 5 } },
      { id: "someday", label: "Someday, not now", weights: { education: 5 } },
      { id: "no", label: "Not a factor", weights: {} },
    ],
  },
  {
    id: "environment",
    title: "How important is clean air and green space?",
    options: [
      { id: "low", label: "Not a dealbreaker", weights: {} },
      { id: "med", label: "Nice to have", weights: { environment: 8 } },
      { id: "high", label: "Very important — I'm sensitive to air quality", weights: { environment: 18 } },
    ],
  },
];

/** Base weight everywhere so a dimension always contributes a little. */
const BASE_WEIGHT = 5;

/** Combine the user's selections into a final weights object. Rescales to 100. */
export function buildWeights(
  selections: Record<string, string>,
): Record<DimensionKey, number> {
  const acc: Record<DimensionKey, number> = {
    affordability: BASE_WEIGHT,
    safety: BASE_WEIGHT,
    climate: BASE_WEIGHT,
    walkability: BASE_WEIGHT,
    job_market: BASE_WEIGHT,
    environment: BASE_WEIGHT,
    education: BASE_WEIGHT,
  };
  for (const q of QUESTIONS) {
    const chosen = selections[q.id];
    if (!chosen) continue;
    const opt = q.options.find((o) => o.id === chosen);
    if (!opt) continue;
    for (const [dim, w] of Object.entries(opt.weights)) {
      const key = dim as DimensionKey;
      acc[key] = (acc[key] ?? 0) + (w ?? 0);
    }
  }
  // Normalize to 100
  const total = DIMENSIONS.reduce((s, d) => s + (acc[d] ?? 0), 0);
  if (total === 0) {
    return Object.fromEntries(
      DIMENSIONS.map((d) => [d, 100 / DIMENSIONS.length]),
    ) as Record<DimensionKey, number>;
  }
  const scaled: Record<DimensionKey, number> = {
    affordability: 0, safety: 0, climate: 0, walkability: 0,
    job_market: 0, environment: 0, education: 0,
  };
  for (const d of DIMENSIONS) scaled[d] = ((acc[d] ?? 0) / total) * 100;
  return scaled;
}

/** Encode weights as a short query string. Each weight rounded to integer. */
export function encodeWeights(w: Record<DimensionKey, number>): string {
  const parts: string[] = [];
  for (const d of DIMENSIONS) {
    parts.push(`${d}=${Math.round(w[d])}`);
  }
  return parts.join("&");
}

/** Parse URL query into weights, with safe defaults. */
export function decodeWeights(
  params: URLSearchParams,
): Record<DimensionKey, number> {
  const w: Record<DimensionKey, number> = {
    affordability: 0, safety: 0, climate: 0, walkability: 0,
    job_market: 0, environment: 0, education: 0,
  };
  let total = 0;
  for (const d of DIMENSIONS) {
    const v = Number(params.get(d));
    if (Number.isFinite(v) && v >= 0 && v <= 100) {
      w[d] = v;
      total += v;
    }
  }
  if (total === 0) {
    // default to equal weighting
    for (const d of DIMENSIONS) w[d] = 100 / DIMENSIONS.length;
  }
  return w;
}
