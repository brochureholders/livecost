"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CategoryDelta = {
  label: string;
  /** Positive = more expensive in destination city; negative = savings */
  deltaMonthly: number;
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function DifferenceChart({ data }: { data: CategoryDelta[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm italic text-[var(--muted)]">
        No per-category breakdown available.
      </p>
    );
  }
  const max = Math.max(...data.map((d) => Math.abs(d.deltaMonthly)), 50);

  return (
    <ResponsiveContainer width="100%" height={data.length * 48 + 40}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 12, right: 48, bottom: 12, left: 16 }}
      >
        <XAxis
          type="number"
          domain={[-max, max]}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
          tickFormatter={(v) => CURRENCY.format(v as number)}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "var(--foreground)", fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <ReferenceLine x={0} stroke="var(--muted)" strokeWidth={1} />
        <Tooltip
          cursor={{ fill: "var(--border)", opacity: 0.3 }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
          formatter={(value) => [
            `${CURRENCY.format(value as number)}/mo`,
            "Difference",
          ]}
        />
        <Bar dataKey="deltaMonthly" radius={[3, 3, 3, 3]} barSize={24}>
          {data.map((d) => (
            <Cell
              key={d.label}
              fill={d.deltaMonthly <= 0 ? "#059669" : "var(--accent)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
