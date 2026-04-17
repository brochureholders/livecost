import type { CityProfile } from "@/lib/cities";
import { verdict, equivalentSalary } from "@/lib/comparison";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type Props = { a: CityProfile; b: CityProfile };

export default function ComparisonSummary({ a, b }: Props) {
  const v = verdict(a.costs?.cost_index, b.costs?.cost_index);

  const sentences: string[] = [];

  if (v.cheaper === "a") {
    sentences.push(
      `${a.name}, ${a.state_code} is about ${v.percent}% cheaper overall than ${b.name}, ${b.state_code}, based on our cost-of-living index.`,
    );
  } else if (v.cheaper === "b") {
    sentences.push(
      `${b.name}, ${b.state_code} is about ${v.percent}% cheaper overall than ${a.name}, ${a.state_code}, based on our cost-of-living index.`,
    );
  } else if (v.cheaper === "tie") {
    sentences.push(
      `${a.name} and ${b.name} have nearly identical overall cost-of-living indices.`,
    );
  }

  // Housing
  const hA = a.costs?.housing_index;
  const hB = b.costs?.housing_index;
  if (hA != null && hB != null && Math.abs(hA - hB) >= 2) {
    const cheaperHousing = hA < hB ? a.name : b.name;
    const pricierHousing = hA < hB ? b.name : a.name;
    const diff = Math.abs(hA - hB) / Math.max(hA, hB) * 100;
    sentences.push(
      `Housing costs are roughly ${diff.toFixed(0)}% lower in ${cheaperHousing} than in ${pricierHousing}.`,
    );
  }

  // Salary equivalence example
  const example = 80_000;
  const equiv = equivalentSalary(
    example,
    a.costs?.cost_index,
    b.costs?.cost_index,
  );
  if (equiv != null) {
    sentences.push(
      `If you earn ${CURRENCY.format(example)} in ${a.name}, you'd need about ${CURRENCY.format(equiv)} in ${b.name} to keep the same standard of living.`,
    );
  }

  if (sentences.length === 0) {
    sentences.push(
      `We don't yet have enough data to summarize the difference between ${a.name} and ${b.name}.`,
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
        Summary
      </h3>
      <p className="mt-3 text-lg leading-relaxed">{sentences.join(" ")}</p>
    </div>
  );
}
