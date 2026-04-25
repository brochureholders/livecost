"use client";

import dynamic from "next/dynamic";

/**
 * Thin client-side dynamic loader for DifferenceChartImpl. Keeps Recharts
 * out of the calculator's initial bundle — the chart only renders after
 * the user clicks Compare, by which point lazy-loading is fine.
 */
export type CategoryDelta = {
  label: string;
  deltaMonthly: number;
};

const Impl = dynamic(() => import("./DifferenceChartImpl"), {
  ssr: false,
  loading: () => (
    <div
      style={{ minHeight: 240 }}
      className="w-full flex items-center justify-center text-sm text-[var(--muted)]"
    >
      Loading chart…
    </div>
  ),
});

export default function DifferenceChart({ data }: { data: CategoryDelta[] }) {
  return <Impl data={data} />;
}
