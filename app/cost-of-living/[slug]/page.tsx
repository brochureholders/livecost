import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCityBySlug,
  getOtherCitiesInState,
  getTopCitySlugs,
} from "@/lib/cities";
import AffordabilityBadge from "@/components/profile/AffordabilityBadge";
import Breadcrumbs from "@/components/profile/Breadcrumbs";
import CompareSection from "@/components/profile/CompareSection";
import CostBreakdownChart from "@/components/profile/CostBreakdownChart";
import Demographics from "@/components/profile/Demographics";
import FAQ from "@/components/profile/FAQ";
import KeyStats from "@/components/profile/KeyStats";
import OtherCitiesInState from "@/components/profile/OtherCitiesInState";
import QualityOfLife from "@/components/profile/QualityOfLife";
import SalaryCalculator from "@/components/profile/SalaryCalculator";

export const revalidate = 86400; // ISR: refresh daily

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await getTopCitySlugs(500);
  return slugs.map((slug) => ({ slug }));
}

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) {
    return {
      title: "City not found — UrbRank",
      robots: { index: false, follow: false },
    };
  }

  const costs = city.costs;
  const year = costs?.year ?? new Date().getFullYear();
  const index = costs?.cost_index;
  const direction =
    index != null && index >= 100 ? "above" : index != null ? "below" : null;
  const diff =
    index != null ? Math.abs(index - 100).toFixed(0) : null;

  const rent = costs?.median_rent != null ? CURRENCY.format(costs.median_rent) : "—";
  const income =
    costs?.median_household_income != null
      ? CURRENCY.format(costs.median_household_income)
      : "—";

  const vsNational =
    index != null && direction && diff
      ? `${diff}% ${direction} the national average.`
      : "calculated from Census and BLS data.";

  return {
    title: `Cost of Living in ${city.name}, ${city.state} (${year}) — Housing, Salary & More | UrbRank`,
    description: `The cost of living in ${city.name}, ${city.state} is ${vsNational} Median rent: ${rent}/mo. Median income: ${income}. Compare with other cities.`,
    alternates: { canonical: `/cost-of-living/${slug}` },
    openGraph: {
      title: `Cost of Living in ${city.name}, ${city.state} (${year})`,
      description: `Housing, salary, demographics, and quality of life in ${city.name}. ${vsNational}`,
      type: "article",
    },
  };
}

export default async function CityProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) notFound();

  const others = await getOtherCitiesInState(city.state_code, city.id, 12);

  const costs = city.costs;
  const categories = [
    { label: "Housing", value: costs?.housing_index ?? null },
    { label: "Groceries", value: costs?.grocery_index ?? null },
    { label: "Utilities", value: costs?.utilities_index ?? null },
    { label: "Transportation", value: costs?.transportation_index ?? null },
    { label: "Healthcare", value: costs?.healthcare_index ?? null },
  ];

  const comparisonSuggestions = others.slice(0, 6).map((o) => ({
    slug: `${city.slug}-vs-${o.slug}`,
    label: `${city.name} vs ${o.name}`,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <Breadcrumbs
        stateName={city.state}
        stateCode={city.state_code}
        cityName={city.name}
      />

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Cost of Living
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          {city.name}, {city.state_code}
        </h1>
        {city.metro_area && (
          <p className="mt-2 text-[var(--muted)]">
            Part of the {city.metro_area} metro area
          </p>
        )}
        <div className="mt-8">
          <AffordabilityBadge index={costs?.cost_index ?? null} />
        </div>
      </section>

      <section className="mt-10 md:mt-14">
        <KeyStats
          population={city.population}
          medianIncome={costs?.median_household_income ?? null}
          medianRent={costs?.median_rent ?? null}
          medianHomeValue={costs?.median_home_value ?? null}
        />
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Cost breakdown
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          How {city.name}&apos;s prices compare to the US city average across
          major spending categories.
        </p>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
          <CostBreakdownChart categories={categories} />
        </div>
      </section>

      <section className="mt-16">
        <SalaryCalculator
          cityName={city.name}
          state={city.state_code}
          costIndex={costs?.cost_index ?? null}
        />
      </section>

      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Who lives in {city.name}
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Demographics and workforce data from the US Census ACS 5-Year.
        </p>
        <div className="mt-6">
          <Demographics demographics={city.demographics} />
        </div>
      </section>

      {city.quality && (
        <section className="mt-16">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Quality of life
          </h2>
          <p className="mt-2 text-[var(--muted)]">
            Climate, safety, and walkability indicators.
          </p>
          <div className="mt-6">
            <QualityOfLife quality={city.quality} />
          </div>
        </section>
      )}

      <section className="mt-16">
        <CompareSection
          cityName={city.name}
          citySlug={city.slug}
          suggestions={comparisonSuggestions}
        />
      </section>

      <section className="mt-16">
        <OtherCitiesInState stateName={city.state} cities={others} />
      </section>

      <section className="mt-16">
        <FAQ
          cityName={city.name}
          state={city.state}
          costIndex={costs?.cost_index ?? null}
          medianRent={costs?.median_rent ?? null}
          medianIncome={costs?.median_household_income ?? null}
        />
      </section>
    </div>
  );
}
