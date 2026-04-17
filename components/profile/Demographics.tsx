import type { CityDemographics } from "@/lib/supabase";

type Props = { demographics: CityDemographics | null };

function pct(n: number | null | undefined, digits = 1) {
  if (n == null) return "—";
  return `${n.toFixed(digits)}%`;
}

function num(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return n.toFixed(digits);
}

export default function Demographics({ demographics }: Props) {
  const cards = [
    {
      label: "Median age",
      value: num(demographics?.median_age, 1),
      unit: "years",
    },
    {
      label: "Unemployment rate",
      value: pct(demographics?.unemployment_rate),
    },
    { label: "Poverty rate", value: pct(demographics?.poverty_rate) },
    {
      label: "College educated",
      value: pct(demographics?.college_educated_pct),
      sub: "bachelor's or higher",
    },
    {
      label: "Average commute",
      value: num(demographics?.commute_time_avg, 0),
      unit: "minutes",
    },
  ];

  return (
    <dl className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <dt className="text-xs uppercase tracking-widest text-[var(--muted)]">
            {c.label}
          </dt>
          <dd className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums">
              {c.value}
            </span>
            {"unit" in c && c.unit && (
              <span className="text-sm text-[var(--muted)]">{c.unit}</span>
            )}
          </dd>
          {"sub" in c && c.sub && (
            <p className="mt-1 text-xs text-[var(--muted)]">{c.sub}</p>
          )}
        </div>
      ))}
    </dl>
  );
}
