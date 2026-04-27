import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About UrbRank — How We Score and Compare US Cities",
  description:
    "UrbRank ranks every major US city on cost of living, housing, salary, climate, safety, and quality of life — using public data from the US Census, BLS, BEA, EPA, FBI, and others.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About UrbRank",
    description:
      "Independent, data-driven city rankings and comparisons built on public US datasets.",
    type: "article",
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">About</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          About
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          What UrbRank is for
        </h1>
        <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed">
          UrbRank helps you decide where to live. We score every major US city
          across seven dimensions — affordability, safety, climate,
          walkability, jobs, environment, and education — and let you compare
          any two cities side by side, calculate equivalent salaries, or
          browse rankings tailored to families, retirees, remote workers, and
          young professionals.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Who this is for
        </h2>
        <p>
          People weighing a move, a job offer, or a remote-work relocation.
          We focus on the questions you actually ask in those moments: how
          much does rent actually cost, would my salary go further, what's
          the climate like, is the area safe.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          How we&apos;re different
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--muted)]">
          <li>
            <span className="text-[var(--foreground)] font-medium">
              Public-data only.
            </span>{" "}
            Every number on this site comes from a named federal or
            municipal source — no proprietary surveys, no opaque scoring
            black boxes. See{" "}
            <Link
              href="/methodology"
              className="text-[var(--accent)] hover:underline"
            >
              Methodology
            </Link>{" "}
            for the full list.
          </li>
          <li>
            <span className="text-[var(--foreground)] font-medium">
              Honest about gaps.
            </span>{" "}
            When the FBI Crime API is down, we say so on the page rather
            than rendering an empty cell.
          </li>
          <li>
            <span className="text-[var(--foreground)] font-medium">
              No tracking pixels, no ads.
            </span>{" "}
            We log pageview paths and nothing else. Details on the{" "}
            <Link
              href="/privacy"
              className="text-[var(--accent)] hover:underline"
            >
              Privacy
            </Link>{" "}
            page.
          </li>
        </ul>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          A note on accuracy
        </h2>
        <p>
          The data behind UrbRank is good but not perfect. Census ACS figures
          run a year or two behind, climate normals smooth out unusual years,
          and city-level boundaries don&apos;t always match the metro you
          have in mind. We surface vintage years on every comparison and
          flag low-coverage cities so you can read with appropriate
          skepticism.
        </p>
        <p>
          Spotted a number that looks wrong? Tell us — see the{" "}
          <Link
            href="/contact"
            className="text-[var(--accent)] hover:underline"
          >
            Contact
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}
