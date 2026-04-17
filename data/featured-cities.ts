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

export const popularComparisons = [
  { slug: "new-york-vs-san-francisco", label: "New York vs San Francisco" },
  { slug: "austin-vs-denver", label: "Austin vs Denver" },
  { slug: "chicago-vs-nashville", label: "Chicago vs Nashville" },
  { slug: "seattle-vs-portland", label: "Seattle vs Portland" },
  { slug: "miami-vs-atlanta", label: "Miami vs Atlanta" },
  { slug: "boston-vs-philadelphia", label: "Boston vs Philadelphia" },
];
