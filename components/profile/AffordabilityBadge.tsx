type Props = { index: number | null };

function tier(index: number | null) {
  if (index == null) {
    return {
      label: "No data",
      bg: "bg-[var(--border)]",
      fg: "text-[var(--muted)]",
      description: "insufficient data",
    };
  }
  if (index < 95) {
    return {
      label: "Affordable",
      bg: "bg-emerald-100",
      fg: "text-emerald-900",
      description: `${100 - index}% below national average`,
    };
  }
  if (index <= 110) {
    return {
      label: "Near Average",
      bg: "bg-amber-100",
      fg: "text-amber-900",
      description:
        index === 100
          ? "at the national average"
          : `${Math.abs(index - 100).toFixed(0)}% ${index > 100 ? "above" : "below"} the national average`,
    };
  }
  return {
    label: "Expensive",
    bg: "bg-red-100",
    fg: "text-red-900",
    description: `${(index - 100).toFixed(0)}% above national average`,
  };
}

export default function AffordabilityBadge({ index }: Props) {
  const t = tier(index);
  return (
    <div
      className={`inline-flex flex-col items-start gap-1 rounded-2xl px-6 py-4 ${t.bg} ${t.fg}`}
    >
      <span className="text-xs font-semibold uppercase tracking-widest">
        Cost of Living
      </span>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-semibold tabular-nums leading-none">
          {index != null ? Math.round(index) : "—"}
        </span>
        <span className="text-lg font-medium">{t.label}</span>
      </div>
      <span className="text-sm opacity-80">{t.description}</span>
    </div>
  );
}
