/**
 * "Why move to {city}?" — a positive-angles section that pulls real
 * strengths from the city's structured data and writes them up as prose.
 *
 * Honest by construction: each potential reason has a data threshold, and
 * if the threshold isn't met the reason is omitted. A city with bad
 * crime won't get a "low crime" paragraph; an expensive city won't get
 * an "affordable" one. The output is whatever's actually true.
 *
 * Determinism: the slug hash picks one of several phrasings per band, so
 * the catalog as a whole doesn't read like a generated list.
 */
import type { CityProfile } from "@/lib/cities";

type Props = { city: CityProfile };

type Reason = { title: string; body: string };

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PCT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// ---------------------------------------------------------------------------
// Determinism helpers — same pattern as FAQ.tsx and city-narrative.ts.
// ---------------------------------------------------------------------------
function hashSlug(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(seed: string, variants: T[], offset = 0): T {
  return variants[(hashSlug(seed) + offset) % variants.length];
}

// States with no state income tax. NH and WA tax some interest/dividends
// or capital gains; we still flag them since wage income is untaxed.
const NO_STATE_TAX = new Set([
  "FL", "TX", "NV", "WA", "WY", "SD", "AK", "NH", "TN",
]);

// ---------------------------------------------------------------------------
// Reason generators. Each returns Reason | null. Null means "this city's
// data doesn't support a positive angle on this dimension" — and the
// section just won't include it.
// ---------------------------------------------------------------------------

function affordability(
  slug: string,
  name: string,
  costIndex: number | null,
  rent: number | null,
  income: number | null,
): Reason | null {
  if (costIndex == null || costIndex >= 95) return null;
  const idx = costIndex.toFixed(0);
  const pctBelow = (100 - costIndex).toFixed(0);
  const rentLine =
    rent != null
      ? ` Median rent in town runs about ${CURRENCY.format(rent)}/mo`
      : "";
  const incomeLine =
    rent != null && income != null
      ? ` against a typical household income of ${CURRENCY.format(income)}` +
        ", which is the kind of ratio that leaves room to save."
      : rent != null
        ? ", which is what most newcomers from coastal metros notice first."
        : "";

  if (costIndex < 80) {
    return {
      title: pick(slug, [
        "Your money goes a lot further here",
        "The cost-of-living math actually works",
        "A genuinely affordable place to land",
      ]),
      body: pick(slug, [
        `${name}'s composite cost-of-living index is ${idx} — roughly ${pctBelow}% under the US baseline. Housing is doing most of the heavy lifting; groceries, utilities, and services are also cheaper than the national norm, just by smaller margins.${rentLine}${incomeLine}`,
        `By the numbers, ${name} is one of the more affordable US cities of its size. The composite index sits at ${idx}, about ${pctBelow}% below the national average, with housing as the main driver of the discount.${rentLine}${incomeLine}`,
        `Cost of living lands at ${idx} on the composite index — about ${pctBelow}% under the US average. That's the kind of gap that shows up in the savings rate, not just the rent check.${rentLine}${incomeLine}`,
      ]),
    };
  }
  return {
    title: pick(slug, [
      "Cheaper than the national average, with no fine print",
      "Your dollar carries more weight here",
      "Living costs come in under the US baseline",
    ]),
    body: pick(slug, [
      `${name} sits at ${idx} on the composite cost-of-living index — about ${pctBelow}% under the national average. Not the cheapest place in the country, but enough of a discount to notice on rent and groceries every month.${rentLine}${incomeLine}`,
      `The composite cost-of-living index lands at ${idx}, a comfortable ${pctBelow}% under the US norm. It shows up most clearly in housing, which is where the gap to coastal metros usually opens up.${rentLine}${incomeLine}`,
    ]),
  };
}

function noStateTax(slug: string, name: string, stateCode: string, state: string): Reason | null {
  if (!NO_STATE_TAX.has(stateCode)) return null;
  // Subtle copy variation for the two states with narrow exceptions.
  const caveat =
    stateCode === "NH"
      ? " (New Hampshire still taxes interest and dividends, but wage income is left alone.)"
      : stateCode === "WA"
        ? " (Washington taxes some long-term capital gains over a high threshold, but ordinary wages and salaries are not taxed.)"
        : "";
  return {
    title: pick(slug, [
      "No state income tax",
      `${state} doesn't tax your paycheck`,
      "Wage income stays untaxed at the state level",
    ]),
    body: pick(slug, [
      `${state} is one of the handful of US states with no state income tax on wages, so the only income-tax bite on a paycheck in ${name} is federal. For a household earning $100k, that's a tangible four-figure difference every year compared to a comparable salary in California or New York.${caveat}`,
      `Living in ${name} means no state income tax on your salary — ${state} is one of nine states that simply doesn't have one. On a $100k income that's typically thousands of dollars a year that stay in your account instead of going to a state revenue department.${caveat}`,
      `Wage income in ${name} isn't taxed at the state level. ${state} is one of the few US states with no income tax, which is one of the reasons people relocating from high-tax states tend to land here in the first place.${caveat}`,
    ]),
  };
}

function income(slug: string, name: string, medianIncome: number | null): Reason | null {
  if (medianIncome == null || medianIncome < 75000) return null;
  const fmt = CURRENCY.format(medianIncome);
  if (medianIncome >= 110000) {
    return {
      title: pick(slug, [
        "Paychecks here run high",
        "A high-income city, even by US standards",
        "Above-average earnings, not just for a few people",
      ]),
      body: pick(slug, [
        `Median household income in ${name} is ${fmt} — well above the US median of roughly $75k. It's a city where high-paying industries (tech, finance, professional services) cluster, and the income distribution tilts noticeably upward relative to most of the country.`,
        `${name}'s typical household earns ${fmt}, which puts it in the top tier of US cities for household income. The bottom of the wage distribution isn't necessarily different from anywhere else, but the median and above sit meaningfully higher.`,
      ]),
    };
  }
  return {
    title: pick(slug, [
      "Paychecks come in above the US average",
      "Solidly above-average earnings",
      "A higher-income labor market than the national norm",
    ]),
    body: pick(slug, [
      `Median household income in ${name} is ${fmt}, a step above the national median of about $75k. The local job market leans toward industries that pay better than average, and that shows up in the take-home for most working households here.`,
      `The typical household in ${name} pulls in ${fmt} — comfortably above the US median. Combined with the cost of living here, the income-to-expense ratio works out better than a quick look at either number in isolation would suggest.`,
    ]),
  };
}

function jobs(slug: string, name: string, unemployment: number | null): Reason | null {
  if (unemployment == null || unemployment >= 4) return null;
  const u = unemployment.toFixed(1);
  return {
    title: pick(slug, [
      "Jobs are easy to find right now",
      "The labor market runs tight",
      "Low unemployment, plenty of openings",
    ]),
    body: pick(slug, [
      `Unemployment in ${name} is running about ${u}% — below the typical US baseline of around 4%. That usually translates to a job market where employers compete for workers more than the other way around, which is the better side of that equation to be on if you're the one moving.`,
      `The unemployment rate in ${name} sits at roughly ${u}%, which is a tight labor market by US standards. Salaries get nudged up faster, openings are easier to find, and switching jobs is less of a leap than it is in a softer market.`,
      `At about ${u}% unemployment, ${name}'s labor market is running on the tight side. Easier to land a role, easier to negotiate, easier to leave one job for a better one — the practical things that matter when you're actually looking.`,
    ]),
  };
}

function growth(slug: string, name: string, growthPct: number | null): Reason | null {
  if (growthPct == null || growthPct < 0.8) return null;
  const g = growthPct.toFixed(1);
  return {
    title: pick(slug, [
      "It's a city on the way up",
      "Population is growing, and that matters",
      "A growing city — with everything that brings",
    ]),
    body: pick(slug, [
      `${name}'s population is growing by about ${g}% a year, which sounds small but compounds into noticeable change over a decade. New restaurants, new neighborhoods getting built, more flights from the local airport, and a generally higher metabolism than cities where the number is flat or shrinking.`,
      `${name} is one of the cities pulling in new residents at a measurable clip — about ${g}% population growth annually. That's the kind of trend that funds new infrastructure, brings new employers, and keeps a city from getting stale.`,
    ]),
  };
}

function climate(
  slug: string,
  name: string,
  winter: number | null,
  summer: number | null,
): Reason | null {
  if (winter == null || summer == null) return null;
  // Mild four-season climate
  if (winter >= 38 && winter <= 50 && summer >= 75 && summer < 88) {
    return {
      title: pick(slug, [
        "The weather doesn't punish you",
        "A genuinely mild climate",
        "Four real seasons, none of them brutal",
      ]),
      body: pick(slug, [
        `Summers in ${name} average about ${summer.toFixed(0)}°F, winters around ${winter.toFixed(0)}°F. That's the band where you get distinct seasons without either end being miserable — a real spring and fall, summers warm enough for the pool, winters cold enough for a jacket but not for survival gear.`,
        `${name}'s climate sits in the rare US sweet spot — summer averages around ${summer.toFixed(0)}°F, winter averages around ${winter.toFixed(0)}°F. You get four seasons without paying the heating bills of the Upper Midwest or the AC bills of the Sun Belt.`,
      ]),
    };
  }
  // Warm-to-hot year-round (Sun Belt)
  if (winter >= 50) {
    return {
      title: pick(slug, [
        "You can put away the heavy coats",
        "Winter, but barely",
        "Year-round warm weather",
      ]),
      body: pick(slug, [
        `Winters in ${name} average about ${winter.toFixed(0)}°F — short, mild, and mostly just a different kind of nice weather than summer's ${summer.toFixed(0)}°F. If you've spent a few years dealing with real winters and decided the trade-off isn't worth it, this is what the alternative looks like.`,
        `${name} essentially skips winter as the rest of the country knows it. Average winter temperatures of ${winter.toFixed(0)}°F mean a light jacket is the most you'll need, and outdoor life keeps going year-round. Summer comes in at ${summer.toFixed(0)}°F, which is hot but on the predictable Sun Belt curve.`,
        `A jacket, not a parka — winters in ${name} average ${winter.toFixed(0)}°F. Summer ramps up to about ${summer.toFixed(0)}°F, which is real heat, but the rest of the year is the kind of weather you'd pay good money to visit.`,
      ]),
    };
  }
  return null;
}

function sunshine(slug: string, name: string, days: number | null): Reason | null {
  if (days == null || days < 235) return null;
  const d = Math.round(days);
  return {
    title: pick(slug, [
      "Sunny days are the default",
      "You'll see a lot of the sun",
      "Plenty of blue sky to go around",
    ]),
    body: pick(slug, [
      `${name} sees about ${d} sunny days a year — well above the US average of roughly 205. If your mood tracks daylight, or if you just like spending time outside, this is one of the easier US cities to live in.`,
      `Roughly ${d} sunny days a year in ${name}, comfortably more than the national norm. Gray weeks happen; they're just the exception. Most of the year, the forecast leans bright.`,
      `${name} runs noticeably sunnier than the typical US city — about ${d} clear days a year against a 205-day national average. SAD lamps don't sell well here.`,
    ]),
  };
}

function safety(slug: string, name: string, crime: number | null): Reason | null {
  if (crime == null || crime >= 3000) return null;
  const r = Math.round(crime).toLocaleString();
  if (crime < 1800) {
    return {
      title: pick(slug, [
        "It's a quieter city by the numbers",
        "Crime statistics come out reassuring",
        "Among the safer US cities of its size",
      ]),
      body: pick(slug, [
        `${name} reports roughly ${r} crime incidents per 100,000 residents, well under the US average of about 3,500 per 100k. As always, citywide numbers paper over real differences between neighborhoods — but the broader trend here is on the calmer end of the US distribution.`,
        `The reported crime rate in ${name} runs about ${r} per 100,000 residents — meaningfully below the national norm. People who care about safety as a baseline rather than a feature tend to land in cities with numbers like these.`,
      ]),
    };
  }
  return {
    title: pick(slug, [
      "Lower-than-average crime numbers",
      "Safer than the typical US city",
      "On the calmer side of the national distribution",
    ]),
    body: pick(slug, [
      `${name} reports about ${r} crime incidents per 100,000 residents — a step below the US average of around 3,500. The citywide number averages over neighborhoods that can vary a lot, but the headline number is friendlier than most American cities of comparable size.`,
      `Reported crime in ${name} comes in around ${r} per 100,000 — under the national baseline of about 3,500. Worth digging into specific neighborhoods before settling on one, but the city-level picture is on the safer side.`,
    ]),
  };
}

function walkability(
  slug: string,
  name: string,
  walk: number | null,
  transit: number | null,
): Reason | null {
  if (walk == null || walk < 55) return null;
  const transitFragment =
    transit != null && transit >= 50
      ? ` Transit Score comes in at ${transit}/100 too, so even the trips that are too far to walk are usually doable on a bus or train.`
      : "";
  if (walk >= 80) {
    return {
      title: pick(slug, [
        "You don't actually need a car",
        "Genuinely walkable, not just walkable-on-paper",
        "Most daily life happens on foot",
      ]),
      body: pick(slug, [
        `${name}'s Walk Score is ${walk}/100 — top-tier walkability by US standards. Groceries, coffee, work, social life: most of it lands within reasonable foot range of wherever you live. A lot of residents skip car ownership entirely, which is its own form of savings on top of the lifestyle change.${transitFragment}`,
        `With a Walk Score of ${walk}/100, ${name} is in the category where car ownership becomes a real choice rather than the default. Errands work on foot, the city's built dense enough that things are actually close together, and the parking-and-gas budget can quietly disappear.${transitFragment}`,
      ]),
    };
  }
  return {
    title: pick(slug, [
      "You can walk to most of what you need",
      "Walkable in a way most US cities aren't",
      "Daily errands don't require a car",
    ]),
    body: pick(slug, [
      `${name} earns a Walk Score of ${walk}/100 — above the US median, with denser neighborhoods scoring higher than the citywide aggregate suggests. A car is still useful for longer trips, but everyday life works on foot for a lot of residents.${transitFragment}`,
      `With a citywide Walk Score of ${walk}/100, ${name} sits firmly in the walkable-by-US-standards camp. Pick a central neighborhood and most daily errands happen without keys in your hand.${transitFragment}`,
    ]),
  };
}

function biking(slug: string, name: string, bike: number | null): Reason | null {
  if (bike == null || bike < 60) return null;
  return {
    title: pick(slug, [
      "It's an easy city to live in on a bike",
      "Bike infrastructure that actually exists",
      "A bike-friendly city by US standards",
    ]),
    body: pick(slug, [
      `${name}'s Bike Score is ${bike}/100 — the kind of number you only get when a city has built real bike infrastructure (protected lanes, connected routes, drivers who expect cyclists). For commuting or just for getting around, the bike is a serious option here, not a hobby.`,
      `Bike Score of ${bike}/100 in ${name}. That puts it in the small group of US cities where you can do groceries, commute, and run errands on a bike without it being a feat of urban survival.`,
    ]),
  };
}

function airQuality(slug: string, name: string, aqi: number | null): Reason | null {
  if (aqi == null || aqi >= 45) return null;
  return {
    title: pick(slug, [
      "The air is clean, not just clean-ish",
      "Air quality you don't have to think about",
      "Clean air, by the numbers",
    ]),
    body: pick(slug, [
      `${name}'s air quality index averages about ${aqi.toFixed(0)} — comfortably in the EPA's "good" range. No daily ritual of checking the AQI before going for a run, no smoky-day plans, no surprise asthma flare-ups for the kids. The kind of background condition you notice mostly by its absence.`,
      `Average AQI in ${name} comes in around ${aqi.toFixed(0)}, well into the "good" band. Clean air isn't a thing you appreciate until you've lived somewhere it wasn't — and this is the side of that line you want to be on.`,
    ]),
  };
}

function commute(slug: string, name: string, minutes: number | null): Reason | null {
  if (minutes == null || minutes >= 25) return null;
  return {
    title: pick(slug, [
      "You'll get your commute time back",
      "Short commutes are the local norm",
      "The drive to work is mercifully short",
    ]),
    body: pick(slug, [
      `The average one-way commute in ${name} is about ${minutes.toFixed(0)} minutes — short by US standards (the national average is closer to 27). Over a year of working days, that's hundreds of hours that don't get spent in traffic, which is the kind of thing you notice in the weekend rather than the weekday.`,
      `Average commute time in ${name} runs around ${minutes.toFixed(0)} minutes one-way — short enough that it doesn't restructure your day. Compared to the 45-plus-minute commutes that are normal in major metros, the difference adds up to a real lifestyle gap.`,
    ]),
  };
}

function education(slug: string, name: string, collegePct: number | null): Reason | null {
  if (collegePct == null || collegePct < 38) return null;
  const p = PCT.format(collegePct);
  return {
    title: pick(slug, [
      "A well-educated peer group",
      "More college grads than the typical city",
      "An educated neighborhood, by the numbers",
    ]),
    body: pick(slug, [
      `${p}% of adults 25 and over in ${name} hold a bachelor's degree or higher — meaningfully above the US average of around 36%. That correlates with the things you'd expect: stronger schools, more white-collar employers, more bookstores than the population alone would predict.`,
      `${name} has a college-educated share of about ${p}% among adults 25+, which is higher than the national norm. It shows up in the local job mix, in the school district's reputation, and in the kind of conversations you have at the coffee shop.`,
    ]),
  };
}

function housingValue(
  slug: string,
  name: string,
  rent: number | null,
  housingIndex: number | null,
  costIndex: number | null,
): Reason | null {
  // Only fires when housing specifically is cheap — distinct signal from
  // overall cost. Skip if it'd duplicate the affordability reason (when
  // both overall cost and housing are below 95).
  if (rent == null && housingIndex == null) return null;
  if (costIndex != null && costIndex < 95) return null; // already covered
  if (housingIndex != null && housingIndex >= 95) return null;
  if (rent != null && rent >= 1300) return null;
  const rentLine = rent != null ? `Median rent is about ${CURRENCY.format(rent)}/mo` : null;
  const idxLine =
    housingIndex != null
      ? `the housing sub-index lands at ${housingIndex.toFixed(0)} (US avg = 100)`
      : null;
  const detail = [rentLine, idxLine].filter(Boolean).join(", and ");
  return {
    title: pick(slug, [
      "Housing is the bargain",
      "Rent specifically is reasonable here",
      "Where the city quietly wins: housing costs",
    ]),
    body: pick(slug, [
      `Even if other categories track the national average in ${name}, housing comes in noticeably cheaper. ${detail}. That's where most of the day-to-day affordability difference shows up for newcomers.`,
      `${detail} in ${name}. That's the line item people from coastal metros usually find hardest to believe — and the one that frees up budget for everything else.`,
    ]),
  };
}

function metroAmenity(
  slug: string,
  name: string,
  metro: string | null,
  population: number | null,
): Reason | null {
  if (!metro || metro.toLowerCase().includes(name.toLowerCase())) return null;
  if (population == null || population >= 250000) return null; // only when city is small but metro is bigger
  return {
    title: pick(slug, [
      "Small-city pace, big-metro amenities",
      "Part of a larger metro, without the big-city downside",
      "You get the regional infrastructure without paying for it",
    ]),
    body: pick(slug, [
      `${name} sits inside the ${metro} metro area, which means a smaller hometown footprint with access to the airports, hospitals, sports teams, and job market of a much larger region. Lower housing costs and shorter local commutes than the metro center, with most of the same amenities a half-hour drive away.`,
      `Living in ${name} puts you inside the broader ${metro} metro area without the price tag of the urban core. You inherit the larger region's airline routes, specialty hospitals, sports calendar, and labor market — but pay for housing the way a smaller city does.`,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

export default function WhyMoveTo({ city }: Props) {
  const slug = city.slug;
  const costs = city.costs;
  const qual = city.quality;
  const demos = city.demographics;

  const candidates: (Reason | null)[] = [
    affordability(
      slug,
      city.name,
      costs?.cost_index ?? null,
      costs?.median_rent ?? null,
      costs?.median_household_income ?? null,
    ),
    housingValue(
      slug,
      city.name,
      costs?.median_rent ?? null,
      costs?.housing_index ?? null,
      costs?.cost_index ?? null,
    ),
    noStateTax(slug, city.name, city.state_code, city.state),
    income(slug, city.name, costs?.median_household_income ?? null),
    jobs(slug, city.name, demos?.unemployment_rate ?? null),
    growth(slug, city.name, demos?.population_growth_pct ?? null),
    climate(
      slug,
      city.name,
      qual?.avg_temp_winter ?? null,
      qual?.avg_temp_summer ?? null,
    ),
    sunshine(slug, city.name, qual?.sunshine_days ?? null),
    safety(slug, city.name, qual?.crime_rate_per_100k ?? null),
    walkability(
      slug,
      city.name,
      qual?.walk_score ?? null,
      qual?.transit_score ?? null,
    ),
    biking(slug, city.name, qual?.bike_score ?? null),
    airQuality(slug, city.name, qual?.air_quality_index ?? null),
    commute(slug, city.name, demos?.commute_time_avg ?? null),
    education(slug, city.name, demos?.college_educated_pct ?? null),
    metroAmenity(slug, city.name, city.metro_area, city.population),
  ];

  const reasons = candidates.filter((r): r is Reason => r != null);
  if (reasons.length === 0) return null;

  // Intro paragraph — varies per city, names the first two reasons so the
  // reader gets the headline before the detail. Falls back gracefully
  // when only one reason exists.
  const lead = reasons[0];
  const second = reasons[1];
  const tail = reasons.length > 2 ? `, plus ${reasons.length - 2} more things worth knowing` : "";
  const intro = second
    ? pick(slug, [
        `If you're weighing a move to ${city.name}, the short answer is that the city has a few genuine arguments going for it — most obviously ${lead.title.toLowerCase()} and ${second.title.toLowerCase()}${tail}. Here's the longer version.`,
        `${city.name} has a handful of real selling points, and they're not the kind of thing you find in a brochure. ${lead.title} and ${second.title.toLowerCase()} are the headliners${tail}. The rest is below.`,
        `People moving to ${city.name} usually have at least one specific reason. Most of them line up with what the data shows: ${lead.title.toLowerCase()}, ${second.title.toLowerCase()}${tail}. Here's what's actually on the table.`,
      ])
    : pick(slug, [
        `${city.name} has at least one strong card to play — ${lead.title.toLowerCase()}. Here's the longer version.`,
        `If you're weighing ${city.name}, the strongest single argument is around ${lead.title.toLowerCase()}.`,
      ]);

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Why move to {city.name}?
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
        Reasons are pulled from {city.name}&apos;s actual data — Census ACS,
        BLS, BEA, NOAA, EPA AQS, FBI, and Walk Score. We don&apos;t list
        positives that aren&apos;t supported by the numbers, which is why
        different cities show different sections.
      </p>
    </div>
  );
}
