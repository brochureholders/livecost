"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

type Props = {
  rank: number;
  slug: string;
  name: string;
  stateCode: string;
  score: number;
  grade: string;
  topDimLabel: string | null;
  topDimValue: number | null;
  barColorClass: string;
  textColorClass: string;
};

/**
 * Small client wrapper for a quiz-results city card so we can track clicks
 * (`quiz_result_clicked` event) without converting the parent server
 * component to a client component.
 */
export default function ResultCard({
  rank,
  slug,
  name,
  stateCode,
  score,
  grade,
  topDimLabel,
  topDimValue,
  barColorClass,
  textColorClass,
}: Props) {
  return (
    <Link
      href={`/should-i-move-to/${slug}`}
      onClick={() =>
        track("quiz_result_clicked", { rank, city_slug: slug })
      }
      className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)] transition-colors"
    >
      <div className="w-10 shrink-0 text-center">
        <span className="text-2xl font-semibold tabular-nums text-[var(--muted)]">
          {rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold truncate">
          {name}
          <span className="ml-2 text-sm text-[var(--muted)] font-normal">
            {stateCode}
          </span>
        </div>
        {topDimLabel && topDimValue != null && (
          <div className="text-xs text-[var(--muted)] mt-0.5">
            Especially strong on {topDimLabel.toLowerCase()} ({topDimValue}/100)
          </div>
        )}
        <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className={`h-full rounded-full ${barColorClass}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      <div className="text-right shrink-0 w-20">
        <div
          className={`text-2xl font-semibold tabular-nums ${textColorClass}`}
        >
          {score.toFixed(0)}
        </div>
        <div className="text-xs text-[var(--muted)]">{grade}</div>
      </div>
    </Link>
  );
}
