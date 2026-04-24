import Link from "next/link";
import { colorForScore } from "@/lib/urbrank-score";
import type { LeaderboardRow } from "@/lib/urbrank-score";

const COLOR_CLASSES: Record<string, { text: string; bar: string }> = {
  emerald: { text: "text-emerald-500", bar: "bg-emerald-500" },
  amber: { text: "text-amber-500", bar: "bg-amber-500" },
  orange: { text: "text-orange-500", bar: "bg-orange-500" },
  red: { text: "text-red-500", bar: "bg-red-500" },
};

type Props = {
  rows: LeaderboardRow[];
  /** Optional: show a different rank (e.g. state rank) instead of national. */
  rankOverride?: (row: LeaderboardRow, i: number) => number;
};

export default function LeaderboardList({ rows, rankOverride }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--muted)]">
        No scored cities available yet for this ranking.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((r, i) => {
        const c = COLOR_CLASSES[colorForScore(r.score)];
        const rank = rankOverride ? rankOverride(r, i) : r.national_rank ?? i + 1;
        return (
          <li key={`${r.city_id}-${r.profile}`}>
            <Link
              href={`/should-i-move-to/${r.slug}`}
              className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)] transition-colors"
            >
              <div className="w-10 shrink-0 text-center">
                <span className="text-xl font-semibold tabular-nums text-[var(--muted)]">
                  {rank}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {r.name}
                  <span className="ml-2 text-sm text-[var(--muted)] font-normal">
                    {r.state_code}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.bar}`}
                    style={{ width: `${r.score}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0 w-20">
                <div className={`text-lg font-semibold tabular-nums ${c.text}`}>
                  {r.score.toFixed(0)}
                </div>
                <div className="text-xs text-[var(--muted)]">{r.grade}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
