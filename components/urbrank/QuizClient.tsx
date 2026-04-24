"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  QUESTIONS,
  buildWeights,
  encodeWeights,
} from "@/lib/quiz";

export default function QuizClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const total = QUESTIONS.length;
  const q = QUESTIONS[step];
  const progress = ((step + 1) / total) * 100;
  const canGoBack = step > 0;
  const selected = answers[q.id];

  function handlePick(id: string) {
    const next = { ...answers, [q.id]: id };
    setAnswers(next);
    if (step < total - 1) {
      // Small delay so the active style can show before advancing
      setTimeout(() => setStep((s) => s + 1), 150);
    } else {
      setSubmitting(true);
      const weights = buildWeights(next);
      const qs = encodeWeights(weights);
      router.push(`/quiz/results?${qs}`);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 md:py-12">
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            Question {step + 1} of {total}
          </span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
        {q.title}
      </h1>
      {q.subtitle && (
        <p className="mt-2 text-[var(--muted)]">{q.subtitle}</p>
      )}

      <div className="mt-8 space-y-3">
        {q.options.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePick(opt.id)}
              disabled={submitting}
              className={[
                "w-full text-left rounded-xl border px-5 py-4 transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]",
              ].join(" ")}
            >
              <span className="font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={!canGoBack || submitting}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        {submitting && (
          <span className="text-sm text-[var(--muted)]">Ranking cities…</span>
        )}
      </div>
    </div>
  );
}
