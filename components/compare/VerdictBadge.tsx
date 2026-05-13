import type { Verdict } from "@/lib/comparison";

type Props = {
  verdict: Verdict;
  nameA: string;
  nameB: string;
};

export default function VerdictBadge({ verdict, nameA, nameB }: Props) {
  if (verdict.cheaper == null) {
    return (
      <div className="flex rounded-2xl bg-[var(--border)] px-6 py-4 text-[var(--muted)]">
        Not enough data to compare these cities yet.
      </div>
    );
  }

  if (verdict.cheaper === "tie") {
    return (
      <div className="flex flex-col gap-1 rounded-2xl bg-amber-100 px-6 py-4 text-amber-900">
        <span className="text-xs font-semibold uppercase tracking-widest">
          Verdict
        </span>
        <span className="text-2xl font-semibold">
          {nameA} and {nameB} cost about the same
        </span>
      </div>
    );
  }

  const cheaper = verdict.cheaper === "a" ? nameA : nameB;
  const pricier = verdict.cheaper === "a" ? nameB : nameA;

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-emerald-100 px-6 py-4 text-emerald-900">
      <span className="text-xs font-semibold uppercase tracking-widest">
        Verdict
      </span>
      <span className="text-2xl md:text-3xl font-semibold leading-tight">
        {cheaper} is{" "}
        <span className="tabular-nums">{verdict.percent?.toFixed(0)}%</span>{" "}
        cheaper than {pricier}
      </span>
    </div>
  );
}
