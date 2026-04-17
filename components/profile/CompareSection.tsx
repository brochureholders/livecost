import Link from "next/link";

type Props = {
  cityName: string;
  citySlug: string;
  suggestions: { slug: string; label: string }[];
};

export default function CompareSection({ cityName, citySlug, suggestions }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
      <h3 className="text-xl font-semibold tracking-tight">
        Compare {cityName} with…
      </h3>
      <p className="mt-2 text-sm text-[var(--muted)]">
        See a side-by-side breakdown of cost of living, housing, and salaries.
      </p>
      <form
        action="/compare"
        className="mt-5 flex flex-col sm:flex-row gap-3"
      >
        <input type="hidden" name="from" value={citySlug} />
        <label htmlFor="compare-input" className="sr-only">
          Compare with city
        </label>
        <input
          id="compare-input"
          name="to"
          type="text"
          placeholder={`e.g. Austin, TX`}
          className="flex-1 h-11 px-4 rounded-lg border border-[var(--border)] bg-[var(--background)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="h-11 px-5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Compare
        </button>
      </form>

      {suggestions.length > 0 && (
        <>
          <p className="mt-6 text-xs uppercase tracking-widest text-[var(--muted)]">
            Popular comparisons
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/compare/${s.slug}`}
                  className="inline-block rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
