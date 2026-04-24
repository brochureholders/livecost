import type { CityCardData } from "@/components/CityCard";

export const featuredCities: CityCardData[] = [
  {
    slug: "new-york-ny",
    name: "New York",
    state: "New York",
    index: 168,
    medianRent: 3850,
    population: "8.3M",
  },
  {
    slug: "san-francisco-ca",
    name: "San Francisco",
    state: "California",
    index: 172,
    medianRent: 3420,
    population: "808K",
  },
  {
    slug: "austin-tx",
    name: "Austin",
    state: "Texas",
    index: 118,
    medianRent: 1780,
    population: "975K",
  },
  {
    slug: "chicago-il",
    name: "Chicago",
    state: "Illinois",
    index: 107,
    medianRent: 2100,
    population: "2.7M",
  },
  {
    slug: "denver-co",
    name: "Denver",
    state: "Colorado",
    index: 122,
    medianRent: 1950,
    population: "716K",
  },
  {
    slug: "nashville-tn",
    name: "Nashville",
    state: "Tennessee",
    index: 103,
    medianRent: 1690,
    population: "689K",
  },
];

/** Popular comparisons surfaced on the homepage. `a` and `b` are full
 *  city slugs matching our DB. Render code builds the canonical pair URL
 *  (alphabetical order) via lib/comparison.canonicalizePair(). */
export const popularComparisons: { a: string; b: string; label: string }[] = [
  { a: "new-york-ny", b: "san-francisco-ca", label: "New York vs San Francisco" },
  { a: "austin-tx", b: "denver-co", label: "Austin vs Denver" },
  { a: "chicago-il", b: "nashville-tn", label: "Chicago vs Nashville" },
  { a: "seattle-wa", b: "portland-or", label: "Seattle vs Portland" },
  { a: "miami-fl", b: "atlanta-ga", label: "Miami vs Atlanta" },
  { a: "boston-ma", b: "philadelphia-pa", label: "Boston vs Philadelphia" },
];
