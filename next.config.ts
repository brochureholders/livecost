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
    ];
  },
};

export default nextConfig;
