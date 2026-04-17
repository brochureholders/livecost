"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
        We hit an error loading this page
      </h1>
      <p className="mt-4 text-[var(--muted)]">
        Try again, or head back to the homepage. If this keeps happening the
        issue is on our end — we&apos;re automatically notified.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="h-11 px-5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="h-11 px-5 inline-flex items-center rounded-lg border border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
        >
          Back to home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-[var(--muted)] font-mono">
          ref: {error.digest}
        </p>
      )}
    </div>
  );
}
