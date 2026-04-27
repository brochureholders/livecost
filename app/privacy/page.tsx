import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — UrbRank",
  description:
    "What UrbRank logs and what we don't. No cookies, no ads, no third-party trackers — just lightweight pageview counts.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "UrbRank Privacy",
    description:
      "What we log, what we don't, and how to opt out.",
    type: "article",
  },
};

export default function PrivacyPage() {
  const lastUpdated = "April 2026";

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
          <li className="text-[var(--foreground)] font-medium">Privacy</li>
        </ol>
      </nav>

      <section className="mt-8 md:mt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--accent)]">
          Privacy
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          What we log, and what we don&apos;t
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Last updated {lastUpdated}.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          The short version
        </h2>
        <p>
          UrbRank logs pageviews so we can tell which pages are useful. We
          don&apos;t set cookies, we don&apos;t run ad networks, we
          don&apos;t fingerprint your browser, and we don&apos;t use
          Google Analytics or Facebook Pixel. We do use one third-party
          analytics tool — Ahrefs Web Analytics — which is cookieless and
          doesn&apos;t identify individual visitors. Details below. There
          is no account system, so we never collect a name, email, or
          password.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          What our internal pageview log records
        </h2>
        <p className="text-[var(--muted)]">
          On every page load we send one row to our own database. That row
          contains:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-[var(--muted)]">
          <li>
            <span className="text-[var(--foreground)] font-medium">
              The page path
            </span>{" "}
            (e.g.{" "}
            <code className="text-xs">/compare/austin-tx-vs-denver-co</code>)
            — without query strings or fragments.
          </li>
          <li>
            <span className="text-[var(--foreground)] font-medium">
              The referrer
            </span>{" "}
            — the URL of the page that linked you here, if your browser
            sent one.
          </li>
          <li>
            <span className="text-[var(--foreground)] font-medium">
              Your user-agent string
            </span>{" "}
            — the standard browser/OS identifier that every HTTP request
            includes.
          </li>
          <li>
            <span className="text-[var(--foreground)] font-medium">
              Country code
            </span>{" "}
            — derived from CDN headers (Vercel / Cloudflare). We do not
            store your IP address.
          </li>
        </ul>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          What we explicitly don&apos;t collect
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--muted)]">
          <li>Cookies of any kind, including consent cookies</li>
          <li>Browser fingerprints (canvas, fonts, etc.)</li>
          <li>Mouse/scroll/click heatmap data</li>
          <li>Names, emails, or passwords (there&apos;s no account system)</li>
          <li>
            Anything submitted to the calculator or quiz beyond what&apos;s
            needed to compute the result on your screen — quiz answers
            stay in your browser
          </li>
        </ul>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ahrefs Web Analytics
        </h2>
        <p>
          Every page on UrbRank loads a small JavaScript snippet from{" "}
          <a
            href="https://ahrefs.com/web-analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            Ahrefs Web Analytics
          </a>
          . We use it to see which pages get visited and where visitors
          come from — the same purpose as our internal pageview log, but
          with more reliable measurement.
        </p>
        <p>
          Ahrefs Web Analytics is designed to be privacy-friendly and is
          GDPR-compliant by default. Per their published policy:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-[var(--muted)]">
          <li>It does not set cookies or use local storage.</li>
          <li>It does not store IP addresses (they are anonymized).</li>
          <li>
            It collects pageview path, referrer, anonymized country,
            device type, and browser — no individual identifiers.
          </li>
          <li>
            It does not build cross-site profiles and does not feed an
            advertising network.
          </li>
        </ul>
        <p>
          If you&apos;d rather not be counted, ad blockers and privacy
          extensions block <code className="text-xs">analytics.ahrefs.com</code>{" "}
          out of the box. Disabling JavaScript also prevents any data
          from being sent.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Where the data goes
        </h2>
        <p>
          Pageview rows are stored in our Supabase database (US region) and
          accessed only by us. We don&apos;t sell or share them. Aggregated
          stats may inform what we work on next; individual rows are not
          published.
        </p>
        <p>
          The calculator and quiz run entirely in your browser. No salary
          numbers or quiz answers are transmitted to our servers; reload
          the page and they&apos;re gone unless you bookmarked the URL
          (the URL itself encodes calculator inputs so you can share a
          link, but it&apos;s not stored on our side).
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Opting out
        </h2>
        <p>
          Pageview logging uses{" "}
          <code className="text-xs">navigator.sendBeacon</code>. Disabling
          JavaScript or using a tracker-blocking extension prevents any
          pageview from being recorded. Most ad blockers and privacy
          extensions block our pageview endpoint by default.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Third parties
        </h2>
        <p>The full list of third parties UrbRank relies on:</p>
        <ul className="list-disc pl-6 space-y-2 text-[var(--muted)]">
          <li>
            <span className="text-[var(--foreground)] font-medium">
              Vercel
            </span>{" "}
            — hosts the site. Sees raw HTTP requests including IP at the
            infrastructure layer.
          </li>
          <li>
            <span className="text-[var(--foreground)] font-medium">
              Supabase
            </span>{" "}
            — runs our database (US region). Stores the pageview rows
            described above.
          </li>
          <li>
            <span className="text-[var(--foreground)] font-medium">
              Ahrefs Web Analytics
            </span>{" "}
            — cookieless, IP-anonymized analytics, as described in the
            section above.
          </li>
        </ul>
        <p>
          That&apos;s the entire list. We don&apos;t use Google
          Analytics, Facebook Pixel, ad networks, A/B-testing services,
          or session recorders.
        </p>
      </section>

      <section className="mt-12 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight">
          Changes to this page
        </h2>
        <p>
          If we change what we log, we&apos;ll update this page and bump
          the &quot;Last updated&quot; date. We won&apos;t introduce
          third-party trackers without saying so here first.
        </p>
        <p>
          Questions or concerns? See the{" "}
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
