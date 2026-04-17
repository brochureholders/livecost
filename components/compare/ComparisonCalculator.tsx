"use client";

import { useMemo, useState } from "react";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type Props = {
  nameA: string;
  nameB: string;
  indexA: number | null;
  indexB: number | null;
};

export default function ComparisonCalculator({
  nameA,
  nameB,
  indexA,
  indexB,
}: Props) {
  const [salary, setSalary] = useState<number>(100_000);
  const [direction, setDirection] = useState<"aToB" | "bToA">("aToB");

  const equivalent = useMemo(() => {
    if (indexA == null || indexB == null || indexA === 0 || indexB === 0) {
      return null;
    }
    return direction === "aToB"
      ? salary * (indexB / indexA)
      : salary * (indexA / indexB);
  }, [salary, indexA, indexB, direction]);

  const fromCity = direction === "aToB" ? nameA : nameB;
  const toCity = direction === "aToB" ? nameB : nameA;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
      <h3 className="text-xl font-semibold tracking-tight">
        Salary equivalence
      </h3>
      <p className="mt-2 text-sm text-[var(--muted)]">
        How much you&apos;d need to earn in the other city to keep the same
        standard of living.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDirection("aToB")}
          className={`px-4 py-2 rounded-full text-sm border transition-colors ${
            direction === "aToB"
              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
              : "border-[var(--border)] hover:border-[var(--accent)]"
          }`}
        >
          {nameA} → {nameB}
        </button>
        <button
          type="button"
          onClick={() => setDirection("bToA")}
          className={`px-4 py-2 rounded-full text-sm border transition-colors ${
            direction === "bToA"
              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
              : "border-[var(--border)] hover:border-[var(--accent)]"
          }`}
        >
          {nameB} → {nameA}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[auto_1fr] md:items-end">
        <label
          htmlFor="salary-input"
          className="text-sm font-medium text-[var(--muted)]"
        >
          Your salary in {fromCity}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted)]">$</span>
          <input
            id="salary-input"
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            value={salary}
            onChange={(e) => setSalary(Math.max(0, Number(e.target.value)))}
            className="w-full max-w-xs h-11 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] tabular-nums"
          />
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-[var(--background)] p-5 border border-[var(--border)]">
        {equivalent != null ? (
          <p className="text-base leading-relaxed">
            If you earn{" "}
            <span className="font-semibold tabular-nums">
              {CURRENCY.format(salary)}
            </span>{" "}
            in {fromCity}, you&apos;d need{" "}
            <span className="font-semibold tabular-nums text-[var(--accent)]">
              {CURRENCY.format(equivalent)}
            </span>{" "}
            in {toCity} to maintain your standard of living.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)] italic">
            Missing cost-of-living index for one of these cities, so we can&apos;t
            compute an equivalent salary.
          </p>
        )}
      </div>
    </div>
  );
}
