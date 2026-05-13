/**
 * State-level "Why move to {state}?" section, mirroring the city-level
 * component on /cost-of-living/[slug]. Targets the state-level keyword
 * cluster (why move to Texas / Florida / Tennessee / etc.) — ~3,000+
 * monthly US searches across the 50 states.
 *
 * Sources:
 *   - Aggregated facts (cost-of-living averages, income, city counts)
 *     computed from the cities passed in.
 *   - State-specific facts (no income tax, coastal access, mountains)
 *     pulled from hard-coded lists of well-known geography. We don't
 *     invent claims; everything here is encyclopedic.
 *
 * Deterministic per state — the slug hash picks one phrasing per band
 * so the 50 state pages aren't carbon copies of each other.
 */
import type { CitySummary } from "@/lib/cities";
import type { StateInfo } from "@/lib/states";

type Props = {
  state: StateInfo;
  cities: CitySummary[];
};

type Reason = { title: string; body: string };

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// ---------------------------------------------------------------------------
// Determinism helpers — same pattern as the city WhyMoveTo component.
// ---------------------------------------------------------------------------
function hashSlug(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(seed: string, variants: T[], offset = 0): T {
  return variants[(hashSlug(seed) + offset) % variants.length];
}

// ---------------------------------------------------------------------------
// State geography lookups. Encyclopedic, not derived.
// ---------------------------------------------------------------------------
const NO_STATE_TAX = new Set([
  "FL", "TX", "NV", "WA", "WY", "SD", "AK", "NH", "TN",
]);

const ATLANTIC_COAST = new Set([
  "ME", "NH", "MA", "RI", "CT", "NY", "NJ", "DE", "MD", "VA", "NC", "SC", "GA", "FL",
]);
const GULF_COAST = new Set(["FL", "AL", "MS", "LA", "TX"]);
const PACIFIC_COAST = new Set(["CA", "OR", "WA", "AK", "HI"]);
const GREAT_LAKES = new Set(["NY", "PA", "OH", "MI", "IN", "IL", "WI", "MN"]);

// Mountain states — meaningful ranges, not just a hill. Excludes states
// where the mountains are a small fraction of the state's character.
const MOUNTAIN_STATES = new Set([
  "WY", "MT", "CO", "UT", "ID", "NV", "AZ", "NM", "NH", "VT", "WV",
]);

// Warm year-round: only states where this is essentially uniformly true.
// FL and HI are safe; AZ has hot summers + mild winters, captured separately.
const WARM_YEAR_ROUND = new Set(["FL", "HI"]);
const MILD_WINTER_DESERT = new Set(["AZ"]);

// Cold-winter / four-season identity. Northern tier states where winter
// is a defining feature, treated here as a positive (outdoor recreation,
// real seasons, ski culture).
const SNOW_STATES = new Set([
  "MN", "WI", "MI", "VT", "NH", "ME", "MT", "ND", "SD", "ID", "WY", "UT", "CO", "AK",
]);

// Low-density states with the "wide open" identity in popular imagination.
const WIDE_OPEN_STATES = new Set(["MT", "WY", "ND", "SD", "AK", "NM", "NV", "ID"]);

// ---------------------------------------------------------------------------
// Aggregates from the city array.
// ---------------------------------------------------------------------------
type Aggregates = {
  citiesRanked: number;
  avgCostIndex: number | null;
  avgIncome: number | null;
  avgRent: number | null;
  cheapest: CitySummary | null;
  cheapestIndex: number | null;
  biggest: CitySummary | null;
  biggestPop: number | null;
  totalPop: number | null;
};

function aggregate(cities: CitySummary[]): Aggregates {
  let costSum = 0, costN = 0;
  let incomeSum = 0, incomeN = 0;
  let rentSum = 0, rentN = 0;
  let cheapest: CitySummary | null = null;
  let cheapestIndex: number | null = null;
  let biggest: CitySummary | null = null;
  let biggestPop: number | null = null;
  let totalPop = 0;
  for (const c of cities) {
    if (c.cost_index != null) {
      costSum += c.cost_index;
      costN += 1;
      if (cheapestIndex == null || c.cost_index < cheapestIndex) {
        cheapestIndex = c.cost_index;
        cheapest = c;
      }
    }
    if (c.median_household_income != null) {
      incomeSum += c.median_household_income;
      incomeN += 1;
    }
    if (c.median_rent != null) {
      rentSum += c.median_rent;
      rentN += 1;
    }
    if (c.population != null) {
      totalPop += c.population;
      if (biggestPop == null || c.population > biggestPop) {
        biggestPop = c.population;
        biggest = c;
      }
    }
  }
  return {
    citiesRanked: costN,
    avgCostIndex: costN > 0 ? costSum / costN : null,
    avgIncome: incomeN > 0 ? incomeSum / incomeN : null,
    avgRent: rentN > 0 ? rentSum / rentN : null,
    cheapest,
    cheapestIndex,
    biggest,
    biggestPop,
    totalPop: totalPop > 0 ? totalPop : null,
  };
}

// ---------------------------------------------------------------------------
// Reason generators
// ---------------------------------------------------------------------------

function affordability(slug: string, stateName: string, agg: Aggregates): Reason | null {
  if (agg.avgCostIndex == null || agg.avgCostIndex >= 100) return null;
  const idx = agg.avgCostIndex.toFixed(0);
  const pctBelow = (100 - agg.avgCostIndex).toFixed(0);
  const rentLine =
    agg.avgRent != null
      ? ` Average median rent across ${stateName} cities runs about ${CURRENCY.format(agg.avgRent)}/mo`
      : "";
  if (agg.avgCostIndex < 88) {
    return {
      title: pick(slug, [
        "Affordable across the board",
        "Your dollar goes further here",
        `${stateName} is genuinely cheaper than most of the country`,
      ]),
      body: pick(slug, [
        `Averaging across the ${stateName} cities we track, the composite cost-of-living index lands at about ${idx} — roughly ${pctBelow}% under the US baseline. That's not a quirk of one or two outlier towns; it shows up across most of the state.${rentLine}.`,
        `${stateName}'s cost-of-living average comes in around ${idx} on the composite index, about ${pctBelow}% below the national average. Housing is doing most of the work; groceries and services follow at smaller gaps.${rentLine}.`,
      ]),
    };
  }
  return {
    title: pick(slug, [
      "Cheaper than the US average, statewide",
      "Living costs come in under the national baseline",
      `${stateName} is on the affordable side of the country`,
    ]),
    body: pick(slug, [
      `Averaged across the cities we have data for, ${stateName}'s composite cost-of-living index is about ${idx} — a comfortable ${pctBelow}% under the US norm. The cheapest cities in the state run even further below.${rentLine}.`,
      `${stateName} averages a cost-of-living index of roughly ${idx} across its cities, about ${pctBelow}% under the national average. Different cities vary — see the full ranking above — but the overall state picture is on the affordable side.${rentLine}.`,
    ]),
  };
}

function noStateTax(slug: string, state: StateInfo): Reason | null {
  if (!NO_STATE_TAX.has(state.code)) return null;
  const caveat =
    state.code === "NH"
      ? " (New Hampshire still taxes interest and dividends — wage income is left alone.)"
      : state.code === "WA"
        ? " (Washington taxes some long-term capital gains over a high threshold; ordinary wages are untaxed.)"
        : "";
  return {
    title: pick(slug, [
      "No state income tax",
      `${state.name} doesn't tax your paycheck`,
      "Wage income stays untaxed at the state level",
    ]),
    body: pick(slug, [
      `${state.name} is one of just nine US states with no state income tax on wages. For a household earning $100,000, that's typically several thousand dollars a year that stay in the account instead of going to a state revenue department — and it stacks every year you live here.${caveat}`,
      `Living in ${state.name} means the only income tax that touches a paycheck is federal. The state doesn't have a wage income tax, which is one of the most common single reasons people cite for relocating here from higher-tax states.${caveat}`,
      `${state.name} sits in the small club of US states with no income tax on wage and salary income. The savings versus a high-tax state can run to five figures a year for higher earners, and the math gets more interesting the longer you stay.${caveat}`,
    ]),
  };
}

function economicStrength(slug: string, stateName: string, agg: Aggregates): Reason | null {
  if (agg.avgIncome == null || agg.avgIncome < 70000) return null;
  const fmt = CURRENCY.format(agg.avgIncome);
  if (agg.avgIncome >= 95000) {
    return {
      title: pick(slug, [
        "Above-average paychecks across the state",
        "A high-income state, by US standards",
        "Statewide income runs well above the national norm",
      ]),
      body: pick(slug, [
        `Median household income averaged across ${stateName} cities lands at about ${fmt}, well above the US median of roughly $75k. ${stateName}'s economy leans heavily on industries that pay well — and the income distribution reflects it.`,
        `Across the ${stateName} cities in our dataset, the median household earns about ${fmt} — a meaningful step above the national median. Combined with the cost-of-living picture, that math works out better than it looks at first glance.`,
      ]),
    };
  }
  return {
    title: pick(slug, [
      "Solid wages across the state",
      "Incomes run above the US median",
      `${stateName} pays better than the typical state`,
    ]),
    body: pick(slug, [
      `Median household income across ${stateName} cities averages about ${fmt} — a step above the US median of around $75k. Not a uniformly high-wage state, but the labor market here pays more than most of the country.`,
      `Across our ${stateName} city data, typical household income lands near ${fmt}. That's above the national median, which puts more cushion under whatever the local cost of living happens to be.`,
    ]),
  };
}

function variety(slug: string, state: StateInfo, agg: Aggregates): Reason | null {
  if (agg.citiesRanked < 15) return null;
  return {
    title: pick(slug, [
      "Real variety of cities to choose from",
      "More than a couple of options",
      "A wide range of city sizes and styles",
    ]),
    body: pick(slug, [
      `We track ${agg.citiesRanked} ${state.name} cities with full cost data, ranging from small towns to major metros. That means you can actually pick a fit — urban density vs. small-town quiet, expensive vs. cheap, big-job-market vs. easier-commute — instead of having "the state's one big city" be your only option.`,
      `${state.name} has ${agg.citiesRanked} cities in our ranking, covering a real spread of size, density, and cost. People talk about a state like it's monolithic; in practice, the place you actually live varies a lot, and ${state.name} gives you a real menu to pick from.`,
    ]),
  };
}

function cheapAnchor(slug: string, state: StateInfo, agg: Aggregates): Reason | null {
  if (!agg.cheapest || agg.cheapestIndex == null || agg.cheapestIndex >= 82) return null;
  const idx = agg.cheapestIndex.toFixed(0);
  const pctBelow = (100 - agg.cheapestIndex).toFixed(0);
  return {
    title: pick(slug, [
      "There's a genuinely cheap city to fall back on",
      `${agg.cheapest.name} is one of the most affordable cities in the US`,
      "Real low-cost-of-living options exist here",
    ]),
    body: pick(slug, [
      `The cheapest city in ${state.name} we have data for is ${agg.cheapest.name}, sitting at a cost-of-living index of ${idx} — about ${pctBelow}% under the US average. If affordability is the priority, ${state.name} gives you a real option, not a "well, this town is technically here" caveat.`,
      `${agg.cheapest.name} ranks as ${state.name}'s most affordable city at a composite cost index of ${idx} (${pctBelow}% below US average). Worth a look as a baseline for the cost ceiling — most of the rest of the state's cities are more expensive than this, not less.`,
    ]),
  };
}

function bigMetroAccess(slug: string, state: StateInfo, agg: Aggregates): Reason | null {
  if (!agg.biggest || agg.biggestPop == null || agg.biggestPop < 600000) return null;
  return {
    title: pick(slug, [
      "A real major city in the state",
      `${agg.biggest.name} pulls major-metro weight`,
      "Big-city jobs and amenities, in-state",
    ]),
    body: pick(slug, [
      `${agg.biggest.name} (population about ${agg.biggestPop.toLocaleString()}) gives ${state.name} a genuine major-city anchor. Big airports, headquartered employers, professional sports, specialty hospitals, and the kind of job market you don't get in mid-sized towns — and you can live close to it or an hour away, depending on the lifestyle you want.`,
      `Living in ${state.name} comes with access to ${agg.biggest.name}, a city of roughly ${agg.biggestPop.toLocaleString()} with the infrastructure that follows from real urban scale. The benefit isn't just for the people inside the city limits — the airport, hospitals, and labor market serve most of the state.`,
    ]),
  };
}

function coastAccess(slug: string, state: StateInfo): Reason | null {
  const atlantic = ATLANTIC_COAST.has(state.code);
  const gulf = GULF_COAST.has(state.code);
  const pacific = PACIFIC_COAST.has(state.code);
  if (!atlantic && !gulf && !pacific) return null;
  let coastDesc: string;
  if (pacific && state.code === "HI")
    coastDesc = "an entire archipelago of Pacific coastline";
  else if (pacific) coastDesc = "Pacific coastline";
  else if (atlantic && gulf) coastDesc = "both Atlantic and Gulf coastline";
  else if (gulf) coastDesc = "Gulf of Mexico coastline";
  else coastDesc = "Atlantic coastline";
  return {
    title: pick(slug, [
      "Coastal access without flying for it",
      "The ocean is part of life here",
      "Beach weekends are a drive, not a vacation",
    ]),
    body: pick(slug, [
      `${state.name} has ${coastDesc} — meaning the ocean is reachable without a flight, and for plenty of residents it's reachable in under an hour. That changes the rhythm of a year: summer plans default to the water, the weather is moderated by being near it, and a lot of the state's culture is tied to fishing, ports, or beach towns.`,
      `Living in ${state.name} puts ${coastDesc} within driving range of most of the state. The practical upshot: weekend beach trips, easier access to seafood that hasn't been on a truck for a week, and a milder climate near the coast than the same latitude would have inland.`,
    ]),
  };
}

function greatLakesAccess(slug: string, state: StateInfo): Reason | null {
  if (!GREAT_LAKES.has(state.code)) return null;
  return {
    title: pick(slug, [
      "Great Lakes coastline, in a state",
      "The biggest freshwater coast in the country",
      "Beach-style summers without the ocean",
    ]),
    body: pick(slug, [
      `${state.name} sits on the Great Lakes — Lake Michigan, Erie, Huron, Superior, or Ontario, depending on which corner of the state you're in. The lakes mean real beaches, real summer water activities, and a moderating effect on inland weather that the rest of the Midwest doesn't get.`,
      `${state.name}'s Great Lakes coastline is a real geographic asset that's easy to forget about until you've lived near it. Summer life in lakeside towns rivals what you'd get on the ocean, the water is fresh (no salt corrosion, no jellyfish), and winter brings lake-effect snow that locals either love or accept as the price of admission.`,
    ]),
  };
}

function mountainAccess(slug: string, state: StateInfo): Reason | null {
  if (!MOUNTAIN_STATES.has(state.code)) return null;
  return {
    title: pick(slug, [
      "Mountains within reach, year-round",
      "Real mountains, not just hills",
      "Skiing, hiking, and altitude are normal here",
    ]),
    body: pick(slug, [
      `${state.name}'s geography is dominated by real mountain terrain — the kind that supports ski resorts in winter and serious hiking and trail networks the rest of the year. Outdoor life is a defining piece of how the state is lived, not a thing you have to drive eight hours to access.`,
      `Mountains are part of the everyday view in ${state.name}, not a destination. That means cheaper proximity to skiing, hiking, and fishing than most of the country, and a culture that's tilted toward time outside whether you signed up for it or not.`,
    ]),
  };
}

function warmYearRound(slug: string, state: StateInfo): Reason | null {
  if (!WARM_YEAR_ROUND.has(state.code)) return null;
  return {
    title: pick(slug, [
      "You can essentially skip winter",
      "Year-round warm weather",
      "Winter, but only in name",
    ]),
    body: pick(slug, [
      `${state.name} doesn't have winter the way the rest of the country has winter. Mild, short, and mostly just a different flavor of nice weather — the kind of climate people specifically move for, especially after a decade or two of dealing with the alternative.`,
      `Living in ${state.name} means a light jacket is the most you'll need most days of the year. Outdoor life keeps going through what would be the coldest months elsewhere, heating bills stay low, and beach or outdoor plans aren't seasonal.`,
    ]),
  };
}

function mildWinterDesert(slug: string, state: StateInfo): Reason | null {
  if (!MILD_WINTER_DESERT.has(state.code)) return null;
  return {
    title: pick(slug, [
      "Winters are the reward",
      "The cold months are the best months",
      "Mild winters, even in a hot state",
    ]),
    body: pick(slug, [
      `${state.name} runs hot in the summer, but the winters are the trade-off most newcomers fall in love with — sunny, dry, in the 60s and 70s through the actual cold months. Outdoor life from October to April runs essentially uninterrupted, which is unusual in the US.`,
      `Winter in ${state.name} is when the rest of the country envies the state. Mostly sunny, mostly dry, daytime temperatures in the 60s and 70s, and the kind of weather you'd otherwise have to take a flight to find in February.`,
    ]),
  };
}

function fourSeasons(slug: string, state: StateInfo): Reason | null {
  if (!SNOW_STATES.has(state.code)) return null;
  return {
    title: pick(slug, [
      "Four real seasons, including winter",
      "Winter is a feature, not a bug",
      "Snow, skiing, and a real outdoor calendar",
    ]),
    body: pick(slug, [
      `${state.name} has the full four-season rotation, with winters that are cold enough to matter — meaning real snow, real ski resorts, and a culture that's built around it instead of pretending it isn't happening. If winter is a thing you actively like, this is the side of the country to be on.`,
      `Cold-winter climates aren't for everyone, but for people who like the seasons to be different from each other, ${state.name} delivers. Snow accumulates, lakes freeze, fires get used for warmth and not just decoration — and spring genuinely feels like a relief when it arrives.`,
    ]),
  };
}

function wideOpen(slug: string, state: StateInfo): Reason | null {
  if (!WIDE_OPEN_STATES.has(state.code)) return null;
  return {
    title: pick(slug, [
      "Space, in a way most of the country doesn't have",
      "Genuinely uncrowded",
      "Low population density — and it shows",
    ]),
    body: pick(slug, [
      `${state.name} is one of the least densely populated states in the country, which sounds abstract until you've driven through it. Empty highways, big skies, no traffic, and the kind of nature-to-people ratio you can't really replicate by moving to the suburbs of a bigger metro.`,
      `Whatever the population number says, ${state.name} feels less crowded than the rest of the country — long drives without traffic, towns that haven't been swallowed by sprawl, and a baseline level of quiet that's just structurally unavailable in denser states.`,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WhyMoveToState({ state, cities }: Props) {
  const slug = state.slug;
  const agg = aggregate(cities);

  const candidates: (Reason | null)[] = [
    affordability(slug, state.name, agg),
    cheapAnchor(slug, state, agg),
    noStateTax(slug, state),
    economicStrength(slug, state.name, agg),
    bigMetroAccess(slug, state, agg),
    variety(slug, state, agg),
    coastAccess(slug, state),
    greatLakesAccess(slug, state),
    mountainAccess(slug, state),
    warmYearRound(slug, state),
    mildWinterDesert(slug, state),
    fourSeasons(slug, state),
    wideOpen(slug, state),
  ];

  const reasons = candidates.filter((r): r is Reason => r != null);
  if (reasons.length === 0) return null;

  const lead = reasons[0];
  const second = reasons[1];
  const tail = reasons.length > 2 ? `, plus ${reasons.length - 2} more` : "";
  const intro = second
    ? pick(slug, [
        `If you're weighing a move to ${state.name}, the case usually comes down to a few specific things — most clearly ${lead.title.toLowerCase()} and ${second.title.toLowerCase()}${tail}. Here's the detail.`,
        `${state.name} has a handful of real selling points, and they're concrete rather than vague. ${lead.title} and ${second.title.toLowerCase()} are the headliners${tail}.`,
        `Why do people move to ${state.name}? The most common reasons line up with what the data and geography support: ${lead.title.toLowerCase()}, ${second.title.toLowerCase()}${tail}. The rest is below.`,
        `So you're thinking about ${state.name}. The strongest arguments for it are around ${lead.title.toLowerCase()} and ${second.title.toLowerCase()}${tail}. Detail on each below.`,
      ])
    : pick(slug, [
        `${state.name}'s strongest single argument is around ${lead.title.toLowerCase()}.`,
        `On the data, the answer to "why move to ${state.name}" comes back to ${lead.title.toLowerCase()}.`,
      ]);

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Why move to {state.name}?
      </h2>
      <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--muted)]">
        {intro}
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {reasons.map((r, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-7"
          >
            <h3 className="text-lg md:text-xl font-semibold tracking-tight">
              {r.title}
            </h3>
            <p className="mt-3 text-sm md:text-base leading-relaxed text-[var(--muted)]">
              {r.body}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-[var(--muted)]">
        Reasons reflect aggregated city data for {state.name} (Census ACS,
        BLS, BEA) plus well-known state-level geography. We only list points
        that are actually supported — different states show different
        sections.
      </p>
    </div>
  );
}
