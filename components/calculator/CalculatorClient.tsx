"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CityOption } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";
import CitySelect from "./CitySelect";
import DifferenceChart, {
  type CategoryDelta,
} from "./DifferenceChart";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Standard household spending shares (approx, BLS CES).
const SHARE = {
  housing: 0.33,
  food: 0.13,
  utilities: 0.07,
  transportation: 0.17,
  healthcare: 0.08,
} as const;

type Props = {
  cities: CityOption[];
  initialFrom?: string;
  initialTo?: string;
  initialSalary?: number;
};

function findCity(cities: CityOption[], slug: string | null | undefined) {
  if (!slug) return null;
  return cities.find((c) => c.slug === slug) ?? null;
}

function computeResults(from: CityOption, to: CityOption, salary: number) {
  const ia = from.cost_index;
  const ib = to.cost_index;
  if (ia == null || ib == null || ia === 0) return null;

  const equivalent = salary * (ib / ia);

  function ratioDelta(
    indexA: number | null,
    indexB: number | null,
    share: number,
  ): number | null {
    if (indexA == null || indexB == null || indexA === 0) return null;
    const monthlyBudget = (salary * share) / 12;
    return monthlyBudget * (indexB / indexA - 1);
  }

  const categories: CategoryDelta[] = [
    { label: "Housing", key: "housing", index: [from.housing_index, to.housing_index], share: SHARE.housing },
    { label: "Groceries", key: "food", index: [from.grocery_index, to.grocery_index], share: SHARE.food },
    { label: "Utilities", key: "utilities", index: [from.utilities_index, to.utilities_index], share: SHARE.utilities },
    { label: "Transportation", key: "transportation", index: [from.transportation_index, to.transportation_index], share: SHARE.transportation },
    { label: "Healthcare", key: "healthcare", index: [from.healthcare_index, to.healthcare_index], share: SHARE.healthcare },
  ]
    .map(({ label, index, share }) => {
      const [a, b] = index;
      const delta = ratioDelta(a, b, share);
      return delta == null ? null : { label, deltaMonthly: Math.round(delta) };
    })
    .filter((x): x is CategoryDelta => x !== null);

  const netMonthly = (equivalent - salary) / 12;

  return {
    equivalent,
    categories,
    netMonthly,
  };
}

export default function CalculatorClient({
  cities,
  initialFrom,
  initialTo,
  initialSalary,
}: Props) {
  const router = useRouter();

  const [from, setFrom] = useState<string | null>(
    initialFrom && findCity(cities, initialFrom) ? initialFrom : null,
  );
  const [to, setTo] = useState<string | null>(
    initialTo && findCity(cities, initialTo) ? initialTo : null,
  );
  const [salary, setSalary] = useState<number>(
    Number.isFinite(initialSalary) && (initialSalary ?? 0) > 0
      ? (initialSalary as number)
      : 100_000,
  );

  // Results only exist after user clicks Compare (or URL pre-populated all 3).
  const hasInitialResults = Boolean(initialFrom && initialTo && initialSalary);
  const [submitted, setSubmitted] = useState<boolean>(hasInitialResults);

  const fromCity = findCity(cities, from);
  const toCity = findCity(cities, to);

  const canCompare =
    !!fromCity && !!toCity && fromCity.slug !== toCity.slug && salary > 0;

  const results = useMemo(() => {
    if (!submitted || !fromCity || !toCity) return null;
    return computeResults(fromCity, toCity, salary);
  }, [submitted, fromCity, toCity, salary]);

  function onCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!canCompare || !fromCity || !toCity) return;
    setSubmitted(true);
    const qp = new URLSearchParams({
      from: fromCity.slug,
      to: toCity.slug,
      salary: String(salary),
    });
    router.replace(`/calculator?${qp.toString()}`, { scroll: false });
  }

  return (
    <div className="mt-10 grid gap-8">
      <form
        onSubmit={onCompare}
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <CitySelect
            label="From city"
            cities={cities}
            value={from}
            onChange={setFrom}
            placeholder="e.g. Austin, TX"
          />
          <CitySelect
            label="To city"
            cities={cities}
            value={to}
            onChange={setTo}
            placeholder="e.g. Denver, CO"
          />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label
              htmlFor="salary"
              className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted)]"
            >
              Your annual salary
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                $
              </span>
              <input
                id="salary"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={salary}
                onChange={(e) =>
                  setSalary(Math.max(0, Number(e.target.value)))
                }
                className="w-full h-12 pl-8 pr-4 rounded-lg border border-[var(--border)] bg-[var(--background)] tabular-nums focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canCompare}
            className="h-12 px-6 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Compare
          </button>
        </div>

        {!canCompare && submitted && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Pick two different cities and enter a salary to compare.
          </p>
        )}
      </form>

      {results && fromCity && toCity && (
        <div className="grid gap-6">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-900">
              Equivalent salary
            </p>
            <p className="mt-3 text-2xl md:text-4xl font-semibold leading-snug text-emerald-900">
              Your{" "}
              <span className="tabular-nums">{CURRENCY.format(salary)}</span> in{" "}
              {fromCity.name}
              {" "}={" "}
              <span className="tabular-nums">
                {CURRENCY.format(results.equivalent)}
              </span>{" "}
              in {toCity.name}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
                Net monthly difference
              </h3>
              <p
                className={`mt-3 text-4xl font-semibold tabular-nums ${
                  results.netMonthly >= 0 ? "text-[var(--accent)]" : "text-emerald-700"
                }`}
              >
                {results.netMonthly >= 0 ? "+" : "−"}
                {CURRENCY.format(Math.abs(results.netMonthly))}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {results.netMonthly >= 0
                  ? `You'd need to earn about ${CURRENCY.format(Math.abs(results.netMonthly))} more per month in ${toCity.name} to match your current standard of living.`
                  : `You'd have roughly ${CURRENCY.format(Math.abs(results.netMonthly))} extra per month in ${toCity.name} at the same salary.`}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
                By category
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                {results.categories.map((c) => (
                  <li
                    key={c.label}
                    className="flex items-center justify-between"
                  >
                    <span>{c.label}</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        c.deltaMonthly >= 0 ? "text-[var(--accent)]" : "text-emerald-700"
                      }`}
                    >
                      {c.deltaMonthly >= 0 ? "+" : "−"}
                      {CURRENCY.format(Math.abs(c.deltaMonthly))}/mo
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
              Category differences per month
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Green bars = savings in {toCity.name}. Red bars = more expensive
              in {toCity.name}.
            </p>
            <div className="mt-4">
              <DifferenceChart data={results.categories} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-[var(--background)] border border-[var(--border)] p-6">
            <p className="text-sm text-[var(--muted)]">
              Want the full breakdown — housing details, demographics, and
              quality of life?
            </p>
            <Link
              href={`/compare/${(() => {
                const [x, y] = canonicalizePair(fromCity.slug, toCity.slug);
                return formatPair(x, y);
              })()}`}
              className="inline-block px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              See full {fromCity.name} vs {toCity.name} comparison →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
