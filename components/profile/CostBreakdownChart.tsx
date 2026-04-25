"use client";

import dynamic from "next/dynamic";

/**
 * Thin client-side dynamic loader for CostBreakdownChartImpl. Keeps the
 * ~280KB Recharts library out of the initial JS bundle for
 * /cost-of-living/[slug] pages — chart code only loads after hydration,
 * and visitors who bounce above the fold never download it.
 */
const Impl = dynamic(() => import("./CostBreakdownChartImpl"), {
  ssr: false,
  loading: () => (
    <div
      style={{ minHeight: 280 }}
      className="w-full flex items-center justify-center text-sm text-[var(--muted)]"
    >
      Loading chart…
    </div>
  ),
});

type Category = { label: string; value: number | null };

export default function CostBreakdownChart({
  categories,
}: {
  categories: Category[];
}) {
  return <Impl categories={categories} />;
}
