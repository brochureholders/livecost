"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Category = { label: string; value: number | null };

type Props = {
  categories: Category[];
};

export default function CostBreakdownChart({ categories }: Props) {
  const data = categories
    .filter((c) => c.value != null)
    .map((c) => ({
      category: c.label,
      value: Number((c.value as number).toFixed(1)),
    }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] italic">
        No cost-category data available for this city.
      </p>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 150);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 56)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 32, bottom: 8, left: 16 }}
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
            cursor={{ fill: "var(--border)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            formatter={(value) => [`${value}`, "Index"]}
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
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
            {data.map((d) => (
              <Cell
                key={d.category}
                fill={
                  d.value < 95
                    ? "#059669"
                    : d.value <= 110
                      ? "#d97706"
                      : "var(--accent)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Index: 100 = US city average. Values &gt;100 mean more expensive, &lt;100
        means cheaper.
      </p>
    </div>
  );
}
