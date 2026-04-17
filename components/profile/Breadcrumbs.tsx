import Link from "next/link";

type Props = {
  stateName: string;
  stateCode: string;
  cityName: string;
};

export default function Breadcrumbs({ stateName, stateCode, cityName }: Props) {
  const items = [
    { href: "/", label: "Home" },
    { href: "/cost-of-living", label: "Cost of Living" },
    {
      href: `/cost-of-living?state=${stateCode}`,
      label: stateName,
    },
    { href: null, label: cityName },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--foreground)] font-medium">
                {item.label}
              </span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
