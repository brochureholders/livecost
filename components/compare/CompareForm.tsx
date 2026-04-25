"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CityOption } from "@/lib/cities";
import { canonicalizePair, formatPair } from "@/lib/comparison";
import { track } from "@/lib/analytics";
import CitySelect from "@/components/calculator/CitySelect";

type Props = {
  cities: CityOption[];
  initialFrom?: string | null;
  initialTo?: string | null;
};

function hasSlug(cities: CityOption[], slug: string | null | undefined) {
  return !!slug && cities.some((c) => c.slug === slug);
}

export default function CompareForm({
  cities,
  initialFrom,
  initialTo,
}: Props) {
  const router = useRouter();

  const [from, setFrom] = useState<string | null>(
    hasSlug(cities, initialFrom) ? (initialFrom as string) : null,
  );
  const [to, setTo] = useState<string | null>(
    hasSlug(cities, initialTo) ? (initialTo as string) : null,
  );
  const [error, setError] = useState<string | null>(null);

  const canCompare = !!from && !!to && from !== to;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) {
      setError("Pick two cities to compare.");
      return;
    }
    if (from === to) {
      setError("Pick two different cities.");
      return;
    }
    const [x, y] = canonicalizePair(from, to);
    track("compare_submitted", { from, to });
    router.push(`/compare/${formatPair(x, y)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <CitySelect
          label="From city"
          cities={cities}
          value={from}
          onChange={(slug) => {
            setFrom(slug);
            setError(null);
          }}
          placeholder="e.g. Austin, TX"
        />
        <CitySelect
          label="To city"
          cities={cities}
          value={to}
          onChange={(slug) => {
            setTo(slug);
            setError(null);
          }}
          placeholder="e.g. Denver, CO"
        />
      </div>

      <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <button
          type="submit"
          disabled={!canCompare}
          className="h-12 px-6 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Compare
        </button>
        {error && (
          <p className="text-sm text-[var(--accent)]">{error}</p>
        )}
      </div>
    </form>
  );
}
