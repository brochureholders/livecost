"use client";

import { useState } from "react";
import { colorForScore, PROFILE_LABELS, PROFILES } from "@/lib/urbrank-score";
import type {
  DimensionKey,
  Profile,
  UrbRankScore,
} from "@/lib/urbrank-score";
import DimensionRadar from "./DimensionRadar";

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  affordability: "Affordability",
  safety: "Safety",
  climate: "Climate",
  walkability: "Walkability",
  job_market: "Job Market",
  environment: "Environment",
  education: "Education",
};

const DIMENSION_DESCRIPTIONS: Record<DimensionKey, string> = {
  affordability: "Based on overall cost of living vs. other US cities.",
  safety: "Inverse of violent + property crime rate per 100,000 residents.",
  climate: "Temperate summers & winters, moderate precipitation.",
  walkability: "Walk Score — how feasible daily errands are on foot.",
  job_market: "Unemployment rate plus household income vs. national median.",
  environment: "Air quality index (EPA AQS data).",
  education: "Share of residents 25+ with a bachelor's degree or higher.",
};

/** Map color-name to concrete tailwind classes so the compiler picks them up. */
const COLOR_CLASSES: Record<
  string,
  { text: string; bg: string; bar: string; ring: string }
> = {
  emerald: {
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
    bar: "bg-emerald-500",
    ring: "ring-emerald-500/40",
  },
  amber: {
    text: "text-amber-500",
    bg: "bg-amber-500/10",
    bar: "bg-amber-500",
    ring: "ring-amber-500/40",
  },
  orange: {
    text: "text-orange-500",
    bg: "bg-orange-500/10",
    bar: "bg-orange-500",
    ring: "ring-orange-500/40",
  },
  red: {
    text: "text-red-500",
    bg: "bg-red-500/10",
    bar: "bg-red-500",
    ring: "ring-red-500/40",
  },
};

type Props = {
  scores: Partial<Record<Profile, UrbRankScore>>;
  defaultProfile?: Profile;
};

export default function ScoreDisplay({
  scores,
  defaultProfile = "general",
}: Props) {
  const available = PROFILES.filter((p) => scores[p] != null);
  const initial = available.includes(defaultProfile)
    ? defaultProfile
    : (available[0] ?? "general");
  const [profile, setProfile] = useState<Profile>(initial);

  const current = scores[profile];
  if (!current) {
    return (
      <p className="text-[var(--muted)]">
        No UrbRank Score data available for this city yet.
      </p>
    );
  }

  const colorName = colorForScore(current.score);
  const colors = COLOR_CLASSES[colorName];

  return (
    <div className="space-y-10">
      {/* Profile tabs */}
      <div className="flex flex-wrap gap-2">
        {available.map((p) => {
          const active = p === profile;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setProfile(p)}
              className={[
                "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                active
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]",
              ].join(" ")}
            >
              {PROFILE_LABELS[p]}
            </button>
          );
        })}
      </div>

      {/* Headline score card + radar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div
          className={[
            "lg:col-span-2 rounded-2xl border border-[var(--border)] p-8 flex flex-col items-center justify-center text-center",
            colors.bg,
          ].join(" ")}
        >
          <p className="text-xs uppercase tracking-widest text-[var(--muted)]">
            UrbRank Score · {PROFILE_LABELS[profile]}
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-7xl font-semibold tabular-nums ${colors.text}`}>
              {current.score.toFixed(0)}
            </span>
            <span className="text-[var(--muted)] text-xl">/100</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center h-9 w-12 rounded-md font-semibold text-white ${colors.bar}`}
            >
              {current.grade}
            </span>
            {current.national_rank && (
              <span className="text-sm text-[var(--muted)]">
                Ranked #{current.national_rank} nationally
              </span>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <DimensionRadar dimensionScores={current.dimension_scores} />
        </div>
      </div>

      {/* Dimension cards */}
      <div>
        <h3 className="text-xl font-semibold tracking-tight">
          Dimension breakdown
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Each dimension scored 0-100 against every other US city.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(DIMENSION_LABELS) as DimensionKey[]).map((k) => {
            const v = current.dimension_scores[k];
            if (v == null) return null;
            const c = COLOR_CLASSES[colorForScore(v)];
            return (
              <div
                key={k}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="font-medium">{DIMENSION_LABELS[k]}</div>
                  <div
                    className={`text-lg font-semibold tabular-nums ${c.text}`}
                  >
                    {v}
                    <span className="text-xs text-[var(--muted)] font-normal">
                      /100
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.bar}`}
                    style={{ width: `${v}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {DIMENSION_DESCRIPTIONS[k]}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
