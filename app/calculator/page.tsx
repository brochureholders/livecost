import type { Metadata } from "next";
import { getCityOptions } from "@/lib/cities";
import CalculatorClient from "@/components/calculator/CalculatorClient";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Cost of Living Calculator — Compare Salaries Across Cities | LiveCost",
  description:
    "Free cost of living calculator. Enter your salary and see the equivalent income needed to maintain your standard of living in any US city. Category-by-category breakdown included.",
  alternates: { canonical: "/calculator" },
  openGraph: {
    title: "Cost of Living Calculator",
    description:
      "Enter your salary and see what it's worth in any US city. Housing, groceries, transportation, and more.",
    type: "website",
  },
};

type SearchParams = Promise<{
  from?: string;
  to?: string;
  salary?: string;
}>;

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const cities = await getCityOptions(500);

  const salary = sp.salary ? Number(sp.salary) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Salary calculator
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Cost of Living Calculator
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Compare how far your salary goes across US cities. We&apos;ll show
          the equivalent salary plus a per-category breakdown of housing,
          groceries, transportation, and more.
        </p>
      </section>

      <CalculatorClient
        cities={cities}
        initialFrom={sp.from}
        initialTo={sp.to}
        initialSalary={
          salary != null && Number.isFinite(salary) ? salary : undefined
        }
      />

      <section className="mt-20 grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            How it works
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Your equivalent salary is computed from the ratio of the two
            cities&apos; cost-of-living indices, so a higher index means you
            need proportionally more income to maintain the same standard of
            living.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Category breakdown
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            We weight each category using typical household-spending shares
            (housing 33%, groceries 13%, utilities 7%, transportation 17%,
            healthcare 8%) from BLS Consumer Expenditure Survey data.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            Data sources
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            City-level rent and income figures come from the US Census American
            Community Survey 5-Year estimates. Category indices are derived
            from BLS CPI-U data for each metro, scaled to the US city average.
          </p>
        </div>
      </section>
    </div>
  );
}
