import type { Metadata } from "next";
import Link from "next/link";
import { articlesByDate } from "@/content/blog";

export const revalidate = 86400;

export const metadata: Metadata = {
  title:
    "LiveCost Blog — Cost of Living Guides, City Comparisons, Salary Advice",
  description:
    "Practical guides on cost of living, salary equivalence, moving between cities, and using our calculator effectively. Updated with Census and BLS data for 2026.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "LiveCost Blog",
    description:
      "Practical guides on cost of living, salary equivalence, and moving between US cities.",
    type: "website",
  },
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

export default function BlogListingPage() {
  const [featured, ...rest] = articlesByDate;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">Blog</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          LiveCost Blog
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Guides, comparisons, and data notes
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          How to read a cost-of-living index, when to trust a salary
          calculator, and where the cheapest places in the US actually are —
          in plain English, with real numbers from Census and BLS data.
        </p>
      </section>

      {featured && (
        <section className="mt-12">
          <Link
            href={`/blog/${featured.meta.slug}`}
            className="group block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 md:p-10 hover:border-[var(--accent)] transition-colors"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
              Featured · {featured.meta.tags[0]}
            </p>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              {featured.meta.title}
            </h2>
            <p className="mt-4 text-lg text-[var(--muted)]">
              {featured.meta.summary}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
              <time dateTime={featured.meta.published}>
                {new Date(featured.meta.published).toLocaleDateString(
                  "en-US",
                  DATE_FORMAT,
                )}
              </time>
              <span aria-hidden>·</span>
              <span>{featured.meta.readingMinutes} min read</span>
              <span aria-hidden>·</span>
              <span className="text-[var(--accent)] group-hover:text-[var(--accent-hover)]">
                Read article →
              </span>
            </div>
          </Link>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
          More articles
        </h2>
        <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {rest.map(({ meta }) => (
            <li key={meta.slug}>
              <Link
                href={`/blog/${meta.slug}`}
                className="group block h-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)] transition-colors"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                  {meta.tags.slice(0, 2).join(" · ")}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight leading-snug">
                  {meta.title}
                </h3>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {meta.summary}
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-[var(--muted)]">
                  <time dateTime={meta.published}>
                    {new Date(meta.published).toLocaleDateString(
                      "en-US",
                      DATE_FORMAT,
                    )}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{meta.readingMinutes} min read</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
