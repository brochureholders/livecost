/**
 * Demographic landing pages map URL slugs to UrbRank Score profiles.
 * Used by /best-cities/[demographic] and /best-cities/[demographic]/[state].
 */
import type { DimensionKey, Profile } from "./urbrank-score";

export type Demographic = {
  slug: string;
  profile: Profile;
  label: string; // "Families"
  singular: string; // "families"
  heroTitle: string;
  heroSubtitle: string;
  weights: string; // human-readable summary
  primaryDimensions: DimensionKey[];
  whatMatters: string[];
  faqs: { q: string; a: string }[];
};

export const DEMOGRAPHICS: Demographic[] = [
  {
    slug: "families",
    profile: "family",
    label: "Families",
    singular: "families",
    heroTitle: "Best US cities for families",
    heroSubtitle:
      "Safety, affordability, quality schools, and kid-friendly climate — ranked for every city.",
    weights:
      "25% safety, 25% affordability, 20% education, 15% climate, 10% walkability, 5% environment.",
    primaryDimensions: ["safety", "affordability", "education"],
    whatMatters: [
      "Low crime — safe neighborhoods and schools.",
      "Affordable homes — enough room for a growing family.",
      "Strong school districts — measured by adult educational attainment.",
      "Mild climate — outdoors-friendly without extremes.",
    ],
    faqs: [
      {
        q: "What makes a city good for families?",
        a: "A combination of safety (low violent and property crime), affordability (housing and groceries within reach on a single-earner household), school quality (proxied by the share of adults with a bachelor's degree, which correlates strongly with school ratings), and mild climate. UrbRank weights those four dimensions to rank the best family cities.",
      },
      {
        q: "How is the family ranking calculated?",
        a: "Each city gets scored 0-100 on seven dimensions. For the family ranking, we apply a weighted average: safety 25%, affordability 25%, education 20%, climate 15%, walkability 10%, environment 5%. The result is a single 0-100 UrbRank Score, which is sorted to produce the ranking.",
      },
    ],
  },
  {
    slug: "retirees",
    profile: "retiree",
    label: "Retirees",
    singular: "retirees",
    heroTitle: "Best US cities for retirees",
    heroSubtitle:
      "Mild weather, low cost of living, low crime, and walkable neighborhoods — for a comfortable retirement.",
    weights:
      "25% climate, 25% affordability, 20% safety, 20% walkability, 10% environment.",
    primaryDimensions: ["climate", "affordability", "safety", "walkability"],
    whatMatters: [
      "Mild winters and summers — outdoor-friendly year round.",
      "Low cost of living — stretch retirement savings further.",
      "Safe neighborhoods — low crime rates.",
      "Walkable errands — less dependence on driving.",
    ],
    faqs: [
      {
        q: "What makes a city good for retirees?",
        a: "Retirees typically prioritize mild climate (easy on the body, more outdoor time), affordability (fixed income goes further), safety, and walkability (less reliance on driving). UrbRank weights those four most heavily when ranking the best retirement cities.",
      },
      {
        q: "Are taxes factored into the ranking?",
        a: "Not directly. The affordability dimension reflects overall cost of living (housing, groceries, utilities, healthcare, transportation) rather than state income tax. Most retirees should also factor in state tax treatment of Social Security and pensions separately.",
      },
    ],
  },
  {
    slug: "remote-workers",
    profile: "remote_worker",
    label: "Remote Workers",
    singular: "remote workers",
    heroTitle: "Best US cities for remote workers",
    heroSubtitle:
      "Affordable housing, great climate, walkable amenities, clean air — built for location-independent life.",
    weights:
      "35% affordability, 20% climate, 15% walkability, 15% environment, 15% safety.",
    primaryDimensions: ["affordability", "climate", "walkability", "environment"],
    whatMatters: [
      "Low cost of living — leverage your location flexibility.",
      "Comfortable climate — work from the backyard in shoulder seasons.",
      "Walkable downtown — coffee shops and coworking nearby.",
      "Clean air — important for those indoors on Zoom all day.",
    ],
    faqs: [
      {
        q: "What makes a city good for remote workers?",
        a: "Since remote workers aren't tied to an office, they can optimize for affordability — their biggest lever for quality of life. Climate (for outdoor work options), walkability (for third-places like coffee shops), and clean air round out the top priorities. UrbRank weights affordability at 35%, with climate, walkability, environment, and safety filling the rest.",
      },
      {
        q: "Doesn't internet speed matter?",
        a: "Yes, but we don't yet have a nation-wide dataset for every city with comparable methodology. Most major US cities have at least one fiber provider. For now, use the city's Census metro-area size as a proxy — metros of 100k+ will almost always have a fiber option.",
      },
    ],
  },
  {
    slug: "young-professionals",
    profile: "young_professional",
    label: "Young Professionals",
    singular: "young professionals",
    heroTitle: "Best US cities for young professionals",
    heroSubtitle:
      "Strong job markets, walkable nightlife, affordable rent, and livable climate — for 20- and 30-somethings building careers.",
    weights:
      "30% jobs, 25% walkability, 20% affordability, 15% climate, 10% safety.",
    primaryDimensions: ["job_market", "walkability", "affordability"],
    whatMatters: [
      "Strong job market — low unemployment, higher-than-average salaries.",
      "Walkable core — nightlife, dating, social life without a car.",
      "Affordable rent — leave room to save and enjoy.",
      "Vibrant climate — extend the social seasons.",
    ],
    faqs: [
      {
        q: "What makes a city good for young professionals?",
        a: "Jobs first — low unemployment plus above-median household income. Then walkability (for the social and dating-market aspects of city life), affordability (so rent doesn't eat the paycheck), and climate (for weekend life). UrbRank weights the young-professional ranking at 30% jobs, 25% walkability, 20% affordability.",
      },
      {
        q: "What about dating and nightlife?",
        a: "Walkability is the best available proxy for nightlife — walkable cores mean dense restaurants, bars, and venues. For dating market, we use metro population as a soft filter; cities below 100k are usually too small for a thriving singles scene.",
      },
    ],
  },
];

export function getDemographicBySlug(slug: string): Demographic | null {
  return DEMOGRAPHICS.find((d) => d.slug === slug) ?? null;
}
