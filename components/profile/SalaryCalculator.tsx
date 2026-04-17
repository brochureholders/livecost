"use client";

import { useMemo, useState } from "react";

type Props = {
  cityName: string;
  state: string;
  costIndex: number | null;
};

const FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function SalaryCalculator({ cityName, state, costIndex }: Props) {
  const [salary, setSalary] = useState<number>(100_000);

  const adjusted = useMemo(() => {
    if (costIndex == null || costIndex === 0) return null;
    return salary * (100 / costIndex);
  }, [salary, costIndex]);

  const delta = adjusted != null ? adjusted - salary : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
      <h3 className="text-xl font-semibold tracking-tight">Salary calculator</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">
        How far does your salary go in {cityName}?
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-[auto_1fr] md:items-end">
        <label
          htmlFor="salary-input"
          className="text-sm font-medium text-[var(--muted)]"
        >
          Your annual salary in {cityName}, {state}
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
        {adjusted != null ? (
          <p className="text-base leading-relaxed">
            Your{" "}
            <span className="font-semibold tabular-nums">
              {FORMATTER.format(salary)}
            </span>{" "}
            in {cityName} has the same purchasing power as{" "}
            <span className="font-semibold tabular-nums text-[var(--accent)]">
              {FORMATTER.format(adjusted)}
            </span>{" "}
            in the average US city.
            {delta != null && Math.abs(delta) > 500 && (
              <>
                {" "}
                You&apos;d need{" "}
                <span className="font-semibold tabular-nums">
                  {FORMATTER.format(Math.abs(delta))}
                </span>{" "}
                {delta > 0 ? "less" : "more"} here to maintain that standard of
                living.
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)] italic">
            We don&apos;t have a cost-of-living index for {cityName} yet, so we
            can&apos;t compute an equivalent salary.
          </p>
        )}
      </div>
    </div>
  );
}
