import Link from "next/link";
import type { ArticleMeta } from "./types";

export const meta: ArticleMeta = {
  slug: "what-is-cost-of-living-index",
  title: "What Is a Cost of Living Index? A Complete Explanation",
  seoTitle:
    "What Is a Cost of Living Index? How It's Calculated (2026) | UrbRank",
  description:
    "A cost of living index measures how expensive a city is relative to a baseline. Here's how it's built, what 100 means, and where CPI and RPP fit in.",
  author: "UrbRank Team",
  published: "2026-04-20",
  tags: ["index", "methodology", "explainer"],
  readingMinutes: 5,
  summary:
    "What the number actually represents, why 100 is the baseline, and how the underlying data from Census ACS and BLS CPI turns into a single comparable figure.",
};

export function Body() {
  return (
    <>
      <p>
        You&apos;ve probably seen a city labeled &quot;112 on the cost of
        living index&quot; or &quot;83% of the national average&quot; and
        wondered what that actually means. A cost of living index is a
        composite number that compresses the prices of a basket of goods and
        services into a single comparable figure. The scale is relative:
        everything is expressed against a baseline, usually 100.
      </p>
      <p>
        This is a short, practical explainer of how the index is built, how
        to read it, and where it falls short — so you can use it as a signal
        rather than a verdict.
      </p>

      <h2>The baseline is always 100</h2>
      <p>
        By convention, the US national average is 100. A city at 120 is 20%
        more expensive overall; a city at 85 is 15% cheaper. The percentage
        reads directly off the index — that&apos;s the whole point of
        normalizing to 100.
      </p>
      <p>
        Some datasets use a specific metro as the baseline instead of the
        national average (say, Washington DC = 100), but the math is the
        same. Always check what the &quot;100&quot; in a specific dataset
        represents before comparing two numbers.
      </p>

      <h2>What goes into the index</h2>
      <p>
        A cost of living index is a weighted average of category prices. The
        specific weights come from the{" "}
        <a href="https://www.bls.gov/cex/" target="_blank" rel="noopener">
          BLS Consumer Expenditure Survey
        </a>
        , which tracks what typical households actually spend. The weights
        shift slightly each year, but the rough allocation looks like this:
      </p>
      <ul>
        <li>
          <strong>Housing (~33%)</strong> — rent, mortgage, utilities, property
          taxes. The single biggest driver of variation between cities.
        </li>
        <li>
          <strong>Transportation (~17%)</strong> — gas, car payments, transit
          fares, insurance.
        </li>
        <li>
          <strong>Food (~13%)</strong> — groceries and dining out.
        </li>
        <li>
          <strong>Healthcare (~8%)</strong> — insurance premiums, out-of-pocket
          expenses, prescriptions.
        </li>
        <li>
          <strong>Utilities (~7%)</strong> — electricity, gas, water, internet.
        </li>
        <li>
          <strong>Everything else (~22%)</strong> — entertainment, apparel,
          personal care, education, etc.
        </li>
      </ul>
      <p>
        Each category has its own sub-index, which is also expressed relative
        to 100. So a city could have an overall index of 95 but a housing
        sub-index of 80 and a transportation sub-index of 110 — useful detail
        when your personal spending pattern differs from the average.
      </p>

      <h2>CPI vs. RPP: the two main data sources</h2>
      <p>
        Two US government products feed almost every cost of living index you
        see online.
      </p>
      <p>
        <strong>Consumer Price Index (CPI)</strong> is published by BLS and
        measures how prices change <em>over time</em>. CPI is excellent for
        tracking inflation but was never designed to compare cities to each
        other — its values use per-metro base periods, so a direct ratio
        between two city CPIs can mislead. CPI is best used for per-category
        directional signals (is healthcare getting more expensive faster in{" "}
        <Link href="/cost-of-living/atlanta-ga">Atlanta</Link> than{" "}
        <Link href="/cost-of-living/nashville-davidson-metropolitan-government-balance-tn">
          Nashville
        </Link>
        ?) rather
        than level comparisons.
      </p>
      <p>
        <strong>Regional Price Parities (RPPs)</strong> are published by the{" "}
        <a href="https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area" target="_blank" rel="noopener">
          US Bureau of Economic Analysis
        </a>
        . RPPs are built specifically to compare price levels between metros
        at the same point in time. They&apos;re the gold standard for cross-
        city cost of living comparisons, but they&apos;re released annually
        with a lag.
      </p>

      <h2>How UrbRank builds its index</h2>
      <p>
        Our overall cost-of-living index blends two inputs:
      </p>
      <ol>
        <li>
          <strong>Census ACS 5-Year median rent per city</strong>, scaled
          against the national median rent. This is our housing baseline,
          using the same authoritative data the Census Bureau uses for its
          own affordability research.
        </li>
        <li>
          <strong>BLS CPI-U sub-indices</strong> for grocery, utilities,
          transportation, and healthcare in major metros, to refine the
          category-level story for places where BLS publishes metro data.
        </li>
      </ol>
      <p>
        Housing gets the dominant weight because it&apos;s both the biggest
        category and the one with the most between-city variation. A city at
        130 on our overall index typically has rent ~30% above national; a
        city at 80 typically has rent ~20% below. Check the methodology
        explanation on any{" "}
        <Link href="/cost-of-living/austin-tx">city profile page</Link>{" "}
        for the specific values used.
      </p>

      <h2>How to read the number in practice</h2>
      <p>
        A few mental shortcuts that make indices more useful:
      </p>
      <ul>
        <li>
          <strong>Under 95:</strong> genuinely cheap. Your dollar stretches
          noticeably further. See the{" "}
          <Link href="/rankings/cheapest-cities">cheapest cities ranking</Link>{" "}
          for examples.
        </li>
        <li>
          <strong>95 to 110:</strong> near average. The national median
          budget works here without adjustment.
        </li>
        <li>
          <strong>Over 110:</strong> premium. Most of the markup is housing;
          salaries usually need to scale similarly for purchasing power to
          hold. See{" "}
          <Link href="/rankings/most-expensive-cities">the priciest cities</Link>{" "}
          for the high end.
        </li>
      </ul>
      <p>
        When in doubt, don&apos;t just look at the overall number — look at
        the sub-indices that matter to your lifestyle. A renter with a short
        commute cares about housing; a family of five cares about food and
        schools; a retiree cares about healthcare. The composite number is a
        starting point, not a verdict.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/calculator">
            Cost of Living Calculator
          </Link>{" "}
          — applies the index to your actual salary.
        </li>
        <li>
          <Link href="/how-to-use-cost-of-living-calculator">
            How to Use a Cost of Living Calculator
          </Link>{" "}
          — companion guide on reading the output.
        </li>
        <li>
          <Link href="/rankings">
            Cost of Living Rankings
          </Link>{" "}
          — US cities sorted by this exact index.
        </li>
      </ul>
    </>
  );
}
