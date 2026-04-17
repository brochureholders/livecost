import Link from "next/link";
import { featuredCities } from "@/data/featured-cities";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
        Error 404
      </p>
      <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 text-lg text-[var(--muted)]">
        The link may be broken, or the city you&apos;re looking for isn&apos;t
        in our dataset yet. Try searching, or jump to a popular profile below.
      </p>

      <form
        action="/compare"
        className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl"
      >
        <label htmlFor="not-found-search" className="sr-only">
          Search cities
        </label>
        <input
          id="not-found-search"
          name="from"
          type="text"
          placeholder="Enter a city, e.g. Austin, TX"
          className="flex-1 h-12 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="h-12 px-6 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Search
        </button>
      </form>

      <div className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
          Popular cities
        </h2>
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {featuredCities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/cost-of-living/${c.slug}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {c.name}, {c.state}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-12 text-sm text-[var(--muted)]">
        Or{" "}
        <Link href="/" className="text-[var(--accent)] hover:underline">
          head back to the homepage
        </Link>
        .
      </p>
    </div>
  );
}
