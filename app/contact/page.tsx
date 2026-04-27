import type { Metadata } from "next";
import Link from "next/link";

const CONTACT_EMAIL = "info@urbrank.com";

export const metadata: Metadata = {
  title: "Contact UrbRank",
  description:
    "Tell us about a number that looks wrong, request a city, suggest a feature, or report a bug. One inbox, no contact form.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact UrbRank",
    description: "How to reach us about data corrections, requests, or bugs.",
    type: "article",
  },
};

export default function ContactPage() {
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
          <li className="text-[var(--foreground)] font-medium">Contact</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Contact
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Tell us what to fix
        </h1>
        <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed">
          One inbox, no contact form. Email is the fastest way to reach us
          and the easiest for you to keep a record of.
        </p>
      </section>

      <section className="mt-10">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent)] text-white px-6 py-4 text-lg font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          {CONTACT_EMAIL}
        </a>
      </section>

      <section className="mt-12 space-y-6 text-base leading-relaxed">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            What to send
          </h2>
          <ul className="mt-4 list-disc pl-6 space-y-2 text-[var(--muted)]">
            <li>
              <span className="text-[var(--foreground)] font-medium">
                Data corrections.
              </span>{" "}
              A number on a page that looks wrong — please include the
              page URL and what value you&apos;d expect, with a source
              if you have one.
            </li>
            <li>
              <span className="text-[var(--foreground)] font-medium">
                Missing cities.
              </span>{" "}
              Tell us which city, and (helpful but not required) the
              state and population.
            </li>
            <li>
              <span className="text-[var(--foreground)] font-medium">
                Feature requests.
              </span>{" "}
              A metric we should add, a comparison we don&apos;t support,
              a chart that&apos;d help you decide.
            </li>
            <li>
              <span className="text-[var(--foreground)] font-medium">
                Bug reports.
              </span>{" "}
              Page URL, browser, what you saw vs what you expected. A
              screenshot helps.
            </li>
            <li>
              <span className="text-[var(--foreground)] font-medium">
                Press, partnerships, or data licensing.
              </span>{" "}
              Same address, please put the topic in the subject.
            </li>
          </ul>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            What we can&apos;t help with
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            We don&apos;t give personalized relocation advice, and
            we&apos;re not real-estate or tax professionals. UrbRank is a
            data tool — for advice tailored to your situation, talk to
            someone licensed.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Response time
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            We aim to read every email and respond within a few business
            days. Data correction reports go to the top of the queue —
            getting the numbers right matters most.
          </p>
        </div>
      </section>

      <section className="mt-12 text-sm text-[var(--muted)]">
        <p>
          Curious how we&apos;re built?{" "}
          <Link
            href="/methodology"
            className="text-[var(--accent)] hover:underline"
          >
            Methodology
          </Link>{" "}
          covers data sources and scoring;{" "}
          <Link
            href="/privacy"
            className="text-[var(--accent)] hover:underline"
          >
            Privacy
          </Link>{" "}
          covers what we log.
        </p>
      </section>
    </div>
  );
}
