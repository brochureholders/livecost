import type { CityProfile } from "@/lib/cities";

type Props = { a: CityProfile; b: CityProfile };

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function num(n: number | null | undefined, digits = 0, unit = "") {
  if (n == null) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

function pctSigned(n: number | null | undefined) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function money(n: number | null | undefined) {
  if (n == null) return "—";
  return CURRENCY.format(n);
}

function index100(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toFixed(0);
}

export default function QualitySideBySide({ a, b }: Props) {
  const sections: {
    title: string;
    rows: { label: string; aValue: string; bValue: string }[];
  }[] = [
    {
      title: "Climate",
      rows: [
        {
          label: "Summer avg",
          aValue: num(a.quality?.avg_temp_summer, 0, "°F"),
          bValue: num(b.quality?.avg_temp_summer, 0, "°F"),
        },
        {
          label: "Winter avg",
          aValue: num(a.quality?.avg_temp_winter, 0, "°F"),
          bValue: num(b.quality?.avg_temp_winter, 0, "°F"),
        },
        {
          label: "Annual rainfall",
          aValue: num(a.quality?.annual_precipitation, 0, '"'),
          bValue: num(b.quality?.annual_precipitation, 0, '"'),
        },
        {
          label: "Sunny days",
          aValue: num(a.quality?.sunshine_days, 0, "/yr"),
          bValue: num(b.quality?.sunshine_days, 0, "/yr"),
        },
      ],
    },
    {
      title: "Safety",
      rows: [
        {
          label: "Crime per 100k",
          aValue: num(a.quality?.crime_rate_per_100k, 0),
          bValue: num(b.quality?.crime_rate_per_100k, 0),
        },
        {
          label: "Violent crime rate",
          aValue: num(a.quality?.violent_crime_rate, 1),
          bValue: num(b.quality?.violent_crime_rate, 1),
        },
        {
          label: "Property crime rate",
          aValue: num(a.quality?.property_crime_rate, 1),
          bValue: num(b.quality?.property_crime_rate, 1),
        },
      ],
    },
    {
      title: "Livability",
      rows: [
        {
          label: "Walk Score",
          aValue: num(a.quality?.walk_score, 0, "/100"),
          bValue: num(b.quality?.walk_score, 0, "/100"),
        },
        {
          label: "Transit Score",
          aValue: num(a.quality?.transit_score, 0, "/100"),
          bValue: num(b.quality?.transit_score, 0, "/100"),
        },
        {
          label: "Bike Score",
          aValue: num(a.quality?.bike_score, 0, "/100"),
          bValue: num(b.quality?.bike_score, 0, "/100"),
        },
      ],
    },
    {
      title: "Demographics",
      rows: [
        {
          label: "Population",
          aValue: a.population != null ? a.population.toLocaleString() : "—",
          bValue: b.population != null ? b.population.toLocaleString() : "—",
        },
        {
          label: "Median age",
          aValue: num(a.demographics?.median_age, 1),
          bValue: num(b.demographics?.median_age, 1),
        },
        {
          label: "College educated",
          aValue: pct(a.demographics?.college_educated_pct),
          bValue: pct(b.demographics?.college_educated_pct),
        },
        {
          label: "Avg commute",
          aValue: num(a.demographics?.commute_time_avg, 0, " min"),
          bValue: num(b.demographics?.commute_time_avg, 0, " min"),
        },
        {
          label: "Population growth",
          aValue: pctSigned(a.demographics?.population_growth_pct),
          bValue: pctSigned(b.demographics?.population_growth_pct),
        },
      ],
    },
    {
      title: "Economy",
      rows: [
        {
          label: "Median income",
          aValue: money(a.costs?.median_household_income),
          bValue: money(b.costs?.median_household_income),
        },
        {
          label: "Unemployment",
          aValue: pct(a.demographics?.unemployment_rate),
          bValue: pct(b.demographics?.unemployment_rate),
        },
        {
          label: "Poverty rate",
          aValue: pct(a.demographics?.poverty_rate),
          bValue: pct(b.demographics?.poverty_rate),
        },
      ],
    },
    {
      title: "Housing market",
      rows: [
        {
          label: "Median rent",
          aValue:
            a.costs?.median_rent != null
              ? `${money(a.costs.median_rent)}/mo`
              : "—",
          bValue:
            b.costs?.median_rent != null
              ? `${money(b.costs.median_rent)}/mo`
              : "—",
        },
        {
          label: "Median home value",
          aValue: money(a.costs?.median_home_value),
          bValue: money(b.costs?.median_home_value),
        },
        {
          label: "Housing index",
          aValue: index100(a.costs?.housing_index),
          bValue: index100(b.costs?.housing_index),
        },
      ],
    },
  ];

  // Filter rows where BOTH sides are "—" — no signal, just visual noise.
  // Then drop sections that lose all their rows that way.
  const populated = sections
    .map((s) => ({
      ...s,
      rows: s.rows.filter((r) => r.aValue !== "—" || r.bValue !== "—"),
    }))
    .filter((s) => s.rows.length > 0);
  if (populated.length === 0) return null;

  const gridCols =
    populated.length >= 3
      ? "md:grid-cols-3"
      : populated.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";

  // Quality + demographics + costs ride on different Supabase tables with
  // their own year columns; show the latest of each side so a stale row
  // doesn't fly under the radar.
  const yearA =
    Math.max(
      a.quality?.year ?? 0,
      a.demographics?.year ?? 0,
      a.costs?.year ?? 0,
    ) || null;
  const yearB =
    Math.max(
      b.quality?.year ?? 0,
      b.demographics?.year ?? 0,
      b.costs?.year ?? 0,
    ) || null;
  const yearGap = yearA != null && yearB != null ? Math.abs(yearA - yearB) : 0;

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {populated.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
              {section.title}
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              {section.rows.map((row) => (
                <div key={row.label} className="grid grid-cols-3 gap-2">
                  <dt className="col-span-1 text-[var(--muted)]">{row.label}</dt>
                  <dd className="col-span-1 tabular-nums text-right">
                    {row.aValue}
                  </dd>
                  <dd className="col-span-1 tabular-nums text-right">
                    {row.bValue}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-2">
              <span />
              <span className="text-right">{a.name}</span>
              <span className="text-right">{b.name}</span>
            </div>
          </div>
        ))}
      </div>
      {(yearA != null || yearB != null) && (
        <div
          className={`rounded-xl border px-5 py-3 text-xs ${
            yearGap >= 2
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          {yearGap >= 2
            ? `Heads up: data vintages differ by ${yearGap} years — ${a.name} ${yearA}, ${b.name} ${yearB}. Compare with caution.`
            : yearA === yearB
              ? `Data year: ${yearA}.`
              : `Data year: ${a.name} ${yearA ?? "—"}, ${b.name} ${yearB ?? "—"}.`}
        </div>
      )}
    </div>
  );
}
