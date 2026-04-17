"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryDiff } from "@/lib/comparison";

type Props = {
  categories: CategoryDiff[];
  nameA: string;
  nameB: string;
};

export default function ComparisonBars({ categories, nameA, nameB }: Props) {
  const data = categories
    .filter((c) => c.aValue != null || c.bValue != null)
    .map((c) => ({
      category: c.label,
      [nameA]: c.aValue != null ? Number(c.aValue.toFixed(1)) : null,
      [nameB]: c.bValue != null ? Number(c.bValue.toFixed(1)) : null,
    }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] italic">
        No category-level data available for either city.
      </p>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((d) => [
      typeof d[nameA] === "number" ? (d[nameA] as number) : 0,
      typeof d[nameB] === "number" ? (d[nameB] as number) : 0,
    ]),
    150,
  );

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(320, data.length * 72)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 16, right: 32, bottom: 8, left: 16 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--border)"
            strokeDasharray="2 4"
          />
          <XAxis
            type="number"
            domain={[0, Math.ceil(maxValue / 25) * 25]}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fill: "var(--foreground)", fontSize: 13 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "var(--border)", opacity: 0.3 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            wrapperStyle={{ fontSize: 12 }}
          />
          <ReferenceLine
            x={100}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{
              value: "US avg",
              position: "top",
              fill: "var(--muted)",
              fontSize: 11,
            }}
          />
          <Bar dataKey={nameA} fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={16} />
          <Bar dataKey={nameB} fill="#1f6feb" radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Index: 100 = US city average. Lower is more affordable.
      </p>
    </div>
  );
}
