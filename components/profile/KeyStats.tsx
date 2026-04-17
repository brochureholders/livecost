type Stat = { label: string; value: string; sub?: string };

function formatNumber(n: number | null | undefined, opts: Intl.NumberFormatOptions = {}) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", opts).format(n);
}

function formatPopulation(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

type Props = {
  population: number | null;
  medianIncome: number | null;
  medianRent: number | null;
  medianHomeValue: number | null;
};

export default function KeyStats({
  population,
  medianIncome,
  medianRent,
  medianHomeValue,
}: Props) {
  const stats: Stat[] = [
    { label: "Population", value: formatPopulation(population) },
    {
      label: "Median household income",
      value: `$${formatNumber(medianIncome, { maximumFractionDigits: 0 })}`,
      sub: "per year",
    },
    {
      label: "Median rent",
      value: `$${formatNumber(medianRent, { maximumFractionDigits: 0 })}`,
      sub: "per month",
    },
    {
      label: "Median home value",
      value: `$${formatNumber(medianHomeValue, { maximumFractionDigits: 0 })}`,
    },
  ];

  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <dt className="text-xs uppercase tracking-widest text-[var(--muted)]">
            {s.label}
          </dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</dd>
          {s.sub && (
            <p className="mt-1 text-xs text-[var(--muted)]">{s.sub}</p>
          )}
        </div>
      ))}
    </dl>
  );
}
