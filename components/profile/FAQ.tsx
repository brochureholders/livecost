type Props = {
  cityName: string;
  state: string;
  costIndex: number | null;
  medianRent: number | null;
  medianIncome: number | null;
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function buildAnswers({ cityName, state, costIndex, medianRent, medianIncome }: Props) {
  const vs =
    costIndex == null
      ? null
      : costIndex > 100
        ? `${(costIndex - 100).toFixed(0)}% above the national average`
        : costIndex < 100
          ? `${(100 - costIndex).toFixed(0)}% below the national average`
          : "exactly at the national average";

  const tier =
    costIndex == null
      ? "We don't yet have enough data to classify"
      : costIndex < 95
        ? "cheaper than most US cities"
        : costIndex <= 110
          ? "near the US city average"
          : "more expensive than most US cities";

  const rentLine =
    medianRent != null
      ? `The typical renter pays ${CURRENCY.format(medianRent)} per month.`
      : "";
  const incomeLine =
    medianIncome != null
      ? `The median household earns ${CURRENCY.format(medianIncome)} per year.`
      : "";

  const recommendedSalary =
    costIndex != null ? Math.round(70_000 * (costIndex / 100)) : null;

  return [
    {
      q: `What is the cost of living in ${cityName}, ${state}?`,
      a: `${cityName}, ${state} has a cost-of-living index of ${costIndex != null ? costIndex.toFixed(0) : "—"}, ${vs ? `which is ${vs}` : "insufficient data to compare"}. ${rentLine} ${incomeLine}`.trim(),
    },
    {
      q: `What salary do you need to live in ${cityName}?`,
      a:
        recommendedSalary != null
          ? `To match the lifestyle of a ${CURRENCY.format(70_000)} earner in the average US city, you'd need about ${CURRENCY.format(recommendedSalary)} per year in ${cityName}. Single renters typically want at least three times the ${medianRent != null ? CURRENCY.format(medianRent * 12) : "annual rent"} threshold to cover housing comfortably.`
          : `Salary estimates depend on a cost-of-living index, which we don't have for ${cityName} yet. As a rough rule, plan on spending no more than 30% of your gross income on housing.`,
    },
    {
      q: `Is ${cityName} expensive?`,
      a: `${cityName} is ${tier}. ${vs ? `Overall prices are ${vs}.` : ""}`.trim(),
    },
  ];
}

export default function FAQ(props: Props) {
  const items = buildAnswers(props);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Frequently asked questions
      </h2>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mt-6 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {items.map((item, i) => (
          <details key={i} className="group p-6">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
              <h3 className="text-base font-semibold tracking-tight">
                {item.q}
              </h3>
              <span
                aria-hidden
                className="mt-1 text-[var(--muted)] transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
