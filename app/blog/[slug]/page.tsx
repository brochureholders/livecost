import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import {
  allSlugs,
  articlesByDate,
  getArticle,
} from "@/content/blog";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const revalidate = 86400;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return allSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    return {
      title: "Article not found — UrbRank",
      robots: { index: false, follow: false },
    };
  }
  const { meta } = article;
  return {
    title: meta.seoTitle,
    description: meta.description,
    alternates: { canonical: `/blog/${meta.slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "article",
      publishedTime: meta.published,
      modifiedTime: meta.updated ?? meta.published,
      authors: [meta.author],
    },
  };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const { meta, Body } = article;

  const related = articlesByDate
    .filter((a) => a.meta.slug !== meta.slug)
    .slice(0, 3);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    author: [
      {
        "@type": "Organization",
        name: meta.author,
      },
    ],
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    datePublished: meta.published,
    dateModified: meta.updated ?? meta.published,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${meta.slug}`,
    },
    keywords: meta.tags.join(", "),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "/blog" },
      { "@type": "ListItem", position: 3, name: meta.title },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/blog" className="hover:text-[var(--foreground)]">
              Blog
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium truncate">
            {meta.title}
          </li>
        </ol>
      </nav>

      <article className="mt-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            {meta.tags.slice(0, 2).join(" · ")}
          </p>
          <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
            {meta.title}
          </h1>
          <p className="mt-4 text-lg text-[var(--muted)] leading-relaxed">
            {meta.summary}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)] border-b border-[var(--border)] pb-5">
            <span>{meta.author}</span>
            <span aria-hidden>·</span>
            <time dateTime={meta.published}>
              {new Date(meta.published).toLocaleDateString("en-US", DATE_FORMAT)}
            </time>
            <span aria-hidden>·</span>
            <span>{meta.readingMinutes} min read</span>
          </div>
        </header>

        <div className="prose-article mt-10">
          <Body />
        </div>
      </article>

      <AdSlot name="blog-post-end" pathname={`/blog/${meta.slug}`} />

      {related.length > 0 && (
        <aside className="mt-16 border-t border-[var(--border)] pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
            More reading
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {related.map(({ meta: r }) => (
              <li key={r.slug}>
                <Link
                  href={`/blog/${r.slug}`}
                  className="group block h-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] transition-colors"
                >
                  <h3 className="text-base font-semibold tracking-tight leading-snug">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {r.readingMinutes} min read
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
