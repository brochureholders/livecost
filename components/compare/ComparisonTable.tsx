import type { CityProfile } from "@/lib/cities";

type Props = {
  a: CityProfile;
  b: CityProfile;
};

type Row = {
  label: string;
  aValue: number | null;
  bValue: number | null;
  format: "usd" | "usd-month" | "index";
  /** lower value wins? (true for cost indices and rent; false for income) */
  lowerIsBetter: boolean;
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmt(v: number | null, format: Row["format"]): string {
  if (v == null) return "—";
  if (format === "usd") return CURRENCY.format(v);
  if (format === "usd-month") return `${CURRENCY.format(v)}/mo`;
  return v.toFixed(1);
}

function diffLabel(row: Row): {
  text: string;
  winner: "a" | "b" | "tie" | null;
} {
  if (row.aValue == null || row.bValue == null)
    return { text: "—", winner: null };
  const diff = row.aValue - row.bValue;
  if (Math.abs(diff) < (row.format === "index" ? 0.5 : 1)) {
    return { text: "≈ equal", winner: "tie" };
  }
  const pctBase = Math.abs(row.bValue) > 0 ? Math.abs(row.bValue) : 1;
  const pct = Math.abs((diff / pctBase) * 100).toFixed(1);
  const aBigger = diff > 0;
  const aWins = row.lowerIsBetter ? !aBigger : aBigger;
  const verb = aBigger ? "higher" : "lower";
  return {
    text: `${pct}% ${verb} in A`,
    winner: aWins ? "a" : "b",
  };
}

export default function ComparisonTable({ a, b }: Props) {
  const ca = a.costs;
  const cb = b.costs;
  const rows: Row[] = [
    {
      label: "Median rent",
      aValue: ca?.median_rent ?? null,
      bValue: cb?.median_rent ?? null,
      format: "usd-month",
      lowerIsBetter: true,
    },
    {
      label: "Median home value",
      aValue: ca?.median_home_value ?? null,
      bValue: cb?.median_home_value ?? null,
      format: "usd",
      lowerIsBetter: true,
    },
    {
      label: "Median household income",
      aValue: ca?.median_household_income ?? null,
      bValue: cb?.median_household_income ?? null,
      format: "usd",
      lowerIsBetter: false,
    },
    {
      label: "Groceries index",
      aValue: ca?.grocery_index ?? null,
      bValue: cb?.grocery_index ?? null,
      format: "index",
      lowerIsBetter: true,
    },
    {
      label: "Utilities index",
      aValue: ca?.utilities_index ?? null,
      bValue: cb?.utilities_index ?? null,
      format: "index",
      lowerIsBetter: true,
    },
    {
      label: "Transportation index",
      aValue: ca?.transportation_index ?? null,
      bValue: cb?.transportation_index ?? null,
      format: "index",
      lowerIsBetter: true,
    },
    {
      label: "Healthcare index",
      aValue: ca?.healthcare_index ?? null,
      bValue: cb?.healthcare_index ?? null,
      format: "index",
      lowerIsBetter: true,
    },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--background)] text-left text-[var(--muted)]">
          <tr>
            <th className="px-5 py-3 font-medium">Metric</th>
            <th className="px-5 py-3 font-medium">{a.name}</th>
            <th className="px-5 py-3 font-medium">{b.name}</th>
            <th className="px-5 py-3 font-medium">Difference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const d = diffLabel(row);
            return (
              <tr key={row.label}>
                <td className="px-5 py-3 font-medium">{row.label}</td>
                <td
                  className={`px-5 py-3 tabular-nums ${d.winner === "a" ? "text-emerald-700 font-semibold" : ""}`}
                >
                  {fmt(row.aValue, row.format)}
                </td>
                <td
                  className={`px-5 py-3 tabular-nums ${d.winner === "b" ? "text-emerald-700 font-semibold" : ""}`}
                >
                  {fmt(row.bValue, row.format)}
                </td>
                <td className="px-5 py-3 text-[var(--muted)] tabular-nums">
                  {d.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
