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
};

export default nextConfig;
