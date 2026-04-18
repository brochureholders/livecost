import type { CityProfile } from "@/lib/cities";

type Props = { a: CityProfile; b: CityProfile };

function num(n: number | null | undefined, digits = 0, unit = "") {
  if (n == null) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
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
      title: "Demographics",
      rows: [
        {
          label: "Median age",
          aValue: num(a.demographics?.median_age, 1),
          bValue: num(b.demographics?.median_age, 1),
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
        {
          label: "College educated",
          aValue: pct(a.demographics?.college_educated_pct),
          bValue: pct(b.demographics?.college_educated_pct),
        },
        {
          label: "Avg commute (min)",
          aValue: num(a.demographics?.commute_time_avg, 0),
          bValue: num(b.demographics?.commute_time_avg, 0),
        },
      ],
    },
  ];

  const populated = sections.filter((s) =>
    s.rows.some((r) => r.aValue !== "—" || r.bValue !== "—"),
  );
  if (populated.length === 0) return null;

  const gridCols =
    populated.length >= 3
      ? "md:grid-cols-3"
      : populated.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";

  return (
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
  );
}
