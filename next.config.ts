import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/sitemap-comparisons-:page.xml",
        destination: "/api/sitemap-comparisons/:page",
      },
    ];
  },

  async redirects() {
    // Old ?sort=... rankings URLs → SEO-targeted detail pages. These run at
    // the edge before ISR, so they work even though /rankings is statically
    // rendered and doesn't read query strings in its cache key.
    return [
      {
        source: "/rankings",
        has: [{ type: "query", key: "sort", value: "cheapest" }],
        destination: "/rankings/cheapest-cities",
        permanent: true,
      },
      {
        source: "/rankings",
        has: [{ type: "query", key: "sort", value: "expensive" }],
        destination: "/rankings/most-expensive-cities",
        permanent: true,
      },
      {
        source: "/rankings",
        has: [{ type: "query", key: "sort", value: "income-high" }],
        destination: "/rankings/highest-income-cities",
        permanent: true,
      },
      {
        source: "/rankings",
        has: [{ type: "query", key: "sort", value: "rent-low" }],
        destination: "/rankings/cheapest-rent-cities",
        permanent: true,
      },
      // Old stateless compare slugs (before we canonicalized with state
      // codes) → canonical URLs. Catches existing links and any stray
      // Googlebot hits on the old format.
      {
        source: "/compare/new-york-vs-san-francisco",
        destination: "/compare/new-york-ny-vs-san-francisco-ca",
        permanent: true,
      },
      {
        source: "/compare/austin-vs-denver",
        destination: "/compare/austin-tx-vs-denver-co",
        permanent: true,
      },
      {
        source: "/compare/chicago-vs-nashville",
        destination: "/compare/chicago-il-vs-nashville-tn",
        permanent: true,
      },
      {
        source: "/compare/seattle-vs-portland",
        destination: "/compare/portland-or-vs-seattle-wa",
        permanent: true,
      },
      {
        source: "/compare/miami-vs-atlanta",
        destination: "/compare/atlanta-ga-vs-miami-fl",
        permanent: true,
      },
      {
        source: "/compare/boston-vs-philadelphia",
        destination: "/compare/boston-ma-vs-philadelphia-pa",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
