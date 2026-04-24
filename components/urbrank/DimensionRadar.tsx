"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DimensionKey } from "@/lib/urbrank-score";

const LABELS: Record<DimensionKey, string> = {
  affordability: "Affordability",
  safety: "Safety",
  climate: "Climate",
  walkability: "Walkability",
  job_market: "Jobs",
  environment: "Environment",
  education: "Education",
};

type Props = {
  dimensionScores: Partial<Record<DimensionKey, number>>;
};

export default function DimensionRadar({ dimensionScores }: Props) {
  const data = (Object.keys(LABELS) as DimensionKey[])
    .filter((k) => dimensionScores[k] != null)
    .map((k) => ({
      dimension: LABELS[k],
      score: dimensionScores[k] as number,
    }));

  if (data.length < 3) {
    return (
      <p className="text-sm text-[var(--muted)] italic">
        Not enough dimension data to render a chart.
      </p>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "var(--foreground)", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            formatter={(value) => [`${value}/100`, "Score"]}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
